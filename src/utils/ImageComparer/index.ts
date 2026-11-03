import FS_SOURCE from './shaders/ssim.fs.glsl?raw'
import VS_SOURCE from './shaders/ssim.vs.glsl?raw'
import { createProgram, createShader } from './utils'

export interface ImageComparerOptions {
  width: number
  height: number
}

export class ImageComparer {
  constructor(options: ImageComparerOptions) {
    const { width, height } = options

    const canvas = new OffscreenCanvas(width | 0, height | 0)
    const gl = canvas.getContext('webgl2')!

    const vs = createShader(gl, VS_SOURCE, gl.VERTEX_SHADER)
    const fs = createShader(gl, FS_SOURCE, gl.FRAGMENT_SHADER)

    const program = createProgram(gl, vs, fs)
    gl.useProgram(program)

    gl.clearColor(0, 0, 0, 1)

    Object.keys(this.#uniform).forEach(key => {
      this.#uniform[key] = gl.getUniformLocation(program, key)
    })

    const POSITIONS = new Float32Array([
      // 2×2 顶点矩阵，每 4 个分量描述一个顶点（x, y, u, v）
      -1, +1, 0, 1, -1, -1, 0, 0, +1, +1, 1, 1, +1, -1, 1, 0,
    ])
    const FSIZE = Float32Array.BYTES_PER_ELEMENT
    const STRIDE = FSIZE * 4

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, POSITIONS, gl.STATIC_DRAW)

    this.#attribute.reduce((offset, { name, type, size }) => {
      const location = gl.getAttribLocation(program, name)
      gl.vertexAttribPointer(location, size, gl[type] as number, false, STRIDE, offset)
      gl.enableVertexAttribArray(location)
      return offset + FSIZE * size
    }, 0)

    this.#gl = gl
  }

  #gl: WebGL2RenderingContext

  #vertexCount = 4

  #attribute: {
    name: string
    type: keyof WebGL2RenderingContext
    size: number
    offset?: number
  }[] = [
    { name: 'instancePosition', type: 'FLOAT', size: 2 },
    { name: 'instanceTexCoord', type: 'FLOAT', size: 2 },
  ]

  #uniform = {
    u_imageA: null as WebGLUniformLocation | null,
    u_imegaB: null as WebGLUniformLocation | null,
  } as Record<string, WebGLUniformLocation | null>

  #textures = new Set<WebGLTexture>()

  /** 使用 SSIM 算法比较两张图片，返回相似度。相似度被归一为数值 0 ~ 1，数值越接近 1 则两张图片越相似。 */
  compare = (imageA: TexImageSource, imageB: TexImageSource) => {
    const gl = this.#gl

    this.#draw(gl, imageA, imageB)

    const { width, height, pixels } = this.#draw(gl, imageA, imageB)

    let sum = 0
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i] / 255

    return {
      pixels,
      similarity: sum / (width * height),
    }
  }

  #clear = (gl: WebGL2RenderingContext) => {
    this.#textures.forEach(texture => gl.deleteTexture(texture))
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  #setTexture = (
    gl: WebGL2RenderingContext,
    image: TexImageSource,
    location: WebGLUniformLocation | null,
    unit: number,
  ) => {
    const texture = gl.createTexture()!
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    gl.uniform1i(location, unit)
    this.#textures.add(texture)
  }

  #draw = (gl: WebGL2RenderingContext, imageA: TexImageSource, imageB: TexImageSource) => {
    this.#clear(gl)

    const { drawingBufferWidth, drawingBufferHeight } = gl

    const { u_imageA, u_imegaB } = this.#uniform

    this.#setTexture(gl, imageA, u_imageA, 0)
    this.#setTexture(gl, imageB, u_imegaB, 1)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.#vertexCount)

    const length = drawingBufferWidth * drawingBufferHeight * 4
    const pixels = new Uint8Array(length)
    gl.readPixels(0, 0, drawingBufferWidth, drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    return { width: drawingBufferWidth, height: drawingBufferHeight, pixels }
  }
}
