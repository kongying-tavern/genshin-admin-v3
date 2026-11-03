<script lang="ts" setup>
import type { InternalItemData } from './AddonItem/types'
import type { AreaVo, MarkerVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import { WinDialog, WinDialogFooter, WinDialogTabPanel, WinDialogTitleBar } from '@/components'
import { HiddenFlagEnum, specialMask } from '@/shared'
import { useAccessStore, useAreaStore, useItemStore, useMarkerExtraStore } from '@/stores'
import { addonPanelRefKey } from '../shared'
import { useRules } from '../validators'
import AddonContenEditor from './AddonContenEditor.vue'
import { AddonExtra } from './AddonExtra'
import { AddonHistory } from './AddonHistory'
import AddonImageEditor from './AddonImageEditor.vue'
import { AddonItem } from './AddonItem'
import AddonRefreshtimeEditor from './AddonRefreshtimeEditor.vue'
import AddonVideo from './AddonVideo.vue'

const props = defineProps<{
  /** 双向绑定点位表单数据 */
  modelValue: MarkerVo
  /** 加载状态 */
  loading?: boolean
  /** 标题 */
  title?: string
}>()

const emits = defineEmits<{
  'update:modelValue': [MarkerVo]
  close: []
}>()

const areaStore = useAreaStore()
const itemStore = useItemStore()
const accessStore = useAccessStore()

/** 表单数据 */
const form = ref<MarkerVo>({
  ...props.modelValue,
  picture: props.modelValue.picture ?? '',
  extra: props.modelValue.extra ?? {},
})

watch(
  form,
  () => {
    if (props.loading) return
    emits('update:modelValue', form.value)
  },
  { deep: true },
)

const handleUsingHistory = (history: MarkerVo) => {
  Object.assign(form.value, history)
}

const { rules } = useRules()

/**
 * 右侧额外面板识别 id
 * @default 默认展开点位描述
 */
const addonId = ref('content')

/** 表单实例 */
const formRef = ref<ElFormType>()

// ==================== 点位 extra ====================
const markerExtraStore = useMarkerExtraStore()

const itemsGroup = ref<Map<AreaVo, InternalItemData[]>>(new Map())

const areaCode = ref(
  (() => {
    const first = form.value.itemList?.[0]
    if (!first) return ''
    const item = itemStore.itemIdMap.get(first.itemId!)
    if (!item) return ''
    return areaStore.areaIdMap.get(item.areaId!)?.code ?? ''
  })(),
)

/** @表单联动 当前可以被设置的 extra 配置 */
const availableExtraConfig = computed(() => {
  const codes = [...itemsGroup.value.entries()].map(([area]) => area.code!)
  if (!codes.length) return {}
  const config = codes.reduce((config, areaCode) => {
    const areaConfig = markerExtraStore.mergedAreaExtraConfigs[areaCode]
    if (!areaConfig) return config
    const { underground, ...rest } = areaConfig ?? {}
    if (underground) {
      const { levels = [], ...undergroundRest } = underground
      Object.assign(rest, {
        underground: {
          ...undergroundRest,
          levels: [...levels, ...(config.underground?.levels ?? [])],
        },
      })
    }
    return Object.assign(config, rest)
  }, {} as DTO.ExtraConfig)
  return config
})

// 在 extra config 变化后移除不存在 config 内的值
// 该逻辑用于避免以下问题：
// 假如用户设置点位为海岛层级，然后修改了地区
// 此时海岛的层级选项会被筛选掉，但实际值未变，导致用户无法去掉点位的海岛层级
watch(
  () => availableExtraConfig.value,
  config => {
    const extraData = (toValue(form).extra ?? {}) as DTO.MarkerExtra
    const { region_levels, is_underground } = extraData.underground ?? {}
    if (region_levels) {
      const { levels = [] } = config.underground ?? {}
      const region = levels.reduce((set, { children = [] }) => {
        children.forEach(({ value }) => set.add(value))
        return set
      }, new Set<string>())
      const validRegions = region_levels.filter(regionValue => region.has(regionValue))
      form.value.extra!.underground = validRegions.length
        ? {
            is_underground,
            region_levels: validRegions,
          }
        : {
            // 目标地区已无对应层级，同步关闭分层层级的开启状态
            is_underground: false,
            region_levels: [],
          }
    }
    if (!config['2_8_island']) delete form.value.extra!['2_8_island']
    if (!config['1_6_island']) delete form.value.extra!['1_6_island']
  },
  { deep: true },
)

/**
 * 判断是否可被设置图标覆盖（检测所属物品是否存在 special 掩码第二位为 1）
 * @see `src\shared\specialFlag.ts`
 */
const isIconOverridable = computed(
  () =>
    toValue(form).itemList?.find(({ itemId }) => {
      const item = itemStore.itemIdMap.get(itemId!)
      if (!item) return false
      return specialMask.isActive(item.specialFlag ?? 0, 'isIconCustomizable')
    }) !== undefined,
)

const isExtraEditable = computed(() => {
  return toValue(isIconOverridable) || Object.keys(availableExtraConfig.value).length > 0
})

// 如果不能自定义图标，则设置 iconOverride 为 null
watch(
  () => isIconOverridable.value,
  avaliable => {
    if (!form.value.extra || avaliable) {
      return
    }
    Reflect.set(form.value.extra as DTO.MarkerExtra, 'iconOverride', null)
  },
)

// ==================== 拓展面板 ====================
const addonPanelRef = ref<HTMLDivElement>()
provide(addonPanelRefKey, addonPanelRef)

const addonPanelVisible = ref(true)
const onAddonPanelTransitionStart = (ev: TransitionEvent) => {
  if (ev.propertyName === 'width') addonPanelVisible.value = false
}
const onAddonPanelTransitionEnd = (ev: TransitionEvent) => {
  if (ev.propertyName === 'width') addonPanelVisible.value = true
}

// ==================== 面板样式 ====================
const themeColor = computed(() => {
  const code = toValue(areaCode)
  const zone = code.split(':')[1]
  if (!zone) return '#409eff'
  return `var(--gs-color-${zone.toLowerCase()})`
})

defineExpose({
  validate: async () => {
    try {
      await formRef.value?.validate()
      return true
    } catch {
      throw new Error('表单校验失败')
    }
  },
})
</script>

<template>
  <WinDialog
    :style="{
      'border-color': `color-mix(in srgb, var(--el-color-primary-light-9) 50%, ${themeColor} 50%)`,
    }"
  >
    <WinDialogTitleBar
      :style="{
        background: `color-mix(in srgb, var(--el-bg-color) 50%, ${themeColor} 50%)`,
      }"
      :loading="loading"
      @close="() => emits('close')"
    >
      <slot name="title">
        {{ title }}
      </slot>
    </WinDialogTitleBar>

    <WinDialogTabPanel>
      <div class="marker-editor-form grid h-full rounded-lg">
        <el-form
          ref="formRef"
          :rules="rules"
          :model="form"
          class="form-content w-96"
          label-width="80px"
        >
          <el-form-item label="点位名称" prop="markerTitle">
            <div class="w-full flex justify-between gap-1">
              <el-input v-model="form.markerTitle" />
              <AddonHistory
                v-if="form.id !== undefined"
                v-model:addon-id="addonId"
                v-model:marker-vo="form"
                :loading="loading"
                @use-history="handleUsingHistory"
              />
            </div>
          </el-form-item>

          <el-form-item label="所属物品" prop="itemList">
            <AddonItem
              v-model="form"
              v-model:items-group="itemsGroup"
              v-model:area-code="areaCode"
              v-model:addon-id="addonId"
            />
            <template #error="{ error }">
              <div
                class="absolute -bottom-[18px] h-[18px] text-xs text-[var(--el-color-danger)] z-10"
                :title="error"
              >
                {{ error }}
              </div>
            </template>
          </el-form-item>

          <el-form-item v-if="isExtraEditable" label="附加信息" prop="extra">
            <AddonExtra
              v-model="form.extra"
              v-model:addon-id="addonId"
              :config="availableExtraConfig"
              :item-list="form.itemList"
              :is-icon-overridable="isIconOverridable"
            />
          </el-form-item>

          <el-form-item label="点位描述" prop="content">
            <AddonContenEditor
              v-model="form.content"
              v-model:addon-id="addonId"
              :item-list="form.itemList"
            />
          </el-form-item>

          <el-form-item label="点位图像" prop="picture">
            <AddonImageEditor v-model="form.picture" v-model:addon-id="addonId" />
          </el-form-item>

          <el-form-item label="显示状态" prop="hiddenFlag">
            <el-radio-group v-model="form.hiddenFlag">
              <el-radio-button :value="HiddenFlagEnum.SHOW"> 显示 </el-radio-button>
              <el-radio-button :value="HiddenFlagEnum.HIDDEN"> 隐藏 </el-radio-button>
              <el-radio-button
                v-if="accessStore.get('HIDDEN_FLAG_BETA')"
                :value="HiddenFlagEnum.BETA"
              >
                测试
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="刷新时间" prop="refreshTime">
            <AddonRefreshtimeEditor v-model="form.refreshTime" />
          </el-form-item>

          <el-form-item label="视频链接" prop="videoPath">
            <AddonVideo v-model="form.videoPath" v-model:addon-id="addonId" />
          </el-form-item>
        </el-form>

        <div
          class="addon-panel"
          :class="{ visible: addonId }"
          @transitionstart="onAddonPanelTransitionStart"
          @transitionend="onAddonPanelTransitionEnd"
        >
          <div v-show="addonPanelVisible" ref="addonPanelRef" class="addon-panel-content" />
        </div>
      </div>
    </WinDialogTabPanel>

    <WinDialogFooter>
      <slot name="footer" />
    </WinDialogFooter>
  </WinDialog>
</template>

<style scoped>
.marker-editor-form {
  grid-template-columns: 1fr auto;
}

.addon-panel {
  --padding-left: 16px;

  width: 0;
  height: 100%;
  padding-left: 0;
  transition: var(--el-transition-all);
  overflow: hidden;
  position: relative;

  &.visible {
    width: 400px;
    padding-left: var(--padding-left);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 100%;
    translate: calc(var(--padding-left) / 2) 0;
    border-left: 1px solid var(--el-border-color);
  }
}

.addon-panel-content {
  position: absolute;
  top: 0;
  height: 100%;
  width: calc(100% - var(--padding-left));
}
</style>
