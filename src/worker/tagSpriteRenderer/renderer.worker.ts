import type { Logger } from '@/utils/logger'
import { CacheDexie } from '@/database/db/cache'
import { useLoggerWorker } from '@/hooks/useWorkerLogger'
import { getDigest } from '@/utils/getDigest'
import { getObjectFitSize } from '@/utils/getObjectFitSize'
import { limitPromiseAll } from '@/utils/limitPromiseAll'
import UnknownIcon from '/icons/unknown.webp?inline'

declare const globalThis: DedicatedWorkerGlobalScope

const cacheDb = new CacheDexie()

const CACHE_VERSION = 1

export interface WorkerInput {
  /** 需要被渲染的图标列表 */
  iconList: {
    /** 图标 id */
    id: number
    /** 图标资源地址 */
    src: string
  }[]
  /** 图标尺寸 @default 64 */
  size?: number
  /** 图标之间的空隙，用于避免精度误差导致的重叠 */
  gap?: number
  /** 并发请求限制 @default 10 */
  maxRequests?: number
}

interface RenderObject {
  ids: number[]
  image: ImageBitmap
}

export type WorkerSuccessOutput = DBType.IconSprite

/** 主线程接收数据 */
export type WorkerOutput =
  | string // 错误原因
  | WorkerSuccessOutput

/** 计算最佳布局 */
const calculateGrid = (length: number) => {
  const cols = Math.sqrt(length)
  const rows = Number.isInteger(cols) ? cols : Math.floor(cols) + 1
  return {
    cols: rows,
    rows,
  }
}

/** 将图片加载为 `ImageBitmap` */
const loadImage = async (src: string) => {
  return fetch(src, { mode: 'cors', method: 'GET' })
    .then(res => res.blob())
    .then(blob => createImageBitmap(blob))
}

/** 核心渲染逻辑 */
const render = async (params: WorkerInput, logger: Logger): Promise<WorkerSuccessOutput> => {
  const { iconList, size = 64, gap = 2, maxRequests = 10 } = params

  logger.info('渲染图标列表', { iconList })

  if (!Number.isInteger(size) || size < 0)
    throw new Error('图标尺寸必须为大于 0 的整数。此外，出于渲染效果的考虑，不建议尺寸小于 32。')

  /** 基于排序后的 iconList 生成签名用于校验缓存 */
  const digest = await getDigest(
    new TextEncoder().encode(
      JSON.stringify(iconList.toSorted(({ id: idA }, { id: idB }) => idA - idB)),
    ).buffer,
    'SHA-256',
  )

  /** 检查缓存是否可用 */
  const cache = await (async () => {
    try {
      const cacheIconSprite = await cacheDb.iconSprite.get(digest)
      if (!cacheIconSprite || cacheIconSprite.version !== CACHE_VERSION) {
        // 缓存不存在或版本不匹配，清空旧缓存
        await cacheDb.iconSprite.clear().catch(() => {})
        logger.warn('没有可用的图标预渲染纹理缓存')
        return
      }
      return cacheIconSprite
    } catch (err) {
      // 数据库操作失败（如 reopen），不清空缓存
      logger.warn(
        err instanceof Error ? err.message : `Can't get icon cache cause: ${JSON.stringify(err)}`,
      )
    }
  })()

  if (cache) {
    logger.info('缓存有效，跳过渲染')
    return cache
  }

  // 备用图片
  const fallbackImage = await loadImage(UnknownIcon)

  // ==================== url 去重 ====================

  /** 【图标 src】到【图标 ids】的映射 */
  const idsMap = (() => {
    const map = new Map<string, number[]>()
    const { length } = iconList
    for (let i = 0; i < length; i++) {
      const { id, src } = iconList[i]
      if (!map.has(src)) map.set(src, [])
      map.get(src)!.push(id)
    }
    return map
  })()

  const fetchList: { ids: number[]; url: string }[] = []
  idsMap.forEach((ids, url) => {
    fetchList.push({ ids, url })
  })

  // ==================== 图片请求 ====================

  const fallbackRenderObject: RenderObject = {
    ids: [],
    image: fallbackImage,
  }

  logger.info('请求图片...')
  const renderList = await limitPromiseAll(
    fetchList,
    async ({ ids, url }) => {
      try {
        const image = await loadImage(url)
        return {
          image,
          ids,
        } satisfies RenderObject
      } catch {
        // 对于请求失败的图标使用 fallback 图片所在的位置
        fallbackRenderObject.ids.push(...ids)
        return null
      }
    },
    {
      maxRequests,
      initResult: [fallbackRenderObject],
    },
  )

  logger.info('检测重复图片...')

  // ==================== 绘制矩阵 ====================

  const { cols, rows } = calculateGrid(renderList.length)
  const canvasSize = cols * (size + gap) + gap
  const canvas = new OffscreenCanvas(canvasSize, canvasSize)
  const ctx = canvas.getContext('2d')!

  const positionList: WorkerSuccessOutput['positionList'] = []

  logger.info('正在绘制...')
  renderList.forEach(({ ids, image }, index) => {
    const row = Math.floor(index / rows)
    const col = index - row * cols
    const x = col * size + (col + 1) * gap
    const y = row * size + (row + 1) * gap
    const { sx, sy, sw, sh, dx, dy, dw, dh } = getObjectFitSize(
      'contain',
      size,
      size,
      image.width,
      image.height,
    )
    ctx.drawImage(image, sx, sy, sw, sh, x + dx, y + dy, dw, dh)
    positionList.push({
      ids,
      pos: [x, y],
    })
  })

  const texture = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
  logger.info('绘制结果', { byteLength: texture.byteLength })

  await cacheDb.iconSprite.put({
    version: CACHE_VERSION,
    digest,
    positionList,
    texture,
  })

  return {
    digest,
    texture,
    positionList,
  }
}

/** 负载接收 */
globalThis.addEventListener('message', async (ev: MessageEvent<WorkerInput>) => {
  const { send, logger } = useLoggerWorker<WorkerInput, WorkerOutput>(ev, '图标渲染')

  try {
    const res = await render(ev.data, logger)
    send(res, [res.texture])
  } catch (err) {
    logger.error(err instanceof Error ? err.message : `${err}`)
    send(err instanceof Error ? err.message : `${err}`)
  }
})
