import type { Logger } from '@/utils/logger'
import SevenZip from '7z-wasm'
import { useLoggerWorker } from '@/hooks/useWorkerLogger'
import { formatByteSize } from '@/utils/formatByteSize'

export {}

declare const globalThis: DedicatedWorkerGlobalScope

export interface WorkerInput {
  type: 'compress' | 'decompress'
  data: Uint8Array
  wasm: ArrayBuffer
  name: string
}

export type WorkerSuccessOutput = Uint8Array | string

export type WorkerOutput = Uint8Array | string

/** 压缩文件 */
const compressFile = async (options: WorkerInput, logger: Logger): Promise<Uint8Array> => {
  const { data, wasm, name } = options

  const zip = await SevenZip({
    wasmBinary: wasm,
    stdout: code => logger.stdout.write(String.fromCharCode(code)),
  })

  const inputFilename = `${name}.bin`
  const stream = zip.FS.open(inputFilename, 'w+')
  zip.FS.write(stream, data, 0, data.length)
  zip.FS.close(stream)

  // 压缩，详细用法见 7-zip 命令行帮助
  zip.callMain(['a', '-tgzip', '-mx=9', '-y', name, inputFilename])

  const outputFilename = `${name}.gz`
  logger.info('已压缩', {
    file: inputFilename,
    outFile: outputFilename,
    size: formatByteSize(zip.FS.stat(outputFilename).size, { binary: true }),
  })

  const res = zip.FS.readFile(outputFilename)

  return res
}

/** 解压文件 */
const decompressFile = async (options: WorkerInput, logger: Logger): Promise<Uint8Array> => {
  const { data, wasm, name } = options

  const logs: string[] = []

  const zip = await SevenZip({
    wasmBinary: wasm,
    stdout: code => {
      const char = String.fromCharCode(code)
      logs.push(char)
    },
  })

  const inputFilename = `${name}.bin`
  const stream = zip.FS.open(inputFilename, 'w+')
  zip.FS.write(stream, data, 0, data.length)
  zip.FS.close(stream)

  // 解压，详细用法见 7-zip 命令行帮助
  zip.callMain(['x', `-o${name}`, '-y', inputFilename])

  const outputFilename = zip.FS.readdir(name).filter(name => name && !name.startsWith('.'))[0] ?? ''
  const outputFilepath = `${name}/${outputFilename}`

  logger.info('已解压', {
    file: inputFilename,
    outFile: outputFilename,
    size: formatByteSize(zip.FS.stat(outputFilepath).size, { binary: true }),
    logs: logs.join(''),
  })

  const res = zip.FS.readFile(outputFilepath)

  return res
}

globalThis.addEventListener('message', async (ev: MessageEvent<WorkerInput>) => {
  const { send, logger } = useLoggerWorker<WorkerInput, WorkerOutput>(ev, 'Zip')

  try {
    let res: Uint8Array
    switch (ev.data.type) {
      case 'compress':
        res = await compressFile(ev.data, logger)
        send(res, [res.buffer])
        break
      case 'decompress':
        res = await decompressFile(ev.data, logger)
        send(res, [res.buffer])
        break
    }
  } catch (err) {
    logger.error(err instanceof Error ? err.message : `${err}`)
    send(err instanceof Error ? err.message : `${err}`)
  }
})
