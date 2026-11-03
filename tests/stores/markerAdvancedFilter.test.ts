import type { MAFModelId } from '@/shared'
import type { useArchiveStore } from '@/stores'
import type { MAFGroup } from '@/stores/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useMarkerAdvancedFilter } from '@/stores/mapState/hooks/useMarkerAdvancedFilter/useMarkerAdvancedFilter'

/**
 * 单元测试：高级过滤器条目拖拽排序（`useMarkerAdvancedFilter.reorderMAFItems`）
 *
 * 对应 issue #139 的回归用例：
 * 条件项在组内拖动排序后，新顺序此前只停留在派生的 composed 副本上，
 * 未写回 advancedFilterCache，导致语义化文本不更新、
 * 切换逻辑关系后次序还原、仅顺序变化时无法点击【应用】。
 */

// 仅 mock store 模块本身：本用例只验证纯响应式逻辑，
// 同时避免 @/stores 索引把组件等重依赖拖进测试环境
vi.mock(
  '@/stores',
  () =>
    new Proxy(
      {},
      {
        get: (_target, key) => (key === '__esModule' ? true : () => ({})),
      },
    ),
)

// @/components 全量 barrel 会引入富文本编辑器等与用例无关的重依赖，
// 图标索引（@/components/AppIcons）本身很轻且被 MAF_MODEL_META_MAP 初始化取用，保持真实加载
vi.mock('@/components', () => ({}))

const createGroup = (): MAFGroup => ({
  key: 'group-1',
  operator: true,
  opposite: false,
  children: ['a', 'b', 'c'].map(key => ({
    id: 0 as MAFModelId,
    key,
    operator: true,
    opposite: false,
    value: {},
  })),
})

/** hook 内部存在模块级单例缓存，测试间通过整体替换 Preference 夹具来隔离状态 */
const archiveStore = reactive({
  currentArchive: {
    body: {
      Preference: {} as Record<string, MAFGroup[]>,
    },
  },
}) as unknown as ReturnType<typeof useArchiveStore>

let hook: ReturnType<typeof useMarkerAdvancedFilter>

beforeAll(() => {
  hook = useMarkerAdvancedFilter({ archiveStore })
})

beforeEach(() => {
  setActivePinia(createPinia())
  archiveStore.currentArchive.body.Preference = {
    'markerFilter.filter.advancedFilter': [createGroup()],
    'markerFilter.filter.advancedFilterCache': [createGroup()],
  }
})

describe('高级过滤器条目拖拽排序', () => {
  it('将组内条目的新顺序写回缓存，并同步到派生的 composed 结构', () => {
    hook.reorderMAFItems(0, ['c', 'a', 'b'])

    expect(hook.markerAdvancedFilters.value[0].children.map(({ key }) => key)).toEqual([
      'c',
      'a',
      'b',
    ])
    expect(hook.markerAdvancedComposed.value[0].children.map(({ key }) => key)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('仅顺序变化时，缓存与已应用条件产生差异（【应用】按钮可用）', () => {
    expect(hook.markerAdvancedSame.value).toBe(true)

    hook.reorderMAFItems(0, ['b', 'a', 'c'])

    expect(hook.markerAdvancedSame.value).toBe(false)
  })

  it('顺序未变化时不写回缓存', () => {
    const children = hook.markerAdvancedFilters.value[0].children

    hook.reorderMAFItems(0, ['a', 'b', 'c'])

    expect(hook.markerAdvancedFilters.value[0].children).toBe(children)
  })

  it('key 数量不匹配或包含未知 key 时不写回，避免丢失条目', () => {
    hook.reorderMAFItems(0, ['a', 'b'])
    expect(hook.markerAdvancedFilters.value[0].children.map(({ key }) => key)).toEqual([
      'a',
      'b',
      'c',
    ])

    hook.reorderMAFItems(0, ['x', 'b', 'c'])
    expect(hook.markerAdvancedFilters.value[0].children.map(({ key }) => key)).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('组序号越界时安全忽略', () => {
    expect(() => hook.reorderMAFItems(9, ['a', 'b', 'c'])).not.toThrow()
    expect(hook.markerAdvancedFilters.value[0].children.map(({ key }) => key)).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})
