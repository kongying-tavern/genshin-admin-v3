/**
 * 地图左侧条形菜单绘制类
 *
 * @implements {IPaintClass}
 */
class MapSidebar {
  static get inputProperties() {
    return ['--border-width']
  }

  /** @type {[number, Path2D]} */
  #cachedIconPath = [0, new Path2D()]

  /**
   * @param {PaintRenderingContext2D} ctx
   * @param {number} w
   */
  #drawTopIcon = (ctx, w) => {
    ctx.fillStyle = '#37405080'

    const [cacheW, cachePath] = this.#cachedIconPath
    if (w === cacheW) {
      ctx.fill(cachePath)
      return
    }

    const path = new Path2D(`
      M 0 0
      L ${w} 0
      L ${w} ${0.4043 * w}
      A ${2.264637 * w} ${2.264637 * w} 0 0 0 ${0.5 * w} ${1.0975 * w}
      A ${2.264637 * w} ${2.264637 * w} 0 0 0 0 ${0.4043 * w}
      Z
      M 0 ${0.2152 * w}
      A ${2.405765 * w} ${2.405765 * w} 0 0 1 ${0.5 * w} ${0.7979 * w}
      A ${2.405765 * w} ${2.405765 * w} 0 0 1 ${w} ${0.2152 * w}
      L ${w} ${0.1105 * w}
      A ${2.486727 * w} ${2.486727 * w} 0 0 0 ${0.6299 * w} ${0.4758 * w}
      L ${0.5451 * w} ${0.391 * w}
      L ${0.5827 * w} ${0.3535 * w}
      A ${0.170213 * w} ${0.170213 * w} 0 0 0 ${0.5717 * w} ${0.1027 * w}
      L ${0.5 * w} ${0.0426 * w}
      L ${0.4283 * w} ${0.1027 * w}
      A ${0.170213 * w} ${0.170213 * w} 0 0 0 ${0.4173 * w} ${0.3535 * w}
      L ${0.4549 * w} ${0.391 * w}
      L ${0.3701 * w} ${0.4758 * w}
      A ${2.486727 * w} ${2.486727 * w} 0 0 0 0 ${0.1105 * w}
      Z
      M ${0.5 * w} ${0.1259 * w}
      L ${0.5307 * w} ${0.1516 * w}
      A ${0.106383 * w} ${0.106383 * w} 0 0 1 ${0.5375 * w} ${0.3084 * w}
      L ${0.5 * w} ${0.3459 * w}
      L ${0.4625 * w} ${0.3084 * w}
      A ${0.106383 * w} ${0.106383 * w} 0 0 1 ${0.4693 * w} ${0.1516 * w}
      Z
      M ${0.5 * w} ${0.4362 * w}
      L ${0.5898 * w} ${0.526 * w}
      A ${2.486727 * w} ${2.486727 * w} 0 0 0 ${0.5 * w} ${0.6489 * w}
      A ${2.486727 * w} ${2.486727 * w} 0 0 0 ${0.4102 * w} ${0.526 * w}
      Z
    `)
    ctx.fill(path)
    this.#cachedIconPath = [w, path]
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   * @param {PaintSize} size
   * @param {StylePropertyMapReadOnly} properties
   */
  paint(ctx, size, properties) {
    const { width: w, height: h } = size

    const borderWidth = Number(properties.get('--border-width')) || 2

    ctx.fillStyle = '#485163'
    ctx.fillRect(0, 0, w, h)
    this.#drawTopIcon(ctx, w)
    ctx.lineWidth = borderWidth
    ctx.strokeStyle = '#8F8779'
    ctx.strokeRect(borderWidth / 2, -borderWidth, w - borderWidth, h + 2 * borderWidth)
  }
}

registerPaint?.('map-sidebar', MapSidebar)
