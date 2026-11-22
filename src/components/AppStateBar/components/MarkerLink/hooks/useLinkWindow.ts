import { Subject } from 'rxjs'
import { useAppWindow } from '@/components'
import { useAccessStore } from '@/stores/access'

interface LinkWindowHookOptions {
  loading: Ref<boolean>
}

export const useLinkWindow = (options: LinkWindowHookOptions) => {
  const { loading } = options

  const close$ = new Subject<void>()
  const accessStore = useAccessStore()

  const window = useAppWindow({
    key: 'markerLink',
    name: '点位关联',
    minWidth: 580,
    enabled: () => accessStore.get('MARKER_LINK'),
    beforeClose: () => !loading.value,
    onClosed: () => close$.next(),
  })

  onUnmounted(() => close$.complete())
  return { ...window, close$ }
}
