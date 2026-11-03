<script setup lang="ts">
import type { ItemVo } from '@/api/alova/globals'
import { Check, Close, Delete } from '@element-plus/icons-vue'
import { AppIconTagRenderer, WinDialog, WinDialogFooter, WinDialogTitleBar } from '@/components'
import { useAreaStore, useIconStore } from '@/stores'
import { useItemDelete } from '../hooks'

const props = defineProps<{
  item: ItemVo
}>()

const emits = defineEmits<{
  success: [ItemVo]
  close: [boolean]
}>()

const areaStore = useAreaStore()
const iconStore = useIconStore()

const area = computed(() => {
  return areaStore.areaIdMap.get(props.item.areaId!)
})

const { loading, deleteItem, onSuccess } = useItemDelete()

onSuccess(form => emits('success', form))

const cancel = () => {
  emits('close', false)
}

const confirm = async () => {
  await deleteItem(props.item)
  emits('close', true)
}
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar :loading="loading" @close="cancel"> 删除物品 </WinDialogTitleBar>

    <div
      class="w-[300px] p-2 grid grid-rows-[auto_1fr] grid-cols-[auto_1fr] gap-2 text-[var(--el-text-color-primary)]"
    >
      <div class="row-span-2">
        <el-icon class="p-1" size="40" color="var(--el-color-danger)">
          <Delete />
        </el-icon>
      </div>

      <div>确实要永久性的删除此物品吗？</div>

      <div
        class="py-1 px-2 rounded flex items-center bg-[var(--el-bg-color)] border border-[var(--el-border-color)]"
      >
        <AppIconTagRenderer
          :src="iconStore.iconTextureUrl"
          :mapping="iconStore.iconCoordMap.get(item.iconId ?? -1)"
          class="shrink-0 w-12 h-12 mr-3 rounded-full bg-[#00000020] outline outline-[1px] outline-[#00000020] border-[3px] border-white overflow-hidden"
        />
        <div class="w-[158px] overflow-hidden">
          <div
            class="text-base font-[HYWenHei-85W] w-full overflow-hidden whitespace-nowrap text-ellipsis"
            :title="item.name"
          >
            {{ item.name }}
          </div>
          <div
            class="w-full text-xs overflow-hidden whitespace-nowrap text-ellipsis"
            :title="area?.name"
          >
            {{ area?.name ?? '未知地区' }}
          </div>
          <div class="text-xs">id {{ item.id }}</div>
        </div>
      </div>
    </div>

    <WinDialogFooter>
      <el-button :icon="Check" :loading="loading" type="danger" @click="confirm"> 是 </el-button>

      <el-button :icon="Close" :disabled="loading" @click="cancel"> 否 </el-button>
    </WinDialogFooter>
  </WinDialog>
</template>
