<script lang="ts" setup>
import { GSButton, GSCard, GSInput, GSSwitch } from '@/components'
import { useFetchHook } from '@/hooks'
import { useArchiveStore } from '@/stores'

const props = defineProps<{
  slotIndex?: number
}>()
const emits = defineEmits<{
  (e: 'update:slotIndex', v?: number): void
}>()

const indexShowCache = ref(props.slotIndex)
const onOpenDialog = () => {
  indexShowCache.value = props.slotIndex
}

const index = computed({
  get: () => props.slotIndex,
  set: v => emits('update:slotIndex', v),
})

const archiveStore = useArchiveStore()

const saveCurrent = ref(true)

// ==================== 新增存档 ====================
const archiveName = ref('')
const errMsg = ref('')

const onCloseDialog = () => {
  archiveName.value = ''
  errMsg.value = ''
  index.value = undefined
}

const {
  loading,
  refresh: createArchive,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: async () => {
    errMsg.value = ''
    archiveName.value = archiveName.value.trim()
    if (index.value === undefined) throw new Error('无效的存档槽位')
    if (archiveName.value.length < 1) throw new Error('存档名称长度不能小于 1 个字符')
    await archiveStore.createArchiveSlot(archiveName.value, index.value, saveCurrent.value)
    await archiveStore.fetchArchive()
    archiveStore.loadArchiveSlot(index.value)
  },
})

onSuccess(() => {
  index.value = undefined
})

onError(err => {
  errMsg.value = err.message
})

const onBeforeClose = (done: () => void) => {
  !loading.value && done()
}

onUnmounted(() => {
  archiveName.value = ''
  errMsg.value = ''
})
</script>

<template>
  <el-dialog
    :model-value="Number.isInteger(index)"
    :show-close="false"
    :before-close="onBeforeClose"
    append-to-body
    align-center
    width="500px"
    class="custom-dialog hidden-header bg-transparent"
    @closed="onCloseDialog"
    @open="onOpenDialog"
  >
    <GSCard class="gap-4" :title="`新建存档 ${indexShowCache}`">
      <div class="flex-1 flex flex-col mt-10 mb-10 gap-2">
        <GSInput v-model="archiveName" placeholder="请输入存档名称" />
        <GSSwitch
          v-model="saveCurrent"
          label="同时保存当前数据"
          label-inactive-color="#D1D5DB"
          label-active-color="#D1D5DB"
        />
        <div class="err-msg font-['HYWenHei-85W'] text-base h-6">
          {{ errMsg }}
        </div>
      </div>

      <div class="flex justify-between gap-4">
        <GSButton icon="submit" class="flex-1" :loading="loading" @click="createArchive">
          确定
        </GSButton>
        <GSButton icon="cancel" class="flex-1" @click="index = undefined"> 取消 </GSButton>
      </div>
    </GSCard>
  </el-dialog>
</template>

<style lang="scss" scoped>
.err-msg {
  color: #cf5945;
}
</style>
