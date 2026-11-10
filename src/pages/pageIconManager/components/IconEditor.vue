<script lang="ts" setup>
import type { IconVariant } from '../types'
import type { IconVo } from '@/api/alova/globals'
import { Check, Close } from '@element-plus/icons-vue'
import {
  IconRenderer,
  WinDialog,
  WinDialogFooter,
  WinDialogTabPanel,
  WinDialogTitleBar,
} from '@/components'
import { useIconType } from '@/hooks'
import { useIconFormRules, useIconUpdate } from '../hooks'
import { ImageCropper } from './ImageCropper'

const props = defineProps<{
  icon: IconVo
}>()

const emits = defineEmits<{
  close: []
  success: []
}>()

/** 表单 */
const form = ref<IconVo>(JSON.parse(JSON.stringify(props.icon)))

/** 图标变体 */
const variant = ref('default')

const variantTabs = [
  { label: '默认', name: 'default', required: true },
  { label: '已激活', name: 'active', required: false },
  { label: '未激活', name: 'inactive', required: false },
] as const

/** 更新逻辑封装 */
const { stash, iconEditable, isChanged, loading, onSuccess, clearStash, stashIcon, updateIcon } =
  useIconUpdate(form)

const variantLabelRecord: Record<IconVariant, string> = {
  default: '默认',
  active: '已激活',
  inactive: '未激活',
}

const variantStatusRecord = computed(() => {
  const status = {} as Record<IconVariant, string>
  variantTabs.forEach(({ name }) => {
    if (name === 'default')
      status.default = stash.value.default ? '待上传' : form.value.url ? '' : '未配置'
    else if (stash.value[name] === null) status[name] = '待移除'
    else
      status[name] = stash.value[name] ? '待上传' : form.value.urlVariants?.[name] ? '' : '未配置'
  })
  return status
})

/** 图标类型 */
const { props: typeTreeProps, load: loadIconType } = useIconType()

/** 校验规则 */
const { rules } = useIconFormRules(form)

/** 确认按钮可用性 */
const disabledConfirm = computed(() => {
  const { tag = '' } = form.value
  if (!tag.trim().length) return true
  if (
    [
      props.icon.tag === form.value.tag,
      props.icon.description === form.value.description,
      JSON.stringify(props.icon.typeIdList ?? []) === JSON.stringify(form.value.typeIdList ?? []),
      !iconEditable.value || (iconEditable.value && !isChanged.value),
    ].every(Boolean)
  ) {
    return true
  }
  return false
})

onSuccess(() => {
  emits('close')
  emits('success')
})

/** 记录图标变更情况 */
const handleImageLoad = ({
  canvas,
  isRaw,
  variant,
}: {
  canvas: HTMLCanvasElement
  isRaw: boolean
  variant: IconVariant
}) => {
  if (isRaw) {
    clearStash(variant)
    return
  }
  stashIcon(variant, canvas)
}

/** 删除时为变体字段赋值为 null */
const handleIconVariantDelete = (variant: IconVariant) => {
  stashIcon(variant, null)
}

const cancel = () => {
  emits('close')
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar class="gap-2" :disabled="loading" @close="cancel">
      <el-tag size="small" type="warning"> ID: {{ props.icon.id }} </el-tag>
      <div>
        {{ props.icon.tag }}
      </div>
    </WinDialogTitleBar>

    <WinDialogTabPanel class="w-[384px] mb-0 flex flex-col">
      <div class="w-full shrink-0 overflow-hidden flex">
        <div
          class="shrink-0 h-fit relative toggle-cropper border border-[var(--el-border-color)] rounded overflow-hidden"
          :class="{
            'is-editting': iconEditable,
          }">
          <IconRenderer class="w-[120px] h-[120px]" :icon-id="props.icon.id" @click="iconEditable = !iconEditable" />
        </div>

        <el-form :disabled="loading" :rules="rules" :model="form" label-width="60px" class="flex-1">
          <el-form-item label="名称" prop="tag" style="margin-bottom: 17px">
            <el-input v-model="form.tag" />
          </el-form-item>

          <el-form-item label="描述" prop="description" style="margin-bottom: 8px">
            <el-input v-model="form.description" :rows="3" resize="none" type="textarea" />
          </el-form-item>

          <el-form-item label="分类" prop="typeIdList" style="margin-bottom: 0">
            <el-tree-select v-model="form.typeIdList" lazy multiple collapse-tags collapse-tags-tooltip
              :load="loadIconType" :props="typeTreeProps" />
          </el-form-item>
        </el-form>
      </div>

      <div class="overflow-visible transition-all" :class="iconEditable ? 'h-[336px]' : 'h-[0px]'">
        <el-divider style="margin: 8px 0" />
        <el-tabs v-model="variant" class="custom-tabs" type="border-card">
          <el-tab-pane v-for="tab in variantTabs" :key="tab.name" :name="tab.name"
            :label="`${variantLabelRecord[tab.name]} ${variantStatusRecord[tab.name] ? `(${variantStatusRecord[tab.name]})` : ''}`"
            lazy>
            <ImageCropper :raw="tab.name === 'default' ? form.url : form.urlVariants?.[tab.name]" :variant="tab.name"
              :disabled-delete="!form.urlVariants?.[tab.name] || stash[tab.name] === null"
              :show-preview="stash[tab.name] !== undefined" class="w-full flex-1" @image-load="handleImageLoad"
              @delete="handleIconVariantDelete" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </WinDialogTabPanel>

    <WinDialogFooter class="items-center">
      <div class="flex-1">
        <el-tag v-if="iconEditable && isChanged" disable-transitions type="success">
          将会更新图片
        </el-tag>
      </div>
      <el-button type="primary" :icon="Check" :disabled="disabledConfirm" :loading="loading" @click="updateIcon">
        确认
      </el-button>
      <el-button :icon="Close" :disabled="loading" @click="cancel"> 取消 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>

<style scoped>
.toggle-cropper {
  --content: '编辑图片';
  --bg: var(--el-color-primary);
  --bg-alpha: 0%;
  --text-alpha: 0%;

  cursor: pointer;

  &::before {
    content: var(--content);
    border-radius: 4px;
    display: grid;
    place-content: center;
    color: color-mix(in srgb,
        var(--el-color-white) var(--text-alpha),
        transparent calc(100% - var(--text-alpha)));
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: var(--alpha);
    background-color: color-mix(in srgb,
        var(--bg) var(--bg-alpha),
        transparent calc(100% - var(--bg-alpha)));
    z-index: 1;
    pointer-events: none;
  }

  &:hover {
    --text-alpha: 100%;
    --bg-alpha: 50%;
  }

  &:active {
    --bg-alpha: 30%;
  }

  &.is-editting {
    --bg: var(--el-color-warning);
    --content: '取消编辑';
    border-color: var(--el-color-warning);
  }
}

.custom-tabs {
  --el-tabs-header-height: 30px;

  :deep(.el-tabs__item.el-tabs__item.el-tabs__item) {
    padding-left: 8px;
    padding-right: 8px;
  }

  :deep(.el-tabs__header.is-top) {
    margin-bottom: 0;
  }

  :deep(.el-tabs__item) {
    font-size: 12px;
    transition: none;
  }

  :deep(.el-tabs__content) {
    padding: 4px;
    flex: 1;
  }

  :deep(.el-tab-pane) {
    display: flex;
    flex-direction: column;
  }
}

.clip-enter-active,
.clip-leave-active {
  transition: opacity 0.5s ease;
}

.clip-enter-from {
  height: 339px;
}

.clip-leave-to {
  height: 0;
}
</style>
