<script lang="ts" setup>
import { CircleCheck, Delete, Plus, Setting } from '@element-plus/icons-vue'
import { AppImageCropper } from '@/components'
import { formatByteSize } from '@/utils'
import { AddonTeleporter } from '.'
import { useLocalPicture, useMarkerPicture } from '../hooks'

// ==================== 表单图片 ====================
const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: '',
})

const { initLoading, thumbImageUrl } = useMarkerPicture(modelValue)

// ==================== 待上传图片 ====================
const {
  loading,
  localPictureUrl: newPictureUrl,
  refresh: selectFile,
  onSuccess: onSelectSuccess,
  clear: clearLocalPicture,
} = useLocalPicture()

// ==================== 生成缩略图 ====================
const isCropped = computed(() => modelValue.value.toLowerCase().startsWith('blob:'))

const croppedImage = shallowRef<Blob>()
const croppedImageUrl = ref('')

onUnmounted(() => {
  URL.revokeObjectURL(croppedImageUrl.value)
})

const withoutSearchParams = (url?: string) => {
  if (!url) return ''
  const urlObj = new URL(url)
  return `${urlObj.protocol}${urlObj.pathname}`
}

const onCrop = (image: Blob) => {
  URL.revokeObjectURL(croppedImageUrl.value)
  croppedImage.value = image
  croppedImageUrl.value = URL.createObjectURL(image)
  modelValue.value = croppedImageUrl.value
}

// ====================  清除图片  ====================
const clearImage = () => {
  modelValue.value = ''
  croppedImage.value = undefined
  croppedImageUrl.value = ''
  URL.revokeObjectURL(croppedImageUrl.value)
  clearLocalPicture()
}

// ====================  附加组件  ====================
const addonId = defineModel<string>('addonId', {
  required: false,
  default: '',
})

const isAddonActived = computed({
  get: () => addonId.value === 'picture',
  set: v => {
    addonId.value = v ? 'picture' : ''
  },
})

onSelectSuccess(file => {
  if (!file) return
  isAddonActived.value = true
})
</script>

<template>
  <div class="w-full flex justify-between">
    <div
      v-loading.fullscreen="loading"
      element-loading-text="等待文件系统响应..."
      element-loading-background="var(--el-mask-color-extra-light)"
      class="w-40 h-40 rounded overflow-hidden border border-dashed border-[var(--el-border-color)] hover:border-solid hover:border-[var(--el-border-color-hover)] cursor-pointer transition-[border-color]"
      @click="selectFile"
    >
      <img
        v-if="thumbImageUrl ?? modelValue"
        v-loading="initLoading"
        :src="isCropped ? withoutSearchParams(modelValue) : thumbImageUrl"
        crossorigin=""
        class="w-full h-full object-cover"
      />

      <div v-else class="w-full h-full flex flex-col items-center justify-center">
        <ElIcon :size="24">
          <Plus />
        </ElIcon>
        选择图片
      </div>
    </div>

    <div class="full flex-1 px-2 flex flex-col justify-between">
      <div class="flex flex-col justify-start">
        <el-button
          title="删除图片"
          plain
          type="danger"
          :icon="Delete"
          :disabled="!modelValue"
          style="width: 32px; padding: 0"
          @click="clearImage"
        />
      </div>
      <div
        v-if="croppedImage"
        class="text-xs gap-1 text-[var(--el-color-success)] leading-none grid grid-cols-[auto_1fr] grid-rows-2"
      >
        <el-icon class="row-span-2" :size="24">
          <CircleCheck />
        </el-icon>
        <div>预计大小</div>
        <div>
          {{ formatByteSize(croppedImage.size) }}
        </div>
      </div>
    </div>

    <el-button
      :icon="Setting"
      :type="isAddonActived ? 'primary' : ''"
      title="编辑图像"
      circle
      @click="isAddonActived = !isAddonActived"
    />

    <AddonTeleporter :active="isAddonActived">
      <div class="w-full h-full flex flex-col gap-2">
        <el-alert type="warning" :closable="false">
          注意事项：
          <li>裁切尺寸固定为 256x256。</li>
          <li>上传的图片可能需要等待 CDN 缓存刷新。</li>
        </el-alert>
        <div class="flex-1 grid place-items-center place-content-center gap-2">
          <AppImageCropper
            :image="newPictureUrl ?? thumbImageUrl"
            :auto-crop-on-image-loaded="newPictureUrl !== undefined"
            :auto-crop="newPictureUrl !== undefined"
            class="w-64 h-64"
            @crop="onCrop"
          />
        </div>
        <el-alert type="info" :closable="false">
          操作指南：
          <ol class="list-disc">
            <li class="ml-4">拖拽移动图像</li>
            <li class="ml-4">滚轮缩放图像</li>
          </ol>
        </el-alert>
      </div>
    </AddonTeleporter>
  </div>
</template>
