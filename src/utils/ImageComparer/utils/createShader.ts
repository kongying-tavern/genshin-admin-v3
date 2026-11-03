export const createShader = (gl: WebGL2RenderingContext, code: string, type: number) => {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('无法创建 shader 实例')

  gl.shaderSource(shader, code)
  gl.compileShader(shader)

  const log = gl.getShaderInfoLog(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    throw new Error(`COMPILE ${log}`)
  }

  return shader
}
