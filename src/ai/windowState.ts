import type { MapWindow } from '@/components/AppWindow/types'
import { watch } from 'vue'

export const watchWindowNames = (
  windows: MapWindow.Reader,
  emit: (payload: { names: string[] }) => void,
) =>
  watch(windows.names, (names, previous) => {
    if (names.length !== previous.length || names.some((name, index) => name !== previous[index])) {
      emit({ names })
    }
  })
