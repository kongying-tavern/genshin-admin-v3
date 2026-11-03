<script setup lang="ts">
import type {
  IconOverride,
  MarkerExtraVo,
  MarkerItemLinkVo,
  Underground,
  V2_8_Island,
} from '@/api/alova/globals'
import { Setting } from '@element-plus/icons-vue'
import { useIconStore } from '@/stores'
import { AddonTeleporter } from '..'
import { useAddonActive } from '../../hooks'
import { OverrideIcon, RegionCommon, RegionIsland16, RegionIsland28 } from './components'

const props = defineProps<{
  config: DTO.ExtraConfig
  itemList?: MarkerItemLinkVo[]
  isIconOverridable?: boolean
}>()

const modelValue = defineModel<MarkerExtraVo>('modelValue', {
  required: false,
  default: {},
})

interface TagInfo {
  type: string
  label: string
}

const regionMap = computed(() => {
  const levels = props.config.underground?.levels ?? []
  return levels.reduce((map, { label: pl, value: pv, children = [] }) => {
    children.forEach(({ label, value }) => {
      map.set(value, { label, value, parent: { label: pl, value: pv } })
    })
    return map
  }, new Map<string, { label: string; value: string; parent: { label: string; value: string } }>())
})

const regionIsland28Map = computed(() => {
  const stages = props.config['2_8_island']?.stages ?? []
  return stages.reduce((map, { label, value, children = [] }) => {
    const childrenMap = new Map<string, string>()
    children.forEach(({ label: cl, value: cv }) => childrenMap.set(cv, cl))
    map.set(value, { label, value, children: childrenMap })
    return map
  }, new Map<string, { label: string; value: string; children: Map<string, string> }>())
})

const regionIsland16Map = computed(() => {
  const stages = props.config['1_6_island']?.stages ?? []
  return stages.reduce((map, { label, value }) => map.set(value, label), new Map<string, string>())
})

const tagParser: Record<string, (data: unknown) => TagInfo | TagInfo[]> = {
  iconOverride: (data: unknown) => {
    if (typeof data !== 'object' || !data) return [] as TagInfo[]
    const { id } = (data as IconOverride) ?? {}
    if (!id) return [] as TagInfo[]
    const icon = useIconStore().idMap.get(id)
    if (!icon) return [] as TagInfo[]
    return {
      type: '覆盖图标',
      label: icon.tag,
    } as TagInfo
  },

  underground: (data: unknown) => {
    if (typeof data !== 'object' || !data) return []
    const {
      region_levels: levels = [],
      is_underground: isUnderground,
      is_global: isGlobal,
    } = (data as Underground) ?? {}
    if (!isUnderground) return []
    const defaultInfo = { type: '非地面', label: 'unknown' }
    const undergroundConfig = props.config.underground
    if (!undergroundConfig) return defaultInfo
    if (isGlobal) return { type: '非地面', label: '无层级' }
    if (!levels.length) return { type: defaultInfo.type, label: '未设置层级' }
    const map = toValue(regionMap)
    return levels.reduce((seed, value) => {
      const region = map.get(value)
      region && seed.push({ type: defaultInfo.type, label: region.label })
      return seed
    }, [] as TagInfo[])
  },

  '2_8_island': (data: unknown) => {
    if (typeof data !== 'object' || !data) return []
    const { island_name: parentValue, island_state: children } = (data as V2_8_Island) ?? {}
    if (!parentValue) return []
    const defaultInfo = { type: '2.8 海岛', label: 'unknown' }
    const island28Config = props.config['2_8_island']?.stages
    if (!island28Config) return defaultInfo
    const parent = toValue(regionIsland28Map).get(parentValue!)
    if (!parent) return defaultInfo
    return {
      type: defaultInfo.type,
      label: `${parent.label}${children?.length ? `-{${children?.map(child => parent.children.get(child!) ?? '').join(',\n')}}` : ''}`,
    }
  },

  '1_6_island': (data: unknown) => {
    if (typeof data !== 'object' || !data) return []
    const levels = (data as string[]) ?? []
    if (!levels.length) return []
    const defaultInfo = { type: '1.6 海岛', label: 'unknown' }
    const island16Config = props.config['1_6_island']?.stages
    if (!island16Config) return defaultInfo
    const map = toValue(regionIsland16Map)
    return {
      type: defaultInfo.type,
      label: levels.map(value => map.get(value) ?? value).join(', '),
    }
  },
}

const parseTags = (data: MarkerExtraVo) =>
  Object.entries(data).reduce((seed, [key, value]) => {
    const parser = tagParser[key]
    if (!parser) return seed
    const res = parser(value)
    if (Array.isArray(res)) res.forEach(item => seed.push(item))
    else seed.push(res)
    return seed
  }, [] as TagInfo[])

// 将 extra 数据转换为可视 tag
const tags = ref(parseTags(toValue(modelValue)))

watch(
  modelValue,
  data => {
    tags.value = parseTags(data)
  },
  { deep: true },
)

const addonId = defineModel<string>('addonId', { required: true })
const isAddonActive = useAddonActive(addonId, 'extra')
</script>

<template>
  <div class="w-full flex gap-1 overflow-hidden">
    <div class="h-full min-h-[32px] flex-1 rounded text-sm flex flex-wrap gap-1 overflow-hidden">
      <div
        class="flex-1 overflow-hidden p-1 rounded flex flex-col items-start gap-1 border text-xs"
        :class="
          isAddonActive ? 'border-[var(--el-color-primary)]' : 'border-[var(--el-border-color)]'
        "
      >
        <div
          v-if="!tags.length"
          class="px-1 text-[var(--el-text-color-secondary)] text-xs leading-5"
        >
          无
        </div>

        <div
          v-for="tag in tags"
          :key="tag.label"
          :title="tag.label"
          class="max-w-full overflow-hidden flex items-center rounded-[3px] border border-transparent hover:border-[var(--el-color-primary-light-5)] select-none cursor-pointer"
          @click="isAddonActive = true"
        >
          <div
            class="flex-shrink-0 p-0.5 px-1.5 rounded-[2px_0_0_2px] bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)] whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {{ tag.type }}
          </div>
          <div
            class="p-0.5 px-1.5 rounded-[0_2px_2px_0] bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)] whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {{ tag.label }}
          </div>
        </div>
      </div>

      <el-button
        :icon="Setting"
        :type="isAddonActive ? 'primary' : ''"
        title="配置附加信息"
        class="flex-shrink-0"
        circle
        @click="isAddonActive = !isAddonActive"
      />

      <AddonTeleporter :active="isAddonActive">
        <div class="w-full h-full flex flex-col overflow-x-hidden overflow-y-auto">
          <RegionCommon v-if="config.underground" v-model="modelValue.underground" :config />

          <RegionIsland16 v-if="config['1_6_island']" v-model="modelValue['1_6_island']" :config />

          <RegionIsland28 v-if="config['2_8_island']" v-model="modelValue['2_8_island']" :config />

          <OverrideIcon v-if="isIconOverridable" v-model="modelValue.iconOverride" :config />
        </div>
      </AddonTeleporter>
    </div>
  </div>
</template>
