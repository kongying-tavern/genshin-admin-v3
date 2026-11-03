import type { ManagerModule } from '@/shared'
import { usePreferenceStore } from '@/stores'

export interface PaginationState {
  /** 总数 */
  total: number
  /** 当前页 */
  current: number
  /** 每页条数 */
  pageSize: number
  /** 每页条数的可选项 */
  sizes: number[]
}

/** el-pagination 的控制器单元 */
export enum PgUnit {
  SIZE = 'sizes',
  PREV = 'prev',
  PAGER = 'pager',
  NEXT = 'next',
  JUMPER = 'jumper',
  REST = '->',
  TOTAL = 'total',
  SLOT = 'slot',
}

export interface PaginationHookOptions {
  /** 初始化分页值 */
  init?: Partial<PaginationState>
  /** 分页布局元素，会按照顺序显示 */
  units?: PgUnit[]
  /** 分页所属的管理模块，如果提供此值，将会关联首选项中与当前模块相关的分页配置 */
  module?: ManagerModule
}

/**
 * ## 分页 hook
 *
 * ### 关于 module
 * 提供 module 参数，hook 提供的值将会对接到首选项设置，产生记忆能力。首选项值会覆盖 init 的相关字段。
 *
 * #### 1. `pageSize` 每页项目数
 * 该字段包括 4 个值，3 个固定值和一个自定义值，自定义值只能在设置面板中进行设置。
 * #### 2. 其他字段开发中...
 */
export const usePagination = (options: PaginationHookOptions = {}) => {
  const preferenceStore = usePreferenceStore()

  const pageSizeMap = computed(() => new Map(preferenceStore.pageSize))

  const {
    init: { current = 1, pageSize = 10, sizes = [10, 20, 30], total = 0 } = {},
    units = [PgUnit.TOTAL, PgUnit.SIZE, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT, PgUnit.JUMPER],
    module,
  } = options

  const defaultSizes = computed(() => new Set(sizes))

  const getModulePagination = (module?: ManagerModule): PaginationState => {
    if (!module) return { current, pageSize, sizes, total }
    const size = Number(pageSizeMap.value.get(module))
    return {
      current,
      pageSize: Number.isInteger(size) ? size : pageSize,
      sizes: Number.isInteger(size)
        ? !defaultSizes.value.has(size)
          ? sizes.concat(size)
          : sizes
        : sizes,
      total,
    }
  }

  const layout = computed(() => units.join(','))

  const pagination = ref<PaginationState>(getModulePagination(module))

  const changeEvent = createEventHook<PaginationState>()

  // 如果提供了 module，绑定相关分页参数到用户首选项
  if (module) {
    const internalUpdateFlag = ref(false)

    watch(
      () => pagination.value.pageSize,
      pageSize => {
        if (internalUpdateFlag.value) {
          internalUpdateFlag.value = false
          return
        }
        preferenceStore.pageSize = [...new Map(pageSizeMap.value).set(module, pageSize).entries()]
      },
      { deep: true },
    )

    watch(
      () => pageSizeMap.value.get(module),
      size => {
        if (size === undefined) return
        internalUpdateFlag.value = true
        pagination.value = getModulePagination(module)
      },
    )
  }

  watch(
    () => {
      const { current, pageSize } = toValue(pagination)
      return [current, pageSize]
    },
    () => {
      changeEvent.trigger(toValue(pagination))
    },
    { deep: true },
  )

  const pages = computed(() => Math.ceil(pagination.value.total / pagination.value.pageSize))

  const disabledNext = computed(() => pagination.value.current >= pages.value)

  const disabledPre = computed(() => pagination.value.current <= 1)

  const nextPage = () => {
    if (disabledNext.value) return
    pagination.value.current += 1
  }

  const prePage = () => {
    if (disabledPre.value) return
    pagination.value.current -= 1
  }

  return {
    pagination,
    pages,
    layout,
    disabledNext,
    disabledPre,
    nextPage,
    prePage,
    onChange: changeEvent.on,
  }
}
