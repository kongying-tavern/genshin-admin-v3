const FILE_HEADER_MAP: Record<number, string> = {
  0x89504e47: 'image/png',
  ...Object.fromEntries(
    Array.from({ length: 16 }).map((_, i) => [
      0xffd8ffe0 + i,
      'image/jpeg', // 包含 jpeg 的 16 种不同组件开头
    ]),
  ),
  0x47494638: 'image/gif',
  0x424d: 'image/bmp',
  0x52494646: 'RIFF', // 可能是 webp 的部分头，需要进一步判断
}

/* oxlint-disable no-labels */

/**
 * 读取文件头来判断文件类型
 * @todo 目前只支持 (png, jpg, bmp, webp)
 */
export const getFileType = async (file: Blob) => {
  const readLength = 16 // 读取文件前 16 个字节

  const dataView = new DataView(new ArrayBuffer(readLength))

  const stream = file.stream()
  const reader = stream.getReader()

  fill: {
    let bytesRead = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done || !value) break
      const chunk = new Uint8Array(value)
      for (const byte of chunk) {
        if (bytesRead >= readLength) break fill
        dataView.setUint8(bytesRead++, byte)
      }
    }
  }

  reader.releaseLock()

  const bigEndianSign = dataView.getUint32(0, false)
  const secondKey = dataView.getUint32(8, false)

  const type = FILE_HEADER_MAP[bigEndianSign] ?? 'unknown'

  if (type === 'RIFF') {
    return (
      {
        0x57454250: 'image/webp',
      }[secondKey] ?? 'unknown'
    )
  }

  return type
}
