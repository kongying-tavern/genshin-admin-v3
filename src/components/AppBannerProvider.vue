<script lang="ts" setup>
import { Close } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { useBanner } from '@/hooks'

const { content, visible, close } = useBanner()
</script>

<template>
  <Transition name="draw-y" mode="out-in" appear>
    <div
      v-show="visible"
      class="fixed w-full h-8 top-0 overflow-hidden flex items-center bg-[#E2DED5] font-[HYWenHei-85W] text-[#4A4F50] text-md text-center leading-8 z-[3000]"
    >
      <div class="flex-1 overflow-hidden">
        <div class="whitespace-nowrap overflow-hidden text-ellipsis">
          {{ content }}
        </div>
      </div>

      <ElIcon class="p-1 hover:bg-[#F4E3C0] active:bg-[#FFFFFF]" :size="32" @click="close">
        <Close />
      </ElIcon>
    </div>
  </Transition>
</template>
