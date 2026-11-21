import type { BridgeErrorInfo, ErrorCode } from './types'

/** 错误码说明，用于 help / manifest */
export const ERROR_CODE_DESCRIPTIONS: Record<ErrorCode, string> = {
  E_UNKNOWN_COMMAND: '命令不存在',
  E_INVALID_PARAMS: '参数校验失败',
  E_FORBIDDEN: '只读模式调用写命令，或当前账号无业务权限',
  E_UNKNOWN_SURFACE: '页面句柄不存在',
  E_UNSUPPORTED: '页面句柄/表单不支持该动作',
  E_UNAVAILABLE: '页面组件未挂载、未登录或当前地图任务阻塞',
  E_NOT_FOUND: '点位、资源或表单不存在',
  E_BUSY: '已有同表单提交或对话框忙碌',
  E_TIMEOUT: '等待事件、等待空闲或打开句柄超时',
  E_DOMAIN: '业务或网络错误',
  E_INTERNAL: '桥接内部异常',
}

/** 桥接统一异常 */
export class MapAiError extends Error {
  readonly code: ErrorCode

  readonly details?: unknown

  readonly hint?: string

  constructor(
    code: ErrorCode,
    message: string,
    options: { details?: unknown; hint?: string } = {},
  ) {
    super(message)
    this.name = 'MapAiError'
    this.code = code
    this.details = options.details
    this.hint = options.hint
  }
}

/** 将任意异常转为可序列化错误信息 */
export const toErrorInfo = (error: unknown): BridgeErrorInfo => {
  if (error instanceof MapAiError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
      ...(error.hint === undefined ? {} : { hint: error.hint }),
    }
  }

  if (error instanceof Error) {
    return {
      code: 'E_DOMAIN',
      message: error.message || '未知业务错误',
    }
  }

  return {
    code: 'E_INTERNAL',
    message: typeof error === 'string' ? error : '未知异常',
  }
}

/** 断言工具，便于命令中快速抛错 */
export function fail(
  code: ErrorCode,
  message: string,
  options?: { details?: unknown; hint?: string },
): never {
  throw new MapAiError(code, message, options)
}
