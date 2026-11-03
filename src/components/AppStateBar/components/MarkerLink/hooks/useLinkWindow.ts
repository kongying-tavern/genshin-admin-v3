import { Subject } from 'rxjs'
import { useAppWindow } from '@/components'

interface LinkWindowHookOptions {
  loading: Ref<boolean>
}

export const useLinkWindow = (options: LinkWindowHookOptions) => {
  const { loading } = options

  const open$ = new Subject<void>()
  const close$ = new Subject<void>()

  const { ...rest } = useAppWindow({
    name: '点位关联',
    minWidth: 580,
    beforeOpen: () => {
      open$.next()
      return true
    },
    beforeClose: () => {
      if (loading.value) return false
      close$.next()
      return true
    },
  })

  return {
    open$,
    close$,
    ...rest,
  }
}
