/** 隐藏标记枚举 */
export enum HiddenFlagEnum {
  /** 显示 */
  SHOW = 0,
  /** 隐藏 */
  HIDDEN = 1,
  /** 测试 */
  BETA = 2,
  /** 彩蛋 */
  EASTER = 3,
}

export const HIDDEN_FLAG_NAME_MAP: Record<string, string> = {
  [HiddenFlagEnum.SHOW]: '显示',
  [HiddenFlagEnum.HIDDEN]: '隐藏',
  [HiddenFlagEnum.BETA]: '测试',
  [HiddenFlagEnum.EASTER]: '彩蛋',
}

/** hidden flag 选项 */
export const HIDDEN_FLAG_OPTIONS: {
  label: string
  /** 枚举值，可用于权限判断 */
  value: number
}[] = Object.entries(HIDDEN_FLAG_NAME_MAP).map(([key, value]) => ({
  label: value,
  value: Number(key),
}))
