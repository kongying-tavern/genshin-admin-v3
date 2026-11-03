import { upperFirst } from 'lodash'

/**
 * 标准键盘 key 值 (美式 104 键布局)
 * @note 请注意与 code 进行区分
 * @note 所有 key 值都需要转换为全小写
 */
export const STANDARD_KEYBOARD_KEYS = new Set<string>([
  /** Esc (1) */
  'escape',

  /** F1 ~ F12 (12) */
  ...Array.from({ length: 12 }).map((_, i) => `f${++i}`),

  /** 中上功能键 (3) */
  // 'PrintScreen', // 无法触发, 未验证
  'scrolllock',
  'pause',

  /** 主键区第 1 行 (14) */
  '`',
  ...Array.from({ length: 10 }).map((_, i) => `${++i % 10}`),
  '-',
  '=',
  'backspace',

  /** 主键区第 2 行 (14) */
  'tab',
  'q',
  'w',
  'e',
  'r',
  't',
  'y',
  'u',
  'i',
  'o',
  'p',
  '[',
  ']',
  '\\',

  /** 主键区第 3 行 (13) */
  'capslock',
  'a',
  's',
  'd',
  'f',
  'g',
  'h',
  'j',
  'k',
  'l',
  ';',
  "'",
  'enter',

  /** 主键区第 4 行 (12) */
  'shift',
  'z',
  'x',
  'c',
  'v',
  'b',
  'n',
  'm',
  ',',
  '.',
  '/',
  'shift',

  /** 主键区第 5 行 (8) */
  'control',
  'meta',
  'alt',
  ' ',
  // 'Fn', // 无法触发, 未验证
  'alt',
  'meta',
  'control',

  /** 中间功能区 (6) */
  'insert',
  'home',
  'pageup',
  'delete',
  'end',
  'pagedown',

  /** 方向键区 (4) */
  'arrowup',
  'arrowleft',
  'arrowdown',
  'arrowright',

  /** 小键盘区 (17) */
  'numlock',
  '/',
  '*',
  '-',
  '7',
  '8',
  '9',
  '+',
  '4',
  '5',
  '6',
  '1',
  '2',
  '3',
  'enter',
  '0',
  '.',
])

/**
 * 键盘 key 值的别名
 */
export const KEYBOARD_ALIAS = new (class KeyboardAlias extends Map<string, string> {
  private alias = new Map([
    ['control', 'Ctrl'],
    [' ', 'Space'],
    ['scrolllock', 'ScrollLock'],
    ['capslock', 'CapsLock'],
    ['numlock', 'NumLock'],
    ['pageup', 'PageUp'],
    ['pagedown', 'PageDown'],
    ['arrowup', 'ArrowUp'],
    ['arrowleft', 'ArrowLeft'],
    ['arrowdown', 'ArrowDown'],
    ['arrowright', 'ArrowRight'],
  ])

  get = (key: string) => {
    return this.alias.get(key) ?? upperFirst(key)
  }
})()

/** 不能用于快捷键结尾的 key 值 */
export const CONTROL_KEYS = new Set(['control', 'shift', 'alt'])
