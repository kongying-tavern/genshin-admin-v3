<script lang="ts" setup>
import type { GSMessageProps } from '.'
import { promiseTimeout } from '@vueuse/core'
import { ClickOutside as vClickOutside } from 'element-plus'

const props = withDefaults(defineProps<Partial<GSMessageProps>>(), {
  message: '',
  duration: 3000,
})

const emits = defineEmits<{
  close: []
}>()

const visible = ref(true)

const closeMessageInAnimation = () => {
  visible.value = false
}

onMounted(async () => {
  if (!props.duration) return
  await promiseTimeout(props.duration)
  closeMessageInAnimation()
})

const onAnimationEnd = (ev: AnimationEvent) => {
  if (!ev.animationName.startsWith('message-anime-out')) return
  emits('close')
}
</script>

<template>
  <div
    v-click-outside="closeMessageInAnimation"
    class="gs-message"
    :class="[
      `gs-message--type-${type}`,
      {
        actived: visible,
        close: !visible,
      },
    ]"
    @animationend="onAnimationEnd"
  >
    {{ message }}
  </div>
</template>

<style lang="scss" scoped>
@keyframes message-anime-in {
  from {
    scale: 0.95;
    opacity: 0;
  }
  to {
    scale: 1;
    opacity: 1;
  }
}

@keyframes message-anime-out {
  from {
    scale: 1;
    opacity: 1;
  }
  to {
    scale: 0.95;
    opacity: 0;
  }
}

.gs-message {
  --message-bg: #283040;

  font-size: 16px;
  width: fit-content;
  padding: 1em;
  max-width: calc(100% - 2em);
  max-height: calc(100% - 2em);
  background: var(--message-bg);
  color: #ece5d8;
  outline: 2px solid #ffffff40;
  border-radius: 6px;
  animation: message-anime-in 100ms ease-out forwards;
  scale: 0.95;
  opacity: 0;

  &.close {
    animation: message-anime-out 100ms ease-out forwards;
  }
}

.gs-message--type-error {
  --message-bg: var(--el-color-error-dark-2);
}
</style>
