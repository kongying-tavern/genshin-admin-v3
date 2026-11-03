export interface GSMessageProps {
  message: string
  /**
   * message 关闭前的等待时间
   * @min 1000
   */
  duration?: number
  /** 消息类型 */
  type?: 'info' | 'success' | 'warn' | 'error'
}

/** 全局消息提示，单例模式 */
export class GSMessageService {
  static #props = ref<GSMessageProps | null>(null)
  static get props() {
    return this.#props.value
  }

  static #visible = ref(false)
  static get visible() {
    return this.#visible.value
  }

  static close = () => {
    this.#visible.value = false
  }

  static info = (message: string, options: Omit<GSMessageProps, 'message'> = {}) => {
    this.close()
    this.#props.value = {
      message,
      ...options,
    }
    this.#visible.value = true
  }
}
