import type { ComputedRef } from 'vue'
import type { Mission, MissionTypeMap } from '@/packages/map'
import { Subject } from 'rxjs'

// ============================== ↓ 共享地址而不是使用闭包，以避免订阅过多时导致的卡顿问题 ↓ ==============================
type MissionTypeKey = keyof MissionTypeMap

type UpdateFunction<K extends MissionTypeKey> = (value: MissionTypeMap[K] | null) => void

type UpdateByFunction<K extends MissionTypeKey> = (
  cb: (oldData: MissionTypeMap[K], setter: (newData: MissionTypeMap[K] | null) => void) => void,
) => void

interface MissionSubscriber<K extends MissionTypeKey> {
  start$: Subject<MissionTypeMap[K]>
  end$: Subject<void>
  isEmpty: Readonly<Ref<boolean>>
  isEnable: Readonly<Ref<boolean>>
  isProcessing: Readonly<Ref<boolean>>
  data: Ref<MissionTypeMap[K]>
  update: UpdateFunction<K>
  updateBy: UpdateByFunction<K>
  clear: () => void
}

// ============================== ↑ 共享地址而不是使用闭包，以避免订阅过多时导致的卡顿问题 ↑ ==============================

export const useMapMission = () => {
  const mission = ref<Mission | null>(null)

  const cache = shallowRef(new Map<string, unknown>())

  /** 清除当前任务并通知所有已注册类型的订阅者 */
  const clearAll = () => {
    if (!mission.value) return
    mission.value = null
    // 遍历所有已创建的订阅者，统一触发结束事件，
    // 确保无论当前任务类型是否匹配，各订阅者的 end$ / clearEventHook 都能被触发，
    // 避免因竞态导致任务状态残留。
    cache.value.forEach(subscriber => {
      const s = subscriber as {
        end$: Subject<void>
        clearEventHook: ReturnType<typeof createEventHook<void>>
      }
      s.end$.next()
      s.clearEventHook.trigger()
    })
  }

  /** 仅限不关注任务类型的情况下调用 */
  const setMission = (newMission: Mission | null) => {
    if (newMission === null) {
      clearAll()
      return
    }
    // 若当前已有任务，先通知结束再切换，避免旧任务订阅者状态残留
    if (mission.value) clearAll()
    mission.value = newMission
  }

  /** 关注某一任务类型的情况下，必须通过该 API 进行任务更新操作 */
  const subscribeMission = <K extends MissionTypeKey>(
    type: K,
    getDefaultValue: () => MissionTypeMap[K],
  ): MissionSubscriber<K> => {
    if (!cache.value.has(type)) {
      cache.value.set(
        type,
        (() => {
          const data = computed(() => {
            if (mission.value?.type !== type) return getDefaultValue()
            return mission.value.value
          }) as ComputedRef<MissionTypeMap[K]>

          const start$ = new Subject<MissionTypeMap[K]>()
          const end$ = new Subject<void>()

          const isEmpty = computed(() => !mission.value)
          /** 是否可以进行任务设置（包括任务为空） */
          const isEnable = computed(() => !mission.value || mission.value.type === type)

          /** 是否正在处理指定为 type 类型的任务 */
          const isProcessing = computed(() => mission.value?.type === type)

          const clearEventHook = createEventHook<void>()

          const update: UpdateFunction<K> = (value: MissionTypeMap[K] | null) => {
            if (value === null) {
              // 统一走 clearAll 路径，确保所有订阅者都能收到结束通知
              clearAll()
              return
            }
            if (mission.value && mission.value.type !== type) return
            if (!mission.value) start$.next(value)
            mission.value = { type, value } as Mission
          }

          /** 有时候需要在确保某种类型的任务更新后才执行某些操作 */
          const updateBy: UpdateByFunction<K> = (
            cb: (
              oldData: MissionTypeMap[K],
              setter: (newData: MissionTypeMap[K] | null) => void,
            ) => void,
          ) => {
            if (mission.value?.type !== type) return
            cb(data.value as MissionTypeMap[K], newData => {
              update(newData)
            })
          }

          const clear = () => {
            // 统一走 update(null) 路径，保证与 setMission(null) / update(null) 行为一致
            update(null)
          }

          return {
            start$,
            end$,
            isEmpty,
            isEnable,
            isProcessing,
            data,
            clearEventHook,
            update,
            updateBy,
            clear,
          }
        })(),
      )
    }
    return cache.value.get(type)! as MissionSubscriber<K>
  }

  return {
    mission,
    setMission,
    subscribeMission,
  }
}
