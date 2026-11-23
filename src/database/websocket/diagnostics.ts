import type {
  DiagnosticIdentity,
  DiagnosticRecord,
  DiagnosticStep,
  DiagnosticWait,
  RttMeasurement,
} from './types'
import { Dexie } from 'dexie'
import { wsdb } from './index'

const HISTORY_LIMIT = { ordinary: 100, exceptional: 50 }
const SESSION_LOCK_PREFIX = 'websocket-diagnostic:'
const STALE_WAIT_LIMIT = 10 * 60 * 1000

const scope = (pageId: string | undefined, wait: DiagnosticWait) => `${pageId ?? ''}:${wait}`

export const isDiagnosticIssue = ({ state }: DiagnosticStep) =>
  state === 'failed' || state === 'timeout' || state === 'interrupted'

export const diagnosticStep = (
  code: DiagnosticStep['code'],
  from: DiagnosticStep['from'],
  state: DiagnosticStep['state'],
  fields: Omit<DiagnosticStep, 'code' | 'from' | 'state' | 'time' | 'order'> = {},
): DiagnosticStep => ({
  code,
  from,
  state,
  ...fields,
  time: Date.now(),
  order: performance.timeOrigin + performance.now(),
})

export const waitingSteps = (steps: DiagnosticStep[]) => {
  const settled = new Set(
    steps.flatMap(step => (step.settles ? [scope(step.pageId, step.settles)] : [])),
  )
  return steps.filter(step => step.waits && !settled.has(scope(step.pageId, step.waits.for)))
}

const stepKey = (step: DiagnosticStep) =>
  `${step.pageId ?? ''}:${step.code}:${step.lookup ?? ''}:${step.settles ?? ''}`

const history = (accountId: string, index: string, prefix: (string | number)[] = []) =>
  wsdb.diagnostics
    .where(index)
    .between([accountId, ...prefix, Dexie.minKey], [accountId, ...prefix, Dexie.maxKey], true, true)
    .reverse()

const saveRecord = async (record: DiagnosticRecord, previous?: DiagnosticRecord) => {
  record.firstIssue = record.steps.filter(isDiagnosticIssue).sort((a, b) => a.order - b.order)[0]
  record.issueAt = record.firstIssue?.order
  record.exceptional = record.firstIssue ? 1 : 0
  record.completed = record.finished && !waitingSteps(record.steps).length ? 1 : 0
  await wsdb.diagnostics.put(record)

  if (!record.completed || (previous?.completed && previous.exceptional === record.exceptional))
    return
  const overflow = await history(record.accountId, '[accountId+completed+exceptional+startedAt]', [
    1,
    record.exceptional,
  ])
    .offset(record.exceptional ? HISTORY_LIMIT.exceptional : HISTORY_LIMIT.ordinary)
    .primaryKeys()
  await wsdb.diagnostics.bulkDelete(overflow)
}

interface DiagnosticUpdate {
  finished?: true
  measurement?: RttMeasurement
  existingOnly?: true
  recoveryAt?: number
}

export const recordDiagnostic = (
  identity: DiagnosticIdentity,
  steps: DiagnosticStep[],
  update: DiagnosticUpdate = {},
) =>
  wsdb.transaction('rw', wsdb.diagnostics, async () => {
    const previous = await wsdb.diagnostics.get(identity.id)
    if (previous ? previous.accountId !== identity.accountId : update.existingOnly) return

    const merged = new Map(previous?.steps.map(step => [stepKey(step), step]))
    for (const step of steps) {
      const key = stepKey(step)
      if (!merged.has(key)) merged.set(key, step)
    }
    await saveRecord(
      {
        ...previous,
        ...identity,
        steps: [...merged.values()],
        finished: previous?.finished || !!update.finished,
        measurement: previous?.measurement ?? update.measurement,
        recoveryAt: previous?.recoveryAt ?? update.recoveryAt,
        completed: 0,
        exceptional: 0,
      },
      previous,
    )
  })

export const recoverDiagnostics = (accountId: string, ids: string[], time: number) =>
  wsdb.transaction('rw', wsdb.diagnostics, async () => {
    const records = await wsdb.diagnostics.bulkGet(ids)
    await wsdb.diagnostics.bulkPut(
      records.flatMap(record =>
        record?.accountId === accountId && record.exceptional && record.recoveryAt === undefined
          ? [{ ...record, recoveryAt: time }]
          : [],
      ),
    )
  })

export const trackDiagnosticSession = (id: string) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  void navigator.locks?.request(`${SESSION_LOCK_PREFIX}${id}`, () => promise).catch(() => {})
  return resolve
}

export const liveDiagnosticSessions = async () => {
  const locks = await navigator.locks?.query().catch(() => undefined)
  if (!locks) return undefined
  return new Set(
    locks.held?.flatMap(({ name }) =>
      name?.startsWith(SESSION_LOCK_PREFIX) ? [name.slice(SESSION_LOCK_PREFIX.length)] : [],
    ),
  )
}

const settleDiagnosticSessions = (
  accountId: string,
  matches: (wait: DiagnosticStep) => boolean,
  normal: boolean,
) =>
  wsdb.transaction('rw', wsdb.diagnostics, async () => {
    const records = (
      await Promise.all(
        [0, 1].map(exceptional =>
          history(accountId, '[accountId+completed+exceptional+startedAt]', [
            0,
            exceptional,
          ]).toArray(),
        ),
      )
    ).flat()
    for (const record of records) {
      const endings = waitingSteps(record.steps)
        .filter(matches)
        .map(step =>
          diagnosticStep(
            normal ? 'session-ended' : 'interrupted',
            step.waits?.for === 'parse' ? 'worker' : step.from,
            normal ? 'ended' : 'interrupted',
            {
              pageId: step.pageId,
              reason: normal ? 'session-ended' : 'session-lost',
              settles: step.waits?.for,
            },
          ),
        )
      if (endings.length)
        await saveRecord(
          { ...record, finished: true, steps: [...record.steps, ...endings] },
          record,
        )
    }
  })

export const endDiagnosticSession = (accountId: string, sessionId: string, normal: boolean) =>
  settleDiagnosticSessions(accountId, step => step.waits?.owner === sessionId, normal)

export const interruptStaleDiagnostics = async (accountId: string) => {
  const startedAt = Date.now()
  const sessions = await liveDiagnosticSessions()
  const cutoff = startedAt - (sessions ? 1000 : STALE_WAIT_LIMIT)
  await settleDiagnosticSessions(
    accountId,
    step => step.time < cutoff && !!step.waits && !sessions?.has(step.waits.owner),
    false,
  )
}

export const recentDiagnostics = (accountId: string, limit: number) =>
  history(accountId, '[accountId+startedAt]').limit(limit).toArray()

export const latestDiagnosticIssue = (accountId: string) =>
  history(accountId, '[accountId+issueAt]').first()

export const latestDiagnosticMeasurement = async (accountId: string) => {
  const record = await history(accountId, '[accountId+kind+startedAt]', ['rtt'])
    .filter(record => !!record.measurement)
    .first()
  return record?.measurement
}

export const latestSuccessfulMeasurement = async (accountId: string) => {
  const record = await history(accountId, '[accountId+kind+startedAt]', ['rtt'])
    .filter(record => record.measurement?.outcome === 'success')
    .first()
  return record?.measurement
}
