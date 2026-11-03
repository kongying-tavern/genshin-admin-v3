<script lang="ts" setup>
import { Setting } from '@element-plus/icons-vue'
import { ElButton, ElInput } from 'element-plus'
import { AppBilibiliVideoPlayer } from '@/components'
import { AddonTeleporter } from '.'
import { useAddonActive } from '../hooks'

const videoURL = defineModel('modelValue', {
  required: false,
  default: '',
})

const cachedVideoURL = ref(videoURL.value)

const addonId = defineModel<string>('addonId', { required: true })
const isAddonActive = useAddonActive(addonId, 'video')
</script>

<template>
  <div class="w-full flex gap-1">
    <ElInput v-model="videoURL" />

    <ElButton
      :icon="Setting"
      :type="isAddonActive ? 'primary' : ''"
      title="配置视频链接"
      class="flex-shrink-0"
      circle
      @click="isAddonActive = !isAddonActive"
    />

    <AddonTeleporter :active="isAddonActive">
      <div class="">
        <div class="font-bold">原视频</div>
        <div v-if="!cachedVideoURL">无视频</div>
        <AppBilibiliVideoPlayer
          v-else
          :url="cachedVideoURL"
          :width="384"
          :height="216"
          :is-dialog="false"
        />

        <template v-if="videoURL !== cachedVideoURL">
          <div class="font-bold mt-8">新视频</div>
          <div
            v-if="!videoURL"
            class="w-96 h-[216px] grid place-content-center border border-[var(--el-border-color)] text-[var(--el-text-color-secondary)]"
          >
            无
          </div>

          <AppBilibiliVideoPlayer
            v-else
            :url="videoURL"
            :width="384"
            :height="216"
            :is-dialog="false"
          >
            <template #error>
              <div
                class="w-96 h-[216px] grid place-content-center border border-[var(--el-color-danger)] bg-[var(--el-color-danger-light-9)] text-[var(--el-color-danger)]"
              >
                视频地址有误
              </div>
            </template>
          </AppBilibiliVideoPlayer>
        </template>
      </div>
    </AddonTeleporter>
  </div>
</template>
