<script lang="ts" setup>
import type { ShallowRef } from 'vue'
import type { ItemVo, MarkerVo } from '@/api/alova/globals'
import { Check, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores'
import { MarkerForm } from './components'
import { useMarkerCreate } from './hooks'

const props = defineProps<{
  coordinate: DTO.Coordinate2D
  defaultItem?: ItemVo
}>()

const emits = defineEmits<{
  close: []
}>()

const userStore = useUserStore()

/** 初始化新增点位信息 */
const initFormData = (): MarkerVo => {
  const [x, y] = props.coordinate
  return {
    markerTitle: props.defaultItem?.name ?? '',
    content: props.defaultItem?.defaultContent ?? '',
    hiddenFlag: 0,
    position: `${x},${y}`,
    itemList: props.defaultItem
      ? [
          {
            count: props.defaultItem.defaultCount ?? 1,
            iconId: props.defaultItem.iconId,
            itemId: props.defaultItem.id,
          },
        ]
      : [],
    videoPath: '',
    refreshTime: props.defaultItem?.defaultRefreshTime ?? 0,
    markerCreatorId: userStore.info?.id,
  }
}

/** 表单数据 */
const form = ref(initFormData())
const editorRef = useTemplateRef('editorRef')

const { loading, isSuccess, submit, onSuccess } = useMarkerCreate(
  form,
  editorRef as ShallowRef<InstanceType<typeof MarkerForm>>,
)

onSuccess(() => emits('close'))
</script>

<template>
  <MarkerForm
    ref="editorRef"
    v-model="form"
    title="新增点位"
    :loading="loading"
    @close="() => emits('close')"
  >
    <template #footer>
      <div class="w-full flex justify-end">
        <el-button
          :icon="Check"
          :loading="loading"
          :disabled="isSuccess"
          type="primary"
          @click="submit"
        >
          添加
        </el-button>
        <el-button :icon="Close" :disabled="loading" @click="() => emits('close')">
          取消
        </el-button>
      </div>
    </template>
  </MarkerForm>
</template>
