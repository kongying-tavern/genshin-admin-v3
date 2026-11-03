import type { MarkerVo } from '@/api/alova/globals'
import { useFetchHook } from '@/hooks'
import { HistoryRecordType } from '@/shared'
import { MarkerCollator } from '../utils'

/**
 * 注意，该 hook 静态复制了初次传入的表单值，刷新需要主动调用 `refreshSource`
 *
 * ## 历史记录的计算方式
 * 1. 当 select index 为最新时，历史记录的 content 字段为 "编辑前" 的内容拷贝，使用当前点位数据进行对比
 * 2. 当 select index 为初始时，历史记录的 content 字段为 "创建时" 的内容拷贝，使用初始历史记录自身进行对比
 * 3. 其他情况下，使用上一条历史记录作为对比
 *
 * ```
 *  select index  |       0      |       1      |       3      |
 * ───────────────┼──────────────┼──────────────┼──────────────┤
 *   [current]    |  <- new one  |              |              |
 * ┌────────────┐ |              |              |              |
 * │0. Record A │ |  <- old one  |  <- new one  |              |
 * ├────────────┤ |              |              |              |
 * │1. Record B │ |              |  <- old one  |              |
 * ├────────────┤ |              |              |              |
 * │2. Record C │ |              |              |  <- new one  |
 * └────────────┘ |              |              |              |
 *   [Record C]   |              |              |  <- old one  |
 * ```
 */
export const useMarkerHistory = (markerVo: Ref<MarkerVo>) => {
  const clonedMarkerVo = ref(JSON.parse(JSON.stringify(markerVo.value)) as MarkerVo)

  const refreshSource = () => {
    clonedMarkerVo.value = JSON.parse(JSON.stringify(markerVo.value)) as MarkerVo
  }

  /**
   * 当前选择的记录索引，比对器会将该条与上一条进行对比
   * 在 updateTime- 排序模式下，index 越小记录越新
   */
  const selectedHistoryIndex = ref(0)

  // 先加载 100 条，超过 100 就全部加载
  // TODO 后续改为懒加载或虚拟列表
  const { data, refresh, ...rest } = useFetchHook({
    initialValue: {
      record: [],
      users: new Map(),
    },
    onRequest: async () => {
      selectedHistoryIndex.value = 0

      const { id } = toValue(clonedMarkerVo)
      if (id === undefined) throw new Error('点位 id 为空')

      const { data: { record = [], total = 0 } = {}, users: _users = {} } =
        await Apis.history.searchHistory({
          data: {
            current: 1,
            size: 100,
            id: [id],
            type: HistoryRecordType.MARKER,
            sort: ['updateTime-'],
          },
        })

      if (total > 100) {
        const { data: { record = [] } = {}, users: _users = {} } = await Apis.history.searchHistory(
          {
            data: {
              current: 1,
              size: total,
              id: [id],
              type: HistoryRecordType.MARKER,
              sort: ['updateTime-'],
            },
          },
        )
        const users = new Map(Object.entries(_users))
        return { record, users }
      }

      const users = new Map(Object.entries(_users))

      return { record, users }
    },
  })

  const users = computed(() => data.value.users)

  const historyContents = computed(() =>
    data.value.record.map(({ content, ...rest }) => {
      const oldContent = JSON.parse(content ?? '{}') as MarkerVo
      return {
        ...rest,
        content,
        parseredContent: oldContent,
      }
    }),
  )

  const diffContents = computed(() =>
    historyContents.value.map(({ parseredContent, ...rest }, index, arr) => {
      const newContent = arr[index - 1]?.parseredContent ?? clonedMarkerVo.value
      const diffs = MarkerCollator.compare(newContent, parseredContent)
      return {
        ...rest,
        parseredContent,
        diffs,
      }
    }),
  )

  // index ∈ [0, history.length]
  const newDisabled = computed(() => selectedHistoryIndex.value <= 0)
  const oldDisabled = computed(() => selectedHistoryIndex.value >= data.value.record.length)

  const toNewOne = () => {
    if (newDisabled.value) return
    selectedHistoryIndex.value -= 1
  }

  const toOldOne = () => {
    if (oldDisabled.value) return
    selectedHistoryIndex.value += 1
  }

  const newHistory = computed(
    () =>
      diffContents.value[selectedHistoryIndex.value - 1] as
        | (typeof diffContents.value)[number]
        | undefined,
  )
  const oldHistory = computed(
    () =>
      diffContents.value[selectedHistoryIndex.value] as
        | (typeof diffContents.value)[number]
        | undefined,
  )

  const newContent = computed(() =>
    newHistory.value ? newHistory.value.parseredContent : clonedMarkerVo.value,
  )

  const oldContent = computed(() =>
    oldHistory.value ? oldHistory.value.parseredContent : newContent.value,
  )

  return {
    users,
    record: diffContents,
    selectedHistoryIndex,
    newDisabled,
    oldDisabled,
    refreshSource,
    toNewOne,
    toOldOne,
    refresh,
    newHistory,
    oldHistory,
    newContent,
    oldContent,
    ...rest,
  }
}
