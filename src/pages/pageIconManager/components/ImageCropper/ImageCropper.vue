<script setup lang="ts">
import type { IconVariant } from '../../types'
import { Aim, ArrowDown, Delete, FolderOpened } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getObjectFitSize } from '@/utils'
import { useImageCropper } from './hooks'

const props = withDefaults(
  defineProps<{
    raw?: string
    showPreview?: boolean
    disabledDelete?: boolean
    variant: IconVariant
    loading?: boolean
  }>(),
  {
    showPreview: true,
    loading: false,
  },
)

const emits = defineEmits<{
  /** 点击删除按钮 */
  delete: [variant: IconVariant]
  /** 输出尺寸发生变化 */
  outputChange: [size: { w: number; h: number }]
  /** 裁切器发生图片加载事件 */
  imageLoad: [
    meta: {
      variant: IconVariant
      bmp: ImageBitmap
      blob: Blob
      isRaw: boolean
      canvas: HTMLCanvasElement
    },
  ]
}>()

/** 裁切器界面 */
const config = ref({
  /** 原始尺寸 */
  rawSize: false,
  /** 圆形裁切 */
  clipCircle: false,
  /** 保持比例 */
  keepRatio: true,
})

/** 缓存圆形裁剪路径 */
const clipPathCache = shallowRef<Path2D | null>(null)

/** 初始图像 */
const oldImage = shallowRef<ImageBitmap | null>(null)
/** 新图像 */
const newImage = shallowRef<ImageBitmap | null>(null)
/** 输出图像尺寸 */
const outputSize = ref({ w: 0, h: 0 })

/** 裁切容器 */
const containerRef = shallowRef<HTMLDivElement>()
/** 预览容器 */
const previewerRef = shallowRef<HTMLCanvasElement>()
/** 预览容器的上下文 */
const previewerCtxRef = shallowRef<CanvasRenderingContext2D>()
/** 预览容器尺寸 */
const previewerSize = computed(() => {
  if (!config.value.rawSize || !newImage.value) return { w: 64, h: 64 }
  return outputSize.value
})

const disabledEdit = computed(() => {
  return props.loading || !newImage.value
})

/** 裁切逻辑封装 */
const {
  ready,
  destory,
  autoFit,
  loadFromFile,
  loadFromSrc,
  onFrame,
  onImageLoad,
  onError: onCropperError,
} = useImageCropper(containerRef, {
  disabled: disabledEdit,
  variant: computed(() => props.variant),
  keepRatio: computed(() => config.value.keepRatio),
})

const cleanups = ref<(() => void)[]>([])

/** 记录首次加载图片 */
const imageLoadHook = onImageLoad(({ bmp, blob, isRaw }) => {
  if (!previewerRef.value) return
  if (isRaw) {
    oldImage.value = bmp
    newImage.value = null
  } else {
    newImage.value = bmp
  }
  emits('imageLoad', {
    variant: props.variant,
    bmp,
    blob,
    isRaw,
    canvas: previewerRef.value,
  })
})
cleanups.value.push(imageLoadHook.off)

/** 错误处理 */
const cropperErrorHook = onCropperError(err => {
  ElMessage.error(err.message)
})
cleanups.value.push(cropperErrorHook.off)

/** 连续绘制截取区 */
const frameHook = onFrame(({ rect, image }) => {
  const ctx = previewerCtxRef.value
  if (!ctx) return
  const raw = newImage.value
  if (!raw) return
  const { width: cw, height: ch } = ctx.canvas
  ctx.clearRect(0, 0, cw, ch)
  ctx.save()
  if (config.value.clipCircle) {
    // 缓存裁剪路径，只在尺寸变化时重建
    if (!clipPathCache.value) {
      const maxEdge = Math.max(cw, ch)
      const ccw = cw / 2
      const cch = ch / 2
      const r = maxEdge / 2
      clipPathCache.value = new Path2D()
      clipPathCache.value.arc(ccw, cch, r, 0, 2 * Math.PI)
    }
    ctx.clip(clipPathCache.value)
  }
  // 基于原图尺寸渲染
  if (config.value.rawSize) {
    const { width: rawW, height: rawH } = raw
    const { x: baseX, y: baseY, width: baseW, height: baseH } = image.getClientRect()
    const { x: rectX, y: rectY, width: rectW, height: rectH } = rect.getClientRect()
    const x = (rawW * (rectX - baseX)) / baseW
    const y = (rawH * (rectY - baseY)) / baseH
    const w = Math.round((rawW * rectW) / baseW)
    const h = Math.round((rawH * rectH) / baseH)
    outputSize.value = { w, h }
    ctx.drawImage(raw, x, y, w, h, 0, 0, w, h)
  }
  // 基于缩比场景渲染
  else {
    const { width: rawW, height: rawH } = raw
    const { x: baseX, y: baseY, width: baseW, height: baseH } = image.getClientRect()
    const { x: rectX, y: rectY, width: rectW, height: rectH } = rect.getClientRect()
    // 计算裁剪区域在原始图像上的坐标和尺寸
    const sx = (rawW * (rectX - baseX)) / baseW
    const sy = (rawH * (rectY - baseY)) / baseH
    const sw = Math.round((rawW * rectW) / baseW)
    const sh = Math.round((rawH * rectH) / baseH)
    // 计算在预览画布上的目标尺寸
    const { dx, dy, dw, dh } = getObjectFitSize('contain', cw, ch, sw, sh)
    outputSize.value = { w: dw, h: dh }
    ctx.drawImage(raw, sx, sy, sw, sh, dx, dy, dw, dh)
  }
  ctx.restore()
})
cleanups.value.push(frameHook.off)

// 只在尺寸真正变化时才触发 emits
watch(
  outputSize,
  size => {
    emits('outputChange', size)
  },
  { deep: true },
)

// 预览尺寸变化时清除裁剪路径缓存
watch(previewerSize, () => {
  clipPathCache.value = null
})

/** 绘制裁切预览 */
onMounted(() => {
  const canvas = previewerRef.value!
  const ctx = canvas.getContext('2d')!
  previewerCtxRef.value = ctx
})

watch(
  () => props.raw,
  async url => {
    if (!url) return
    await ready
    await loadFromSrc(url, { isRaw: true })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  cleanups.value.forEach(off => off())
  destory()
})
</script>

<template>
  <div class="overflow-hidden flex flex-col gap-2">
    <div class="shrink-0 w-full flex gap-1">
      <!-- 裁切容器 -->
      <div
        ref="containerRef"
        class="cropper-container shrink-0 w-[240px] h-[240px] chessboard-background overflow-hidden"
      />

      <!-- 右侧状态栏 -->
      <div class="flex-1 h-[240px] flex flex-col gap-1">
        <div class="flex gap-1">
          <el-button
            style="width: 100%"
            :icon="FolderOpened"
            :disabled="loading"
            size="small"
            @click="() => loadFromFile()"
          >
            选择
          </el-button>
          <el-button
            v-if="variant !== 'default'"
            style="margin-left: 0"
            type="danger"
            plain
            :icon="Delete"
            :disabled="loading || props.disabledDelete"
            size="small"
            @click="() => emits('delete', variant)"
          />
        </div>

        <!-- 修改前预览 -->
        <div class="flex-1 flex flex-col gap-0.5 items-center justify-center select-none">
          <template v-if="oldImage">
            <img
              class="w-[66px] h-[66px] border border-[var(--el-border-color)] object-contain"
              :src="props.raw"
              draggable="false"
              crossorigin=""
            />
            <div class="shrink-0 text-xs">
              {{ `${oldImage.width.toFixed(2)} x ${oldImage.height.toFixed(2)}` }}
            </div>
          </template>
          <div
            v-else
            class="w-[66px] h-[66px] text-xs grid place-content-center border border-[var(--el-border-color)]"
          >
            无
          </div>
        </div>

        <!-- 指向图标 -->
        <div v-show="props.showPreview" class="flex items-center justify-center">
          <el-icon>
            <ArrowDown />
          </el-icon>
        </div>

        <!-- 修改后预览 -->
        <div
          v-show="props.showPreview"
          class="flex-1 flex flex-col gap-0.5 items-center justify-center"
        >
          <div
            class="w-[66px] h-[66px] border border-[var(--el-border-color)] relative scale-container"
          >
            <canvas
              v-show="newImage"
              ref="previewerRef"
              class="scale-to-container"
              :style="{
                '--w': previewerSize.w,
                '--h': previewerSize.h,
              }"
              :class="{
                'raw-size': config.rawSize,
              }"
              :width="previewerSize.w"
              :height="previewerSize.h"
            />
            <div
              v-show="!newImage"
              class="w-full h-full text-xs grid place-content-center select-none"
            >
              无
            </div>
          </div>

          <div v-if="newImage" class="shrink-0 text-xs">
            {{ `${outputSize.w.toFixed(2)} x ${outputSize.h.toFixed(2)}` }}
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="h-[32px] flex items-center">
      <div class="shrink-0 flex gap-2 items-center">
        <el-check-tag v-model:checked="config.clipCircle"> 圆形裁切 </el-check-tag>
        <el-check-tag v-model:checked="config.rawSize"> 原始尺寸 </el-check-tag>
        <el-check-tag v-model:checked="config.keepRatio"> 锁定比例 </el-check-tag>
      </div>

      <el-button
        class="ml-auto" size="small" :icon="Aim"
        :disabled="disabledEdit" @click="autoFit"
      >
        自适应
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chessboard-background {
  --s: 32px;
  --color-a: transparent;
  --color-b: var(--el-fill-color-darker);
  background: conic-gradient(
    from 0deg at 50% 50%,
    var(--color-a) 25%,
    var(--color-b) 25%,
    var(--color-b) 50%,
    var(--color-a) 50%,
    var(--color-a) 75%,
    var(--color-b) 75%,
    var(--color-b) 100%
  );
  background-size: var(--s) var(--s);
}

.scale-container {
  display: grid;
  place-content: center;
}

.scale-to-container {
  --scale: 1;
  transform-origin: center;
  transform: scale(var(--scale));

  &.raw-size {
    --scale: calc(min(64 / var(--w), 64 / var(--h)));
  }
}
</style>
