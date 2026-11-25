import type { BinaryDownloadListener } from '@/api/alova/binaryDownload'
import 'alova'

declare module 'alova' {
  export interface AlovaCustomTypes {
    meta?: {
      /**
       * 是否不进行数据解析，当指定为 `raw: true` 时，
       * 以 Response 对象返回，由调用方读取正文（使用 fetch 适配器时有效）
       */
      raw?: boolean
      /** 读取原始响应时上报已接收字节和可用的总字节数。 */
      onBinaryDownload?: BinaryDownloadListener
    }
  }
}
