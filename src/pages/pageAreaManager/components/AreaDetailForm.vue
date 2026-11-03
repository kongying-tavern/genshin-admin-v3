<script lang="ts" setup>
import type { AreaVo, ItemVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { cloneDeep } from 'lodash'
import { AppIconTagRenderer, AppItemSelecter } from '@/components'
import { HIDDEN_FLAG_OPTIONS } from '@/shared'
import { useAccessStore, useIconStore } from '@/stores'
import { useIconOptions } from '../hooks'

const props = defineProps<{
  parent?: AreaVo
  items?: ItemVo[]
  modelValue: AreaVo
}>()

const emits = defineEmits<{
  'update:modelValue': [area: AreaVo]
  'update:items': [items?: ItemVo[]]
}>()

const accessStore = useAccessStore()

const formData = ref(cloneDeep(props.modelValue))

const enableCopyItems = ref(false)

const isInternalUpdate = ref(false)

watch(
  () => props.modelValue,
  data => {
    if (isInternalUpdate.value) {
      isInternalUpdate.value = false
      return
    }
    formData.value = cloneDeep(data)
  },
  { deep: true },
)

watch(
  formData,
  form => {
    isInternalUpdate.value = true
    emits('update:modelValue', form)
  },
  {
    deep: true,
  },
)

const areaCode = computed({
  get: () => {
    const [_, areaTag, areaZone] = formData.value.code?.split(':') ?? []
    return props.parent ? areaZone : areaTag
  },
  set: code => {
    if (!code) formData.value.code = code
    const formatCode = code.toUpperCase()
    if (!/^[A-Z0-9_\-.]+$/.test(formatCode)) return
    formData.value.code = props.parent
      ? `A:${props.parent.code!.split(':')[1]}:${formatCode}`
      : `C:${formatCode}`
  },
})

const iconStore = useIconStore()

const { loading, tagOptions, getTagList } = useIconOptions()

const hiddenFlagOptions = useArrayFilter(HIDDEN_FLAG_OPTIONS, ({ value }) =>
  accessStore.checkHiddenFlag(value),
)

const selectedItems = computed({
  get: () => props.items,
  set: v => emits('update:items', v),
})

const rules: ItemFormRules<AreaVo> = {
  name: [{ required: true, message: '地区名称不能为空' }],
  code: [{ required: true, message: '地区代码不能为空' }],
}

const areaCodePrefix = computed(() => {
  if (!props.parent) return 'C:'
  const ParentAreaTag = props.parent.code!.split(':')[1]
  return `A:${ParentAreaTag}:`
})

const formRef = ref<ElFormType | null>(null)
defineExpose({
  validate: () => formRef.value?.validate(),
})
</script>

<template>
  <div class="flex">
    <el-form ref="formRef" label-width="80px" class="pr-2" :model="formData" :rules="rules">
      <el-form-item label="父级地区">
        {{ parent ? parent.name : '根地区' }}
      </el-form-item>

      <el-form-item label="地区名称" prop="name">
        <el-input v-model="formData.name" />
      </el-form-item>

      <el-form-item label="地区代码" prop="code">
        <el-input v-model="areaCode">
          <template #prefix>
            {{ areaCodePrefix }}
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="地区描述" prop="content">
        <el-input v-model="formData.content" type="textarea" :rows="3" resize="none" />
      </el-form-item>

      <el-form-item label="复制物品">
        <el-switch v-model="enableCopyItems" />
      </el-form-item>

      <el-form-item label="地区图标" prop="iconId">
        <div class="w-full flex gap-2">
          <AppIconTagRenderer
            :src="iconStore.iconTextureUrl"
            :mapping="iconStore.iconCoordMap.get(formData.iconId ?? -1)"
            class="w-8 h-8 flex-shrink-0"
          />
          <el-select-v2
            v-model="formData.iconId"
            filterable
            remote
            clearable
            placeholder="搜索标签名称"
            popper-class="item-no-padding"
            :remote-method="getTagList"
            :loading="loading"
            :options="tagOptions"
            style="width: 12rem"
            @clear="formData.iconId = -1"
          >
            <template #default="{ item }">
              <div
                class="h-full flex justify-center items-center gap-1 overflow-hidden px-2"
                :title="item.label"
              >
                <img
                  :src="item.url"
                  class="w-6 h-6 flex-shrink-0 object-contain"
                  crossorigin=""
                  loading="lazy"
                />
                <span class="w-full overflow-hidden whitespace-nowrap text-ellipsis text-xs">{{
                  item.label
                }}</span>
              </div>
            </template>
          </el-select-v2>
        </div>
      </el-form-item>

      <el-form-item label="显示类型" prop="hiddenFlag">
        <el-select-v2
          v-model="formData.hiddenFlag"
          :options="hiddenFlagOptions"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="地区排序" prop="sortIndex">
        <el-input-number v-model="formData.sortIndex" :min="0" :max="99" style="width: 100%" />
      </el-form-item>
    </el-form>

    <Transition
      appear
      mode="out-in"
      enter-from-class="w-0 opacity-0"
      enter-to-class="w-[521px] opacity-100"
      enter-active-class="transition-all duration-300"
      leave-from-class="w-[521px] opacity-100"
      leave-to-class="w-0 opacity-0"
      leave-active-class="transition-all duration-300"
    >
      <div
        v-if="enableCopyItems && selectedItems !== undefined"
        class="h-[441px] overflow-hidden border-left pl-2"
      >
        <AppItemSelecter
          v-model="selectedItems"
          title="复制以下物品"
          style="width: 521px; height: 441px"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.el-border {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  transition: var(--el-transition-border);
  &:hover {
    border-color: var(--el-border-color-hover);
  }
}

.border-left {
  border-left: 1px solid var(--el-border-color);
}
</style>
