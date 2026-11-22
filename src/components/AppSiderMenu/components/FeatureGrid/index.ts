import type { WindowContextHookReturnType } from '@/components'
import type { useAccessStore } from '@/stores'

export { default as FeatureGrid } from './FeatureGrid.vue'

export interface FeatureOption {
  label: string
  icon: Component
  cb: (event: MouseEvent) => void
  hook?: WindowContextHookReturnType
  role?: Parameters<ReturnType<typeof useAccessStore>['get']>['0']
  cols?: number
  isOpen?: boolean
}

export interface FeatureGroupOption {
  label?: string
  items: FeatureOption[]
}
