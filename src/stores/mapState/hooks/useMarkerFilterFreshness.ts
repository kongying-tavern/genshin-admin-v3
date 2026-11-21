import type { GSMarkerInfo } from '@/packages/map'
import { visitMarkerIdChunks } from '@/stores/utils/fetchMarkersByIds'
import { sleep } from '@/utils/sleep'

interface MarkerFilterFreshnessOptions {
  enabled: () => boolean
  selection: () => string
  online: () => boolean
  candidates: () => GSMarkerInfo[]
  verify: (ids: number[], signal: AbortSignal) => Promise<ReadonlyMap<number, unknown>>
}

interface FilterCheck {
  key: string
  controller: AbortController
  confirmed: Set<number>
  failed: Set<number>
  loading: Ref<boolean>
}

export function useMarkerFilterFreshness(options: MarkerFilterFreshnessOptions) {
  const refreshCount = ref(0)
  const refresh = () => refreshCount.value++
  const key = computed(() =>
    options.enabled()
      ? JSON.stringify([options.selection(), options.online(), refreshCount.value])
      : undefined,
  )
  const run = shallowRef<FilterCheck>()
  const active = computed(() => (run.value?.key === key.value ? run.value : undefined))
  const candidates = computed(options.candidates)

  const unchecked = (check: FilterCheck) =>
    candidates.value.filter(({ id }) => !check.confirmed.has(id!) && !check.failed.has(id!))

  async function verify(check: FilterCheck) {
    const { signal } = check.controller
    let consecutiveFailures = 0
    try {
      // 基础筛选连续勾选时只核对最终组合。
      await sleep(160)
      while (!signal.aborted) {
        const ids = unchecked(check)
          .map(({ id }) => id!)
          .sort((a, b) => b - a)
        if (!ids.length) break
        await visitMarkerIdChunks(
          ids,
          async chunk => {
            // 连续失败时停止派发请求，保留其它已完成分片。
            if (consecutiveFailures >= 3) {
              chunk.forEach(id => check.failed.add(id))
              return
            }
            try {
              const confirmed = await options.verify(chunk, signal)
              if (signal.aborted) return
              consecutiveFailures = 0
              confirmed.forEach((_, id) => check.confirmed.add(id))
              if (confirmed.size < chunk.length) {
                const remaining = new Set(candidates.value.map(({ id }) => id))
                chunk.forEach(id => {
                  if (!confirmed.has(id) && remaining.has(id)) check.failed.add(id)
                })
              }
            } catch {
              if (signal.aborted) return
              consecutiveFailures++
              chunk.forEach(id => check.failed.add(id))
            }
          },
          { signal, concurrency: 3 },
        )
      }
    } catch (error) {
      if (!signal.aborted) throw error
    } finally {
      check.loading.value = false
    }
  }

  const schedule = (check: FilterCheck) => {
    if (!options.online() || check.loading.value || !unchecked(check).length) return
    check.loading.value = true
    void verify(check)
  }

  const retry = () => {
    const check = active.value
    if (!check || check.loading.value) return
    check.failed.clear()
    schedule(check)
  }

  watch(
    [key, candidates],
    ([key]) => {
      if (run.value?.key !== key) {
        run.value?.controller.abort()
        run.value =
          key === undefined
            ? undefined
            : {
                key,
                controller: new AbortController(),
                confirmed: shallowReactive(new Set<number>()),
                failed: shallowReactive(new Set<number>()),
                loading: ref(false),
              }
      }
      if (run.value) schedule(run.value)
    },
    { immediate: true },
  )
  onScopeDispose(() => run.value?.controller.abort())

  return {
    markers: computed(() => {
      if (!options.enabled()) return candidates.value
      const confirmed = active.value?.confirmed
      return confirmed?.size ? candidates.value.filter(({ id }) => confirmed.has(id!)) : []
    }),
    loading: computed(() => active.value?.loading.value ?? false),
    failed: computed(() => candidates.value.some(({ id }) => active.value?.failed.has(id!))),
    offline: computed(() => options.enabled() && !options.online() && candidates.value.length > 0),
    refresh,
    retry,
  }
}
