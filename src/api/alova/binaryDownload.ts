export type BinaryDownloadListener = (loaded: number, total?: number) => void

/** 在消费响应正文时上报字节数，保留原始内容供解压和校验。 */
export function observeBinaryDownload(response: Response, report: BinaryDownloadListener) {
  if (!response.body) return response

  const length = Number(response.headers.get('Content-Length'))
  const encoding = response.headers.get('Content-Encoding')
  // HTTP 压缩时，响应头记录的是传输大小，响应流读取的是解压后的字节。
  const total =
    (!encoding || encoding.toLowerCase() === 'identity')
    && Number.isSafeInteger(length)
    && length > 0
      ? length
      : undefined
  let loaded = 0
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength
        report(loaded, loaded <= (total ?? 0) ? total : undefined)
        controller.enqueue(chunk)
      },
    }),
  )
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}
