import { WorkerInterval } from '@/utils/WorkerInterval'

/** 实时刷新的当前时间（秒精度） */
export const now = ref(new Date().getTime())

WorkerInterval.set(
  'second-clock',
  () => {
    now.value = new Date().getTime()
  },
  1000,
)
