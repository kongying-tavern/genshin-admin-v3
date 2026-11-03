/**
 * 暗色卡片背景的绘制类
 *
 * @implements {IPaintClass}
 */
class DarkCardBorder {
  /**
   * @param {number} w
   * @param {number} h
   */
  #getInternalBorderPath(w, h) {
    const path = new Path2D(`
      M 28.5 28.5
      Q 28.5 17.5 39.5 17.5
      L ${w - 39.5} 17.5
      Q ${w - 28.5} 17.5 ${w - 28.5} 28.5
      Q ${w - 17.5} 28.5 ${w - 17.5} 39.5
      L ${w - 17.5} ${h - 39.5}
      Q ${w - 17.5} ${h - 28.5} ${w - 28.5} ${h - 28.5}
      Q ${w - 28.5} ${h - 17.5} ${w - 39.5} ${h - 17.5}
      L 39.5 ${h - 17.5}
      Q 28.5 ${h - 17.5} 28.5 ${h - 28.5}
      Q 17.5 ${h - 28.5} 17.5 ${h - 39.5}
      L 17.5 39.5
      Q 17.5 28.5 28.5 28.5
      Z
    `)
    return path
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   */
  #drawCorner(ctx) {
    ctx.shadowBlur = 2
    ctx.shadowColor = '#FCDAB3'

    ctx.fillStyle = '#FCF1B3'
    ctx.fill(new Path2D('M 0 6 Q 0 0 6 0 L 27 0 L 31 4 Q 4 4 4 31 L 0 27 Z'))

    ctx.fillStyle = '#EDB577E0'
    ctx.fill(new Path2D('M 4 31L 4 14Q 4 4 14 4L 31 4Q 4 4 4 31Z'))

    ctx.fillStyle = '#FCF1B3'
    ctx.fill(
      new Path2D(
        'M 8.5 8.5 L 17.5 12.5 L 26.5 8.5 L 22.5 17.5 L 26.5 26.5 L 17.5 22.5 L 8.5 26.5 L 12.5 17.5 Z',
      ),
    )
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   * @param {PaintSize} size
   */
  paint(ctx, size) {
    const { width, height } = size

    ctx.beginPath()
    ctx.roundRect(8, 8, width - 16, height - 16, 24)
    ctx.closePath()
    ctx.fillStyle = '#393E52'
    ctx.fill()

    ctx.beginPath()
    ctx.roundRect(13, 13, width - 26, height - 26, 11)
    ctx.closePath()
    ctx.fillStyle = '#3E4556'
    ctx.fill()

    const path = this.#getInternalBorderPath(width, height)
    ctx.strokeStyle = '#4B4F59'
    ctx.lineWidth = 2
    ctx.stroke(path)

    const angle = Math.PI / 2
    ;[width, height, width, height].forEach(tx => {
      ctx.translate(tx, 0)
      ctx.rotate(angle)
      this.#drawCorner(ctx)
    })
  }
}

registerPaint?.('dark-card-border', DarkCardBorder)
