import type { Ref } from 'vue'
import type { MapWindow } from '../types'

const hasArea = (rect?: MapWindow.Rect): rect is MapWindow.Rect =>
  Boolean(rect && rect.width > 0 && rect.height > 0)

const transformTo = (base: MapWindow.Rect, target: MapWindow.Rect) => {
  const x = target.x - base.x
  const y = target.y - base.y
  const scaleX = target.width / base.width
  const scaleY = target.height / base.height
  if (x === 0 && y === 0 && scaleX === 1 && scaleY === 1) return 'none'
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`
}

export const useWindowMotion = (
  panel: Ref<HTMLElement | undefined>,
  getState: () => MapWindow.SizeState | undefined,
  takeTaskRect: () => DOMRect | undefined,
) => {
  const leaving = ref(false)
  let animation: Animation | undefined
  let revision = 0

  const cancel = () => {
    revision += 1
    animation?.cancel()
    animation = undefined
    leaving.value = false
  }

  watch(getState, (state, previous) => {
    const hiding = state === 'minimize'
    const restoring = previous === 'minimize'
    const taskOrigin = restoring ? takeTaskRect() : undefined
    const element = panel.value
    if (
      !element
      || typeof element.animate !== 'function'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      cancel()
      return
    }

    const visual = element.getBoundingClientRect()
    const first = hasArea(visual) ? visual : taskOrigin
    const opacity = animation ? Number(getComputedStyle(element).opacity || '1') : restoring ? 0 : 1
    cancel()
    const currentRevision = revision
    leaving.value = hiding

    // Vue 先提交一次真实布局，再用变换从原来的视觉位置过渡。
    void nextTick(() => {
      if (currentRevision !== revision || !element.isConnected) return
      const base = element.getBoundingClientRect()
      const last = hiding ? takeTaskRect() : base
      if (!hasArea(base) || !hasArea(last)) {
        leaving.value = false
        return
      }
      const from = transformTo(base, hasArea(first) ? first : base)
      const to = transformTo(base, last)
      if (!hiding && !restoring && from === to) return

      const playing = element.animate(
        [
          { transform: from, opacity },
          { transform: to, opacity: hiding ? 0 : 1 },
        ],
        {
          duration: hiding ? 190 : 240,
          easing: hiding ? 'cubic-bezier(.45, 0, .3, 1)' : 'cubic-bezier(.2, .75, .2, 1)',
          fill: 'both',
        },
      )
      animation = playing
      const finish = async () => {
        if (animation !== playing) return
        leaving.value = false
        await nextTick()
        if (animation === playing) cancel()
      }
      void playing.finished.then(finish, finish)
    })
  })

  onBeforeUnmount(cancel)
  return { leaving, cancel }
}
