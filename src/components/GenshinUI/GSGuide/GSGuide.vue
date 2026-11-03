<script setup lang="ts">
import GSButton from '../GSButton.vue'
import { CloseFilled } from '../GSIcon'
import { GuideBorder, GuideIcon } from './components'

defineProps<{
  title?: string
  content?: string
  hideClose?: boolean
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <div class="gs-guide">
    <div class="gs-guide-header">
      <div class="w-[64px] h-[64px] border-[3px] border-[#ECE5D840] rounded-full">
        <GuideIcon class="w-full h-full" />
      </div>
      <div v-if="!hideClose" class="absolute top-[45px] -translate-y-1/2 right-[30px]">
        <GSButton theme="plain" @click="() => $emit('close')">
          <template #icon>
            <el-icon color="var(--icon-color)" :size="20">
              <CloseFilled />
            </el-icon>
          </template>
        </GSButton>
      </div>
    </div>

    <div v-if="title || $slots.title" class="gs-guide-title">
      <slot name="title">
        {{ title }}
      </slot>
    </div>

    <div v-if="$slots.default" class="gs-guide-zone">
      <GuideBorder />
      <slot name="default" />
    </div>

    <div v-if="content || $slots.content" class="gs-guide-text">
      <slot name="content">
        {{ content }}
      </slot>
    </div>
  </div>
</template>

<style scoped>
@keyframes guide-anime-in {
  from {
    background-color: transparent;
    backdrop-filter: blur(0px);
  }
  to {
    background-color: #00000060;
    backdrop-filter: blur(8px);
  }
}

@keyframes guide-zone-anime-in {
  from {
    transform: scale(0.98);
  }
  to {
    transform: scale(1);
  }
}

.gs-guide {
  @apply fixed w-full h-full left-0 top-0 overflow-hidden
    grid place-content-center place-items-center
    z-50;
  animation: guide-anime-in ease-out 300ms forwards;
}

.gs-guide-header {
  @apply absolute w-full h-[90px] left-0 top-0
    flex justify-center items-center
    bg-[#00000060];
}

.gs-guide-title {
  @apply mb-5 px-6
    text-3xl text-[#D3BC8E] font-[HYWenHei-85W];
}

.gs-guide-zone {
  @apply w-[80dvw] aspect-video
    relative origin-center;
  padding: 0.8% 0.75%;
  animation: guide-zone-anime-in ease-out 150ms forwards;

  @media (min-width: 960px) {
    width: 768px;
  }
}

.gs-guide-text {
  @apply mt-5 px-6
    text-xl text-[#ECE5D8] font-[HYWenHei-85W];
}
</style>
