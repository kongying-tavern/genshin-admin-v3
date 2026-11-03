<script lang="ts" setup>
import type { ArchiveData, ArchiveSlotData } from '@/stores'
import { CaretBottom, CaretTop, DeleteFilled, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { GSButton, GSCard, GSDivider, GSInput } from '@/components'
import { useFetchHook } from '@/hooks'
import { useArchiveStore } from '@/stores'
import { ArchiveHistory } from '.'

const props = defineProps<{
  slotIndex?: number
}>()
const emits = defineEmits<{
  (e: 'update:slotIndex', v?: number): void
}>()

const previewIndex = computed({
  get: () => props.slotIndex,
  set: v => emits('update:slotIndex', v),
})

const archiveStore = useArchiveStore()

const archiveSlot = ref<ArchiveSlotData>()
const initDialog = () => {
  if (previewIndex.value === undefined) return
  archiveSlot.value = archiveStore.archiveSlots[previewIndex.value]
}

// ==================== 存档槽位名称 ====================
const isNameEditMode = ref(false)
const cachedArchiveName = ref('')
const erroeMessage = autoResetRef('', 3000)

const enterNameEditMode = () => {
  cachedArchiveName.value = archiveSlot.value?.name ?? ''
  isNameEditMode.value = true
}

const cancelNameEdit = () => {
  cachedArchiveName.value = ''
  erroeMessage.value = ''
  isNameEditMode.value = false
}

const clearValidate = () => {
  erroeMessage.value = ''
}

const {
  refresh: submitNameChanged,
  loading: renameLoading,
  onSuccess: onSlotRenameSuccess,
  onError: onSlotRenameError,
} = useFetchHook({
  onRequest: async () => {
    if (!archiveSlot.value) throw new Error('槽位异常')
    cachedArchiveName.value = cachedArchiveName.value.trim()
    if (!cachedArchiveName.value.length) throw new Error('名称不能为空')
    await Apis.archive.renameSlot({
      pathParams: {
        slot_index: archiveSlot.value.slotIndex!,
        new_name: cachedArchiveName.value,
      },
    })
  },
})

onSlotRenameSuccess(async () => {
  await archiveStore.fetchArchive()
  initDialog()
  cancelNameEdit()
})

onSlotRenameError(err => {
  erroeMessage.value = err.message
})

// ==================== 底部信息栏 ====================
const stopSignal = ref(false)
const message = refAutoReset('', 3000)
const virtualRef = ref<HTMLElement>()
const note = (ev: Event, msg: string) => {
  if (stopSignal.value) {
    stopSignal.value = false
    return
  }
  virtualRef.value = ev.target as HTMLElement
  message.value = msg
}

// ==================== 存档逻辑 ====================
const {
  loading,
  refresh: saveArchive,
  onSuccess,
  onError,
} = useFetchHook({
  onRequest: async () => {
    await archiveStore.saveArchiveToSlot(previewIndex.value)
    await archiveStore.fetchArchive()
  },
})
onSuccess(async () => {
  previewIndex.value = undefined
})
onError(err =>
  ElMessage.error({
    message: `存档失败，原因为：${err.message}`,
  }),
)

/** 按住 3 秒以确认删除存档 */
const onAnimationEnd = (ev: AnimationEvent) => {
  if (!ev.animationName.startsWith('anime-delete-archive')) return
  archiveStore.deleteArchiveSlot(previewIndex.value)
  stopSignal.value = true
  previewIndex.value = undefined
}

/** 已选择的存档历史记录 */
const selectedHistory = shallowRef<ArchiveData>()

const loadArchive = () => {
  if (!selectedHistory.value) {
    archiveStore.loadArchiveSlot(previewIndex.value)
    previewIndex.value = undefined
    return
  }
  archiveStore.loadHistoryArchive(previewIndex.value!, selectedHistory.value.timestamp)
  previewIndex.value = undefined
}

// ==================== 弹窗状态处理 ====================
const onDialogClosed = () => {
  previewIndex.value = undefined
  stopSignal.value = false
  archiveSlot.value = undefined
  selectedHistory.value = undefined
  clearValidate()
  cancelNameEdit()
}

const beforeClose = (done: () => void) => {
  if (renameLoading.value || loading.value) return
  message.value = ''
  erroeMessage.value = ''
  done()
}
</script>

<template>
  <el-dialog
    :model-value="Number.isInteger(previewIndex)"
    :show-close="false"
    :close-on-click-modal="!loading"
    :before-close="beforeClose"
    append-to-body
    align-center
    width="500px"
    class="custom-dialog hidden-header bg-transparent"
    @open="initDialog"
    @closed="onDialogClosed"
  >
    <GSCard v-if="!archiveSlot" title="存档为空" />
    <GSCard v-else class="gap-4">
      <template #title>
        <div v-if="isNameEditMode" class="w-full flex items-center gap-2">
          <div class="flex items-center text-base">重命名</div>
          <el-tooltip
            placement="bottom"
            :content="erroeMessage"
            :visible="erroeMessage.length > 0"
            effect="customized"
            :popper-class="{
              'font-[\'HYWenHei-85W\']': true,
              'gs-tooltip': true,
              error: erroeMessage.length > 0,
            }"
          >
            <GSInput
              v-model="cachedArchiveName"
              :disabled="renameLoading"
              class="flex-1"
              autofocus
              @input="clearValidate"
            />
          </el-tooltip>
          <GSButton :loading="renameLoading" icon="submit" @click="submitNameChanged" />
          <GSButton :disabled="renameLoading" icon="cancel" @click="cancelNameEdit" />
        </div>
        <template v-else>
          <div
            class="w-full flex justify-center items-center gap-2 hover:underline decoration-dashed underline-offset-8 cursor-pointer"
            title="修改插槽名称"
            @click="enterNameEditMode"
          >
            {{ archiveSlot.name }}
            <el-icon :size="20" color="inherit">
              <Edit />
            </el-icon>
          </div>
        </template>
      </template>

      <span class="flex items-center gap-1 text-white">
        · 存档历史
        <el-icon :size="16" title="未选择历史记录时，将会自动读取最新记录。">
          <QuestionFilled />
        </el-icon>
      </span>

      <ArchiveHistory v-model="selectedHistory" :data="archiveSlot.archiveList" />

      <GSDivider color="gray" :height="16" />

      <div class="flex justify-between gap-4">
        <GSButton class="flex-1" :loading="loading" @click="saveArchive">
          <template #icon>
            <el-icon color="#FFCC33">
              <CaretTop />
            </el-icon>
          </template>
          保存到存档
        </GSButton>

        <el-tooltip :visible="Boolean(message)" :content="message" placement="bottom">
          <GSButton
            class="hold-and-delete"
            :disabled="loading"
            @click="e => note(e, '持续按住删除按钮以确认删除')"
            @animationend="onAnimationEnd"
          >
            <template #icon>
              <el-icon :size="16" color="#CF5945">
                <DeleteFilled />
              </el-icon>
            </template>
          </GSButton>
        </el-tooltip>

        <GSButton class="flex-1" :disabled="loading" @click="loadArchive">
          <template #icon>
            <el-icon color="#FFCC33">
              <CaretBottom />
            </el-icon>
          </template>
          {{ selectedHistory ? '读取该历史' : '读取存档' }}
        </GSButton>
      </div>
    </GSCard>
  </el-dialog>
</template>

<style lang="scss" scoped>
@property --angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes anime-delete-archive {
  10% {
    --angle: 0deg;
  }
  100% {
    --angle: 360deg;
  }
}

.hold-and-delete:active::before {
  content: '';
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  scale: 1.8;
  position: absolute;
  border-radius: 100%;
  background: conic-gradient(#ffcc33 var(--angle), transparent var(--angle));
  mask: radial-gradient(transparent 49%, #000 50%);
  animation: anime-delete-archive 3s linear forwards;
}
</style>
