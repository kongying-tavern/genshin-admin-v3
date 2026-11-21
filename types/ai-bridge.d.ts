import type { MapAiBridge } from '@/ai/types'

declare global {
  interface Window {
    /** AI 页面句柄与信息反射层，仅在启用时存在 */
    __MAP_AI__?: MapAiBridge
  }
}

export {}
