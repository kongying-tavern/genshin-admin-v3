<script setup lang="ts">
import { LoginPanel, RegisterPanel } from './components'

const props = defineProps<{
  code?: string
  username?: string
  isRegisterMode?: boolean
}>()

const emits = defineEmits<{
  success: []
  close: []
}>()

const isRegister = ref(Boolean(props.isRegisterMode))

watch(
  () => props.isRegisterMode,
  bool => {
    isRegister.value = bool
  },
)
</script>

<template>
  <transition :name="isRegister ? 'anime-right' : 'anime-left'" mode="out-in" appear>
    <component
      :is="isRegister ? RegisterPanel : LoginPanel"
      v-model:is-register="isRegister"
      :code="props.code"
      :username="props.username"
      @success="() => emits('success')"
      @close="() => emits('close')"
    />
  </transition>
</template>

<style scoped>
.anime-left-enter-active,
.anime-left-leave-active {
  transition-property: opacity transform;
  transition-duration: 150ms;
  transition-timing-function: ease;
}
.anime-left-enter-from,
.anime-left-leave-to {
  opacity: 0;
  transform-origin: 50% 50%;
}
.anime-left-enter-from {
  transform: translate(-50%, 0);
}
.anime-left-leave-to {
  transform: translate(50%, 0);
}

.anime-right-enter-active,
.anime-right-leave-active {
  transition-property: opacity transform;
  transition-duration: 150ms;
  transition-timing-function: ease;
}
.anime-right-enter-from,
.anime-right-leave-to {
  opacity: 0;
  transform-origin: 50% 50%;
}
.anime-right-enter-from {
  transform: translate(50%, 0);
}
.anime-right-leave-to {
  transform: translate(-50%, 0);
}
</style>
