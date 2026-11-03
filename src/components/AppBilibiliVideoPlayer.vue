<script lang="ts" setup>
import { WinDialog, WinDialogTitleBar } from '@/components'

const props = withDefaults(
  defineProps<{
    url: string
    width?: number
    height?: number
    isDialog?: boolean
  }>(),
  {
    width: 640,
    height: 320,
    isDialog: true,
  },
)

const emits = defineEmits<{
  close: []
}>()

const playerUrl = computed(() => {
  const bvid = props.url.match(/\/video\/([a-zA-Z0-9]+)/)?.[1]
  if (!bvid) return ''
  const urlObject = new URL(props.url)
  const params = new URLSearchParams(urlObject.searchParams)
  params.set('bvid', bvid)
  const iframeUrl = `//player.bilibili.com/player.html?${params.toString()}`
  return iframeUrl
})
</script>

<template>
  <WinDialog>
    <WinDialogTitleBar v-if="props.isDialog" @close="() => emits('close')">
      视频预览
    </WinDialogTitleBar>

    <div
      class="rounded overflow-hidden"
      :style="{ width: `${props.width}px`, height: `${props.height}px` }"
    >
      <template v-if="!playerUrl">
        <slot name="error"> 无法解析视频地址 </slot>
      </template>

      <iframe
        v-else
        :src="playerUrl"
        scrolling="no"
        border="0"
        frameborder="no"
        framespacing="0"
        allowfullscreen="true"
        style="width: 100%; height: 100%"
      />
    </div>
  </WinDialog>
</template>
