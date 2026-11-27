let directory
let handleLimit = 0
const handles = new Map()

function closeHandles() {
  for (const { handle } of handles.values()) handle.close()
  handles.clear()
}

async function openHandle(fileName) {
  const file = await directory.getFileHandle(fileName)
  const handle = await file.createSyncAccessHandle()
  try {
    return { handle, size: handle.getSize() }
  } catch (error) {
    handle.close()
    throw error
  }
}

async function readTile(fileName) {
  const started = performance.now()
  let entry = handles.get(fileName)
  const opened = !entry

  if (entry) {
    // Map 的插入顺序用来淘汰最久未访问的句柄。
    handles.delete(fileName)
    handles.set(fileName, entry)
  } else {
    if (handleLimit > 0 && handles.size === handleLimit) {
      const [oldest, oldEntry] = handles.entries().next().value
      oldEntry.handle.close()
      handles.delete(oldest)
    }
    entry = await openHandle(fileName)
    if (handleLimit > 0) handles.set(fileName, entry)
  }

  let buffer
  try {
    buffer = new ArrayBuffer(entry.size)
    if (entry.handle.read(buffer, { at: 0 }) !== buffer.byteLength) {
      throw new Error('瓦片读取不完整')
    }
  } finally {
    if (handleLimit === 0) entry.handle.close()
  }
  return { buffer, opened, workerMs: performance.now() - started }
}

self.addEventListener('message', async ({ data }) => {
  try {
    switch (data.type) {
      case 'configure':
        closeHandles()
        directory = data.directory
        handleLimit = data.handleLimit
        self.postMessage({ ok: true })
        break
      case 'read': {
        const result = await readTile(data.fileName)
        self.postMessage({ ok: true, ...result }, [result.buffer])
        break
      }
      case 'close':
        closeHandles()
        directory = undefined
        self.postMessage({ ok: true })
        break
    }
  } catch (error) {
    self.postMessage({ ok: false, error: error.message })
  }
})
