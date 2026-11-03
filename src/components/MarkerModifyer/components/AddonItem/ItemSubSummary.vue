<script setup lang="ts">
import type { InternalItemData } from './types'
import { Delete } from '@element-plus/icons-vue'
import { useFormItem } from 'element-plus'
import { AppIconTagRenderer } from '@/components'
import { useIconStore, useItemTypeStore } from '@/stores'
import { vCopyCleanText } from '@/utils'

defineProps<{
  data: InternalItemData
}>()

defineEmits<{
  delete: []
}>()

const iconStore = useIconStore()
const itemTypeStore = useItemTypeStore()

const count = defineModel<number>('count', {
  required: false,
  default: 0,
})

const { formItem } = useFormItem()

const numberCount = computed({
  get: () => `${count.value}`,
  set: value => {
    const num = Number(value)
    count.value = num
  },
})

const virtualRef = defineModel<HTMLElement | undefined>('virtualRef', {
  required: false,
})

const popoverItems = defineModel<number[] | undefined>('popoverItems', {
  required: false,
  default: () => [],
})

const setRestItems = (target: HTMLElement | undefined, items: number[] = []) => {
  virtualRef.value = target
  popoverItems.value = items
}
</script>

<template>
  <div
    v-copy-clean-text
    class="item-sub-summary flex items-center pr-1 text-xs hover:bg-[var(--el-color-primary-light-9)]"
  >
    <div class="w-8 h-8 p-0.5">
      <AppIconTagRenderer
        :src="iconStore.iconTextureUrl"
        :mapping="iconStore.iconCoordMap.get(data._raw.iconId ?? -1)"
        class="w-full h-full"
      />
    </div>

    <div v-if="!data._raw.typeIdList?.length" class="flex-shrink-0">未分类</div>

    <div v-else class="flex-shrink-0 flex items-center gap-0.5">
      <div
        class="h-5 leading-5 px-1 rounded-sm flex items-center bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)] text-xs"
        :title="itemTypeStore.itemTypeIdMap.get(data._raw.typeIdList[0])?.name"
      >
        {{ itemTypeStore.itemTypeIdMap.get(data._raw.typeIdList[0])?.name?.slice(-2) ?? 'unknown' }}
      </div>
      <div
        v-if="data._raw.typeIdList.length > 1"
        class="h-5 leading-5 px-1 rounded-sm items-center bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)]"
        @pointerenter="ev => setRestItems(ev.target as HTMLElement, data._raw.typeIdList?.slice(1))"
        @pointerleave="() => setRestItems(undefined)"
      >
        +{{ data._raw.typeIdList.length - 1 }}
      </div>
    </div>

    <div
      class="flex-1 px-0.5 whitespace-nowrap overflow-hidden text-ellipsis"
      :title="data._raw.name"
    >
      {{ data._raw.name }}
    </div>

    <input
      v-model="numberCount"
      required
      class="number-input flex-shink-0 rounded-sm flex pl-0.5 w-10 h-6 outline-none border border-[var(--el-border-color)] bg-[var(--el-bg-color)] hover:border-[var(--el-text-color-disabled)] focus:border-[var(--el-color-primary)] invalid:border-[var(--el-color-danger)] invalid:hover:border-[var(--el-color-danger)] invalid:focus:border-[var(--el-color-danger)]"
      @input="() => formItem?.validate('change').catch(() => false)"
      @blur="() => formItem?.validate('blur').catch(() => false)"
    />

    <div
      class="flex-shrink-0 w-6 h-6 grid place-items-center ml-0.5 hover:bg-[var(--el-color-danger-light-7)] active:bg-[var(--el-color-danger-light-9)] rounded cursor-pointer"
      @click="() => $emit('delete')"
    >
      <el-icon color="var(--el-color-danger)">
        <Delete />
      </el-icon>
    </div>
  </div>
</template>
