/** 服务线程相关的类型 */
declare namespace AppServiceWorker {
  /** 缓存库元信息 */
  interface CacheMeta {
    /**
     * 缓存库名称
     * @example 'tiles-twt40'
     */
    name: string | null
    /**
     * 缓存库类型
     * @example 'image'、'font'、'audio'、'video'
     */
    type: string | null
    /**
     * 缓存库版本
     * @example 1
     */
    version: number | null
    /**
     * 缓存库模式
     * @example 'cors'、'no-cors'、'same-origin'、'navigate'
     */
    mode: RequestMode | null
  }

  // oxlint-disable-next-line typescript/consistent-type-definitions
  type EventMap = {
    log: {
      args: [type: 'info' | 'error', message: string]
    }
  }
}
