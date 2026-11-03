import type { Ref } from 'vue'
import { WorkerInterval } from '@/utils'

/**
 * 每秒更新剩余时间
 * @param targetTime 目标时间的时间戳
 */
export const useRestTime = (targetTime: Ref<number | undefined>) => {
  const restTime = ref(0)
  const id = crypto.randomUUID()

  tryOnUnmounted(() => {
    WorkerInterval.clear(id)
  })

  watch(
    targetTime,
    () => {
      WorkerInterval.clear(id)
      WorkerInterval.set(
        id,
        () => {
          restTime.value =
            targetTime.value === undefined ? 0 : targetTime.value - new Date().getTime()
        },
        1000,
      )
    },
    { immediate: true },
  )

  return { restTime }
}
