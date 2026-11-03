import type { Modifier, ModifierConstructorOptions } from '../core'
import type { TweakConfigMetaVo } from '@/api/alova/globals'
import type { GSMarkerInfo } from '@/packages/map'
import type { HiddenFlagEnum } from '@/shared'
import { HIDDEN_FLAG_OPTIONS } from '@/shared'
import { useArchiveStore } from '@/stores'
import { Logger, messageFrom } from '@/utils'
import { EnumModifier, TextModifier, TimeModifier } from '../core/modifiers'

interface ModifierConstructor<T> {
  new (options: ModifierConstructorOptions<T>): Modifier
}

const createFactory = <T = void>(
  ModifierClass: ModifierConstructor<T>,
  options: Omit<ModifierConstructorOptions<T>, 'type'>,
) => {
  return (type: string) => new ModifierClass({ ...options, type } as ModifierConstructorOptions<T>)
}

export interface TweakControlInfo {
  id: string
  prop: string
  modifier: Modifier
  isCustom?: boolean
}

const textCommonOptions = [
  {
    label: '更新',
    value: 'update',
  },
  {
    label: '文本替换',
    value: 'replace',
  },
  {
    label: '正则替换',
    value: 'replaceRegex',
  },
  {
    label: '在开头插入',
    value: 'prepend',
  },
  {
    label: '在结尾插入',
    value: 'append',
  },
  {
    label: '去除开头空白字符',
    value: 'trimLeft',
  },
  {
    label: '去除结尾空白字符',
    value: 'trimRight',
  },
  {
    label: '从开头移除文本',
    value: 'removeLeft',
  },
  {
    label: '从结尾移除文本',
    value: 'removeRight',
  },
]

const options = [
  {
    label: '点位标题',
    value: 'title',
    children: textCommonOptions,
  },
  {
    label: '描述内容',
    value: 'content',
    children: textCommonOptions,
  },
  {
    label: '刷新时间',
    value: 'refreshTime',
    children: [{ label: '更新', value: 'update' }],
  },
  {
    label: '显示状态',
    value: 'hiddenFlag',
    children: [{ label: '更新', value: 'update' }],
  },
  {
    label: '标记状态',
    value: 'marked',
    children: [{ label: '更新', value: 'update' }],
  },
  {
    label: '额外数据',
    value: 'extra',
    disabled: true,
    children: [{ label: '合并', value: 'merge' }],
  },
  {
    label: '物品关联',
    value: 'itemList',
    disabled: true,
    children: [
      { label: '更新', value: 'update' },
      { label: '不存在时插入', value: 'insertIfAbsent' },
      { label: '插入或更新', value: 'insertOrUpdate' },
      { label: '删除条目', value: 'removeItem' },
      { label: '保留条目', value: 'preserveItem' },
    ],
  },
]

export const useTweaks = (markerList: ComputedRef<GSMarkerInfo[]>) => {
  const logger = new Logger('批量修改')

  const archiveStore = useArchiveStore()

  const modifierMap = new Map<string, (type: string) => Modifier>()
    .set(
      'title',
      createFactory(TextModifier, {
        field: 'markerTitle',
        label: '点位标题',
        matchMultiline: false,
        replaceMultiline: false,
      }),
    )
    .set(
      'content',
      createFactory(TextModifier, {
        field: 'content',
        label: '描述内容',
        previewHeight: 90,
        matchMultiline: true,
        replaceMultiline: true,
      }),
    )
    .set(
      'refreshTime',
      createFactory(TimeModifier, {
        field: 'refreshTime',
        label: '刷新时间',
      }),
    )
    .set(
      'hiddenFlag',
      createFactory(EnumModifier<HiddenFlagEnum>, {
        field: 'hiddenFlag',
        label: '显示状态',
        options: HIDDEN_FLAG_OPTIONS,
        optionMap: HIDDEN_FLAG_OPTIONS.reduce((map, option) => {
          map.set(option.value, option.label)
          return map
        }, new Map<HiddenFlagEnum, string>()),
      }),
    )
    .set(
      'marked',
      (() => {
        const options = [
          { label: '已完成', value: true },
          { label: '未完成', value: false },
        ]
        return createFactory(EnumModifier<boolean>, {
          field: 'id',
          label: '标记状态',
          options,
          customModify: async (markerList, { value }) => {
            markerList.forEach(({ id }) => {
              archiveStore.currentArchive.body.Data_KYJG[value ? 'add' : 'delete'](id!)
            })
            await archiveStore.flush()
          },
          customGetValue: ({ id }, isOld, meta = {}) => {
            if (isOld) return archiveStore.currentArchive.body.Data_KYJG.has(id!)
            return meta.value
          },
          optionMap: options.reduce((map, option) => {
            map.set(option.value, option.label)
            return map
          }, new Map<boolean, string>()),
        })
      })(),
    )

  const tweakList = shallowRef<TweakControlInfo[]>([])
  const tweakData = ref(new Map<string, TweakConfigMetaVo>())
  const selectedIndex = ref(-1)

  const modifiedMarkerList = computed(() => {
    const previewTweakList = tweakList.value.slice(0, selectedIndex.value + 1)
    return markerList.value.map(marker =>
      previewTweakList.reduce(
        ({ newData }, { modifier, id }) => ({
          oldData: newData,
          newData: modifier.modify(newData, tweakData.value.get(id)!),
        }),
        { oldData: marker, newData: marker },
      ),
    )
  })

  const selectedModifier = computed(() => {
    if (selectedIndex.value < 0) return
    return tweakList.value[selectedIndex.value].modifier
  })

  const selectedMeta = computed(() => {
    if (selectedIndex.value < 0) return
    return tweakData.value.get(tweakList.value[selectedIndex.value].id)!
  })

  const createTweak = (value?: string[]) => {
    try {
      if (!value || value.length < 2) return

      const [prop, type] = value

      const modifierFactory = modifierMap.get(prop)
      if (!modifierFactory) throw new Error(`字段 "${prop}" 的修改器实例不存在`)

      const modifier = modifierFactory(type)
      const id = crypto.randomUUID()

      tweakList.value = [
        ...tweakList.value,
        {
          id,
          prop,
          modifier,
          isCustom: modifier.options.customModify !== undefined,
        },
      ]
      tweakData.value.set(id, {})

      selectedIndex.value = tweakList.value.length - 1
    } catch (err) {
      logger.error(messageFrom(err))
    }
  }

  const deleteTweak = (index: number) => {
    const list = [...tweakList.value]
    const tweak = list[index]
    if (!tweak) return
    list.splice(index, 1)
    selectedIndex.value =
      selectedIndex.value >= list.length ? selectedIndex.value - 1 : selectedIndex.value
    tweakList.value = list
    tweakData.value.delete(tweak.id)
  }

  const clearTweaks = () => {
    selectedIndex.value = -1
    tweakList.value = []
    tweakData.value.clear()
  }

  return {
    tweakList,
    tweakData,
    tweakOptions: options,
    modifiedMarkerList,
    selectedIndex,
    selectedModifier,
    selectedMeta,
    createTweak,
    deleteTweak,
    clearTweaks,
  }
}
