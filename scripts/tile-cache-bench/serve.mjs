import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/bench.mjs', ['bench.mjs', 'text/javascript; charset=utf-8']],
  ['/cache.worker.mjs', ['cache.worker.mjs', 'text/javascript; charset=utf-8']],
  ['/opfs.worker.mjs', ['opfs.worker.mjs', 'text/javascript; charset=utf-8']],
])

const server = createServer(async (request, response) => {
  const path = request.url?.split('?')[0]
  const file = files.get(path)
  if (request.method !== 'GET' || !file) {
    response.writeHead(404).end()
    return
  }

  try {
    const [name, type] = file
    const body = await readFile(new URL(name, import.meta.url))
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body)
  } catch (error) {
    console.error(error)
    response.writeHead(500).end()
  }
})

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`http://127.0.0.1:${server.address().port}/\n`)
})
