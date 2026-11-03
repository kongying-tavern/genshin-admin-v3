import { WorkerInterval } from '@/utils'

export const useCountDown = () => {
  const count = ref(0)

  const id = crypto.randomUUID()

  const set = (newCount: number) => {
    count.value = newCount

    WorkerInterval.clear(id)

    WorkerInterval.set(
      id,
      () => {
        count.value -= 1
      },
      1000,
    )
  }

  onUnmounted(() => {
    WorkerInterval.clear(id)
  })

  return { count, set }
}
