export const transitionToggleSchema = (x: number, y: number, handler: () => void) => {
  if (!document.startViewTransition) {
    return handler()
  }

  const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))

  const ratioX = (100 * x) / innerWidth
  const ratioY = (100 * y) / innerHeight
  const ratioR = (100 * endRadius) / Math.min(innerWidth, innerHeight)

  const transition = document.startViewTransition(handler)

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0% at ${ratioX}% ${ratioY}%)`,
          `circle(${ratioR}% at ${ratioX}% ${ratioY}%)`,
        ],
      },
      {
        duration: 400,
        easing: 'ease-in',
        pseudoElement: '::view-transition-new(schema-change)',
      },
    )
  })
}
