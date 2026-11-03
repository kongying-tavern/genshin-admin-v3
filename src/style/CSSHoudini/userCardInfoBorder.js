/**
 * 用户中心左侧信息部分的卡片背景绘制类
 *
 * @implements {IPaintClass}
 */
class UserCardInfoBorder {
  /**
   * @param {PaintRenderingContext2D} ctx
   */
  drawAddonCorner(ctx) {
    ctx.fillStyle = '#E4D8C1'
    ctx.beginPath()
    ctx.moveTo(4, 4)
    ctx.lineTo(28, 4)
    ctx.arcTo(23.6712, 5.5209, 19.8104, 8, 39.2173)
    ctx.lineTo(8, 8)
    ctx.lineTo(8, 19.8104)
    ctx.arcTo(5.5209, 23.6712, 4, 28, 39.2173)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(12, 9)
    ctx.lineTo(13, 11)
    ctx.lineTo(15, 12)
    ctx.lineTo(15, 12)
    ctx.lineTo(13, 13)
    ctx.lineTo(12, 15)
    ctx.lineTo(11, 13)
    ctx.lineTo(11, 13)
    ctx.lineTo(9, 12)
    ctx.lineTo(11, 11)
    ctx.closePath()
    ctx.fill()
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   * @param {PaintSize} size
   */
  paint(ctx, size) {
    const { width, height } = size

    ctx.fillStyle = '#F0EBE3'
    ctx.fillRect(0, 0, width, height)
    ctx.roundRect(6, 6, width - 12, height - 12, 37)
    ctx.strokeStyle = '#E4D8C1'
    ctx.lineWidth = 4
    ctx.stroke()

    const angle = Math.PI / 2
    ;[width, height, width, height].forEach(tx => {
      ctx.translate(tx, 0)
      ctx.rotate(angle)
      this.drawAddonCorner(ctx)
    })
  }
}

registerPaint?.('user-card-info-border', UserCardInfoBorder)
