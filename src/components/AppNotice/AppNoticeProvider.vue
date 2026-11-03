<script setup lang="ts">
import type { NoticeVo } from '@/api/alova/globals'
import { NoticeCard } from './components'
import { context } from './context'

const selectedNotice = shallowRef<NoticeVo>()
</script>

<template>
  <dialog :ref="context.dialogRef" class="app-notice-provider font-['HYWenHei-85W']">
    <NoticeCard v-model:selected-notice="selectedNotice" />
  </dialog>
</template>

<style scoped>
@property --dialog-backdrop-scale {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}

.app-notice-provider {
  --opacity: 0;
  --duration: 0.2s;
  --dialog-body-scale: 0.8;
  --dialog-body-tr-timing: ease;
  --dialog-body-tr-duration: 0.2s;

  display: grid;
  place-items: center;
  align-content: center;
  place-content: center;
  width: 100dvw;
  max-width: 100dvw;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  z-index: 10000;
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.4));
  background-color: transparent;
  outline: none;
  opacity: var(--opacity);
  pointer-events: none;
  transition:
    opacity ease 0.2s,
    background-color ease 0.2s;

  &[open] {
    --opacity: 1;
    --dialog-body-scale: 1;
    --dialog-body-tr-timing: cubic-bezier(0.18, 0.89, 0.32, 1.28);
    background-color: #00000040;
    pointer-events: auto;
  }

  &::backdrop {
    display: none;
  }
}
</style>
