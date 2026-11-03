import { EventBus } from '@/utils/EventBus'

export interface LoggerOptions {
  dateTimeColor?: string
  labelBackground?: string
  labelColor?: string
  port?: MessagePort
}

export type LogType = 'info' | 'warn' | 'error'

export interface LogInfo {
  label: string
  isWorker: boolean
  type: LogType
  timestamp: number
  args: unknown[]
  options: LoggerOptions
}

export interface LoggerEvents {
  log: [LogInfo]
  register: [label: string]
}

/**
 * # Logger
 * 开发模式下在命令行打印信息
 * @param label {string} 日志注册名，该项会被动态的加入到【设置→开发者设置→日志可见性】项中，请慎重取名
 * @param options {LoggerOptions} 日志配置
 */
export class Logger {
  #label: string
  #options: LoggerOptions

  static #isInit = false

  static get isInit() {
    return this.#isInit
  }

  static loggerLabelsCache = new Set<string>()
  static logsCache: LogInfo[] = []

  static init = () => {
    this.#isInit = true
    this.loggerLabelsCache.clear()
    this.logsCache = []
  }

  static getPrefix = (label: string, number: number) => {
    const now = new Date(number).toLocaleString('zh-CN', { hour12: false })
    return `%c[${now}]%c${label}`
  }

  static #stringifyStyle = (style: Record<string, string>) => {
    return Object.entries(style)
      .map(([key, value]) => `${key}:${value}`)
      .join(';')
  }

  static getStyle = (options: LoggerOptions, isWorker = false): string[] => {
    const {
      dateTimeColor = 'green',
      labelBackground = isWorker ? 'linear-gradient(90deg, #A0F1F2, #FCE8E8)' : '#393B40',
      labelColor = isWorker ? '#362F36' : '#DEBC60',
    } = options
    return [
      this.#stringifyStyle({
        color: dateTimeColor,
      }),
      this.#stringifyStyle({
        background: labelBackground,
        color: labelColor,
        padding: '0.25em 0.5em',
        margin: '0 4px',
        'border-radius': '2px',
      }),
    ]
  }

  static event = new EventBus<LoggerEvents>()

  constructor(label = '', options: LoggerOptions = {}) {
    this.#label = label
    this.#options = options

    Logger.isInit ? Logger.event.emit('register', label) : Logger.loggerLabelsCache.add(label)
  }

  #stdoutCache = ''
  stdout = {
    write: (char: string) => {
      this.#stdoutCache += char
    },
    print: () => {
      this.info(this.#stdoutCache)
      this.#stdoutCache = ''
    },
  }

  #log =
    (type: LogType) =>
    (...args: unknown[]) => {
      const timestamp = Date.now()

      const { port, ...rest } = this.#options

      const isWorker = Object.prototype.toString.call(globalThis) !== '[object Window]'

      const logInfo: LogInfo = {
        label: this.#label,
        isWorker,
        type,
        timestamp,
        args: [
          Logger.getPrefix(this.#label, timestamp),
          ...Logger.getStyle(this.#options, isWorker),
          ...args,
        ],
        options: rest,
      }

      if (port) {
        port.postMessage(logInfo)
        return
      }

      Logger.isInit ? Logger.event.emit('log', logInfo) : Logger.logsCache.push(logInfo)
    }

  info = this.#log('info')

  warn = this.#log('warn')

  error = this.#log('error')
}
