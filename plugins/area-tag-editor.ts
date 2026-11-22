import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TLSSocket } from 'node:tls'

type AreaTag = [string, [number, number], (0 | 1 | 2)?]

interface AreaTagUpdate {
  areaCode: string
  before: AreaTag[]
  tags: AreaTag[]
}

const editorPath = '/__map_area_tags'
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const maxRequestBytes = 256 * 1024

const isLocalRequest = (request: IncomingMessage): boolean => {
  const host = request.headers.host ?? ''
  const protocol = request.socket instanceof TLSSocket ? 'https' : 'http'
  return (
    localAddresses.has(request.socket.remoteAddress ?? '')
    && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
    && request.headers.origin === `${protocol}://${host}`
  )
}

const isAreaTagList = (value: unknown): value is AreaTag[] =>
  Array.isArray(value)
  && value.every(tag => {
    if (!Array.isArray(tag) || (tag.length !== 2 && tag.length !== 3)) return false
    const [text, position, level] = tag
    return (
      typeof text === 'string'
      && text.trim().length > 0
      && Array.isArray(position)
      && position.length === 2
      && position.every(Number.isFinite)
      && (tag.length === 2 || level === 0 || level === 1 || level === 2)
    )
  })

const isAreaTagUpdate = (value: unknown): value is AreaTagUpdate => {
  if (!value || typeof value !== 'object') return false
  const { areaCode, before, tags } = value as Record<string, unknown>
  return (
    typeof areaCode === 'string'
    && areaCode.length <= 128
    && /^[A-Z]:[A-Z]+(?::[\w-]+)*$/i.test(areaCode)
    && isAreaTagList(before)
    && isAreaTagList(tags)
  )
}

const formatTag = ([text, [x, y], level]: AreaTag) =>
  `[${JSON.stringify(text)}, [${x}, ${y}]${level === undefined ? '' : `, ${level}`}]`

const formatAreaTags = (data: Record<string, AreaTag[]>) => {
  const entries = Object.entries(data).map(([code, tags]) => {
    const key = JSON.stringify(code)
    const tuples = tags.map(formatTag)
    if (tuples.length <= 1) return `  ${key}: [${tuples.join('')}]`
    return `  ${key}: [\n    ${tuples.join(',\n    ')}\n  ]`
  })
  return `{\n${entries.join(',\n')}\n}\n`
}

const saveAreaTags = (file: string, { areaCode, before, tags }: AreaTagUpdate) => {
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, AreaTag[]>
  if (JSON.stringify(data[areaCode] ?? []) !== JSON.stringify(before)) return false
  data[areaCode] = tags

  // 在同一目录写好完整配置后替换，Vite 和文件读取方始终只看到完整内容。
  const temporaryFile = `${file}.${randomUUID()}.tmp`
  try {
    writeFileSync(temporaryFile, formatAreaTags(data), { encoding: 'utf8', flag: 'wx' })
    renameSync(temporaryFile, file)
  } finally {
    rmSync(temporaryFile, { force: true })
  }
  return true
}

const reply = (response: ServerResponse, status: number, message?: string) => {
  response.statusCode = status
  response.setHeader('Cache-Control', 'no-store')
  if (message) response.setHeader('Content-Type', 'text/plain; charset=utf-8')
  response.end(message)
}

export const areaTagEditor = (): Plugin => ({
  name: 'map-area-tag-editor',
  apply: (_, { command, isPreview }) => command === 'serve' && !isPreview,
  config: () => ({
    define: { 'import.meta.env.AREA_TAG_EDITOR': JSON.stringify(editorPath) },
  }),
  configureServer(server) {
    const file = resolve(server.config.root, 'src/configs/areaTags.json')
    server.middlewares.use(async (request, response, next) => {
      if (request.url !== editorPath) return next()
      if (request.method !== 'POST') return reply(response, 405, '请使用 POST 保存标签')
      if (!isLocalRequest(request)) {
        return reply(response, 403, '请在本机通过 localhost 或 127.0.0.1 打开开发页面后保存')
      }
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
        return reply(response, 415, '请选择 JSON 格式提交')
      }

      let body: unknown
      try {
        let input = ''
        request.setEncoding('utf8')
        for await (const chunk of request.iterator({ destroyOnReturn: false })) {
          input += chunk
          if (Buffer.byteLength(input) > maxRequestBytes) {
            request.resume()
            return reply(response, 413, '标签数据超出大小限制')
          }
        }
        body = JSON.parse(input)
      } catch {
        return reply(response, 400, '无法读取标签数据')
      }
      if (!isAreaTagUpdate(body)) return reply(response, 400, '标签数据格式无效')

      try {
        // 读取、校验和替换在同一次同步操作完成，避免同一开发服务器上的保存相互覆盖。
        if (!saveAreaTags(file, body)) {
          return reply(response, 409, '该地区的标签已更新，请取消后重新选择')
        }
        return reply(response, 204)
      } catch (error) {
        server.config.logger.error(`[地区标签] ${String(error)}`)
        return reply(response, 500, '标签配置写入失败，请查看开发服务器日志')
      }
    })
  },
})
