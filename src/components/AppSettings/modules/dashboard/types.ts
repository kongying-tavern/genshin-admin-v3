export interface StorageEstimateExpand extends StorageEstimate {
  /** 用量详情，目前仅在 Chromium 内核浏览器下可用 */
  usageDetails?: {
    caches?: number
    indexedDB?: number
    serviceWorkerRegistrations?: number
  }
}

export interface UsageItem {
  name: string
  value: number
  percentage: number
  text: string
}
