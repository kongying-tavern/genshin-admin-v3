/**
 * 用户中心卡片背景的绘制类
 *
 * @implements {IPaintClass}
 */
class UserCardBorder {
  static get inputProperties() {
    return ['--paint-padding']
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   */
  drawPart(ctx) {
    ctx.fillStyle = '#D5C5B3'
    ctx.beginPath()
    ctx.moveTo(0, 5)
    ctx.arcTo(0, 0, 5, 0, 5)
    ctx.lineTo(32, 0)
    ctx.arcTo(36, 0, 32, 4, 2)
    ctx.lineTo(26, 10)
    ctx.arcTo(23.5, 12.5, 21, 10, 3.5355)
    ctx.lineTo(17, 6)
    ctx.arcTo(11.5, 0.5, 6, 6, 7.7782)
    ctx.arcTo(0.5, 11.5, 6, 17, 7.7782)
    ctx.lineTo(10, 21)
    ctx.arcTo(12.5, 23.5, 10, 26, 3.5355)
    ctx.lineTo(4, 32)
    ctx.arcTo(0, 36, 0, 32, 2)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(11.5, 7)
    ctx.arcTo(11.5, 11.5, 16, 11.5, 4.5)
    ctx.arcTo(11.5, 11.5, 11.5, 16, 4.5)
    ctx.arcTo(11.5, 11.5, 7, 11.5, 4.5)
    ctx.arcTo(11.5, 11.5, 11.5, 7, 4.5)
    ctx.closePath()
    ctx.fill()
  }

  /**
   * @param {PaintRenderingContext2D} ctx
   * @param {PaintSize} size
   * @param {StylePropertyMapReadOnly} properties
   */
  paint(ctx, size, properties) {
    const { width, height } = size
    const padding = Number(properties.get('--paint-padding'))

    ctx.fillStyle = '#F0EBE3'
    ctx.fillRect(0 + padding, 0 + padding, width - 2 * padding, height - 2 * padding)

    //      xmino xmini         xmaxi xmaxo
    // ymino       ptl ---------- ptr
    // ymini  plt                      prt
    //         |                        |
    //         |                        |
    // ymaxi  plb                      prb
    // ymaxo       pbl ---------- pbr

    const xmino = 6 + padding
    const xmini = 22 + padding
    const xmaxo = width - 6 - padding
    const xmaxi = width - 22 - padding
    const ymino = 6 + padding
    const ymini = 22 + padding
    const ymaxo = height - 6 - padding
    const ymaxi = height - 22 - padding

    ctx.moveTo(xmini, ymino)
    ctx.lineTo(xmaxi, ymino)
    ctx.moveTo(xmaxo, ymini)
    ctx.lineTo(xmaxo, ymaxi)
    ctx.moveTo(xmaxi, ymaxo)
    ctx.lineTo(xmini, ymaxo)
    ctx.moveTo(xmino, ymaxi)
    ctx.lineTo(xmino, ymini)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#DFD2C0'
    ctx.stroke()

    ctx.fillStyle = '#D5C5B3'
    const angle = Math.PI / 2
    this.drawPart(ctx)
    ;[width, height, width].forEach(tx => {
      ctx.translate(tx, 0)
      ctx.rotate(angle)
      this.drawPart(ctx)
    })
  }
}

registerPaint?.('user-card-border', UserCardBorder)
