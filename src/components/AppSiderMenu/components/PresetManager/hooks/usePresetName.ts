const PRESET_NAME_REGEX = /^[^\\/:*?"'<>|]*$/u

/**
 * 预设名称的受控状态管理
 *
 * 接收一个 MaybeRef 数据源，读取其初始值交由 controlledRef 做受控拦截；
 * 拦截非法字符 / 首字符为点 / 首尾空格，且对外始终暴露空字符串
 * 而非 null / undefined，保证下游拿到非空字符串类型的数据。
 */
export const usePresetName = (source: MaybeRef<string | null> = '') => {
  const rawName = controlledRef<string | null>(unref(source) ?? '', {
    onBeforeChange: value => {
      if (!value) return true
      return (
        PRESET_NAME_REGEX.test(value)
        && !value.startsWith('.')
        && value.trim().length === value.length
      )
    },
  })

  return refDefault<string>(rawName, '')
}
