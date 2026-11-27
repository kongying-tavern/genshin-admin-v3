const controls = document.querySelector('#controls')
const environment = document.querySelector('#environment')
const status = document.querySelector('#status')
const table = document.querySelector('#table-wrap')
const results = document.querySelector('#results')

function seededRandom(seed) {
  let state = seed
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function shuffle(values, seed) {
  const order = values.slice()
  const random = seededRandom(seed)
  for (let index = order.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    ;[order[index], order[other]] = [order[other], order[index]]
  }
  return order
}

function createCanvas(size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('无法创建瓦片样本画布')
  return context
}

function createTileGenerator() {
  const texture = createCanvas(128)
  const tile = createCanvas(256)
  tile.imageSmoothingEnabled = false
  const image = texture.createImageData(128, 128)

  return async index => {
    const random = seededRandom(index + 1)
    for (let y = 0; y < image.height; y++) {
      const band = Math.sin(y / 17 + index / 13) * 20
      for (let x = 0; x < image.width; x++) {
        const offset = (y * image.width + x) * 4
        const height = band + Math.cos(x / 18 + index / 17) * 20 + random() * 32
        const shade = Math.floor(height)
        image.data[offset] = 104 + shade
        image.data[offset + 1] = 136 + shade
        image.data[offset + 2] = 116 + shade
        image.data[offset + 3] = 255
      }
    }
    texture.putImageData(image, 0, 0)
    tile.drawImage(texture.canvas, 0, 0, 256, 256)
    const blob = await new Promise(resolve => tile.canvas.toBlob(resolve, 'image/png'))
    if (!blob || blob.size === 0) throw new Error('无法编码瓦片样本')
    return blob
  }
}

function waitForControl(workers, scriptUrl) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      workers.removeEventListener('controllerchange', check)
      reject(new Error('等待基准 Service Worker 接管页面超时'))
    }, 10000)
    function check() {
      if (workers.controller?.scriptURL !== scriptUrl.href) return
      clearTimeout(timeout)
      workers.removeEventListener('controllerchange', check)
      resolve()
    }
    workers.addEventListener('controllerchange', check)
    check()
  })
}

async function seedTiles({ tileCount, runId, directory, cache }) {
  const tiles = []
  const generate = createTileGenerator()
  for (let index = 0; index < tileCount; index++) {
    const blob = await generate(index)
    const name = `${index}.png`
    const url = new URL(`cached/${runId}/${name}`, location.href)
    const file = await directory.getFileHandle(name, { create: true })
    const writable = await file.createWritable()
    try {
      await writable.write(blob)
      await writable.close()
    } catch (error) {
      await writable.abort().catch(() => {})
      throw error
    }
    await cache.put(url, new Response(blob))
    tiles.push({ name, url, size: blob.size })
  }
  return tiles
}

function send(worker, request) {
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.ok) resolve(data)
      else reject(new Error(data.error))
    }
    worker.onerror = event => reject(new Error(event.message || '无法启动 OPFS Worker'))
    worker.onmessageerror = () => reject(new Error('无法接收 OPFS Worker 的数据'))
    worker.postMessage(request)
  })
}

function quantile(samples, proportion) {
  const sorted = samples.slice().sort((a, b) => a - b)
  const position = (sorted.length - 1) * proportion
  const lower = Math.floor(position)
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower)
}

function timerResolution() {
  let previous = performance.now()
  let smallest = Infinity
  for (let index = 0; index < 20000; index++) {
    const now = performance.now()
    if (now > previous) smallest = Math.min(smallest, now - previous)
    previous = now
  }
  return Number.isFinite(smallest) ? `${(smallest * 1000).toFixed(1)} µs` : '未测得'
}

async function measureRound(read, order) {
  const started = performance.now()
  const latencies = []
  let workerMs = 0
  let openedHandles = 0
  for (const tile of order) {
    const tileStarted = performance.now()
    const result = await read(tile)
    latencies.push(performance.now() - tileStarted)
    if (result.buffer.byteLength !== tile.size) throw new Error(`瓦片读取不完整（${tile.name}）`)
    workerMs += result.workerMs ?? 0
    openedHandles += Number(result.opened ?? false)
  }
  return { duration: performance.now() - started, latencies, workerMs, openedHandles }
}

function showMeasurement(mode, access, samples, tileCount, bytesPerRound) {
  const duration = quantile(
    samples.map(sample => sample.duration),
    0.5,
  )
  const latencies = samples.flatMap(sample => sample.latencies)
  const cells = [
    mode.name,
    access,
    duration.toFixed(2),
    ...[0.5, 0.95, 0.99].map(proportion => (quantile(latencies, proportion) * 1000).toFixed(1)),
    duration > 0 ? (bytesPerRound / 1024 ** 2 / (duration / 1000)).toFixed(1) : '—',
    mode.prepare
      ? (
          (quantile(
            samples.map(sample => sample.workerMs),
            0.5,
          )
            * 1000)
          / tileCount
        ).toFixed(1)
      : '—',
    mode.prepare ? samples.reduce((sum, sample) => sum + sample.openedHandles, 0) : '—',
  ]
  const row = results.insertRow()
  for (const cell of cells) row.insertCell().textContent = cell
  table.hidden = false
}

async function readResponse(response) {
  if (!response?.ok) throw new Error('瓦片缓存未命中')
  return { buffer: await response.arrayBuffer() }
}

function createModes({ cache, directory, handleLimit, worker }) {
  const readInWorker = tile => send(worker, { type: 'read', fileName: tile.name })
  return [
    {
      name: 'Service Worker → Cache API',
      read: async tile => readResponse(await fetch(tile.url, { cache: 'no-store' })),
    },
    {
      name: 'OPFS 异步（复用目录句柄）',
      read: async tile => {
        const handle = await directory.getFileHandle(tile.name)
        const file = await handle.getFile()
        return { buffer: await file.arrayBuffer() }
      },
    },
    {
      name: `OPFS 同步（Worker，最多复用 ${handleLimit} 个句柄）`,
      prepare: () => send(worker, { type: 'configure', directory, handleLimit }),
      read: readInWorker,
    },
    {
      name: 'OPFS 同步（Worker，每次打开）',
      prepare: () => send(worker, { type: 'configure', directory, handleLimit: 0 }),
      read: readInWorker,
    },
    {
      name: 'Cache API 直读',
      read: async tile => readResponse(await cache.match(tile.url)),
    },
  ]
}

async function benchmark({ tileCount, rounds, handleLimit }) {
  if (!isSecureContext || !navigator.serviceWorker || !navigator.storage?.getDirectory) {
    throw new Error('需要支持 Service Worker 和 OPFS 的浏览器及安全上下文')
  }
  const runId = crypto.randomUUID()
  const storageName = `tile-cache-bench-${runId}`
  const workers = navigator.serviceWorker
  const scriptUrl = new URL('./cache.worker.mjs', import.meta.url)
  const root = await navigator.storage.getDirectory()
  const registration = await workers.register(scriptUrl, { type: 'module' })
  let worker
  let benchmarkError

  try {
    await waitForControl(workers, scriptUrl)
    const directory = await root.getDirectoryHandle(storageName, { create: true })
    const cache = await caches.open(storageName)
    const tiles = await seedTiles({ tileCount, runId, directory, cache })
    const sizes = tiles.map(tile => tile.size)
    const bytesPerRound = sizes.reduce((sum, size) => sum + size, 0)
    const byteRange = `${Math.min(...sizes)}–${Math.max(...sizes)} B`
    environment.textContent = `${navigator.userAgent} | 安全上下文 ${isSecureContext} | 跨源隔离 ${crossOriginIsolated} | 页面计时器步长约 ${timerResolution()} | ${tileCount} 张 256 × 256 PNG，单张 ${byteRange}，每轮 ${(bytesPerRound / 1024).toFixed(1)} KiB，共 ${rounds} 轮`

    worker = new Worker(new URL('./opfs.worker.mjs', import.meta.url), { type: 'module' })
    const randomOrders = Array.from({ length: rounds + 1 }, (_, index) => shuffle(tiles, index + 1))
    const modes = createModes({ cache, directory, handleLimit, worker })
    for (const mode of modes) {
      for (const [access, orders] of [
        ['顺序', Array(rounds + 1).fill(tiles)],
        ['随机', randomOrders],
      ]) {
        status.textContent = `正在读取 ${mode.name} · ${access}`
        await mode.prepare?.()
        const [warmup, ...measuredOrders] = orders
        await measureRound(mode.read, warmup)
        const samples = []
        for (const order of measuredOrders) samples.push(await measureRound(mode.read, order))
        showMeasurement(mode, access, samples, tileCount, bytesPerRound)
      }
    }
    await send(worker, { type: 'close' })
  } catch (error) {
    benchmarkError = error
  } finally {
    worker?.terminate()
  }

  const cleanup = await Promise.allSettled([
    caches.delete(storageName),
    root.removeEntry(storageName, { recursive: true }),
    registration.unregister(),
  ])
  const errors = cleanup.filter(
    result => result.status === 'rejected' && result.reason?.name !== 'NotFoundError',
  )
  if (errors.length) {
    throw new AggregateError(
      errors.map(result => result.reason),
      '清理基准数据失败',
      {
        cause: benchmarkError,
      },
    )
  }
  if (benchmarkError) throw benchmarkError
}

async function run() {
  status.dataset.state = 'running'
  status.textContent = '正在准备样本并写入两种缓存…'
  environment.textContent = ''
  results.replaceChildren()
  table.hidden = true
  const options = {
    tileCount: document.querySelector('#tiles').valueAsNumber,
    rounds: document.querySelector('#rounds').valueAsNumber,
    handleLimit: document.querySelector('#handles').valueAsNumber,
  }
  for (const element of controls.elements) element.disabled = true
  try {
    await benchmark(options)
    status.dataset.state = 'done'
    status.textContent = '测试完成，临时缓存已清理。'
  } catch (error) {
    status.dataset.state = 'error'
    status.textContent = `测试失败（${error.message}）`
  } finally {
    for (const element of controls.elements) element.disabled = false
  }
}

controls.addEventListener('submit', event => {
  event.preventDefault()
  void run()
})
const query = new URLSearchParams(location.search)
for (const name of ['tiles', 'rounds', 'handles']) {
  if (query.has(name)) document.getElementById(name).value = query.get(name)
}
if (query.get('autorun') === '1') controls.requestSubmit()
