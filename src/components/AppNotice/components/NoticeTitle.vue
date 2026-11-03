<script setup lang="ts">
import type { NoticeVo } from '@/api/alova/globals'

defineProps<{
  notice: NoticeVo
  hidden: boolean
  isSelected: boolean
}>()

const emits = defineEmits<{
  click: [MouseEvent]
}>()
</script>

<template>
  <el-badge class="notice-title" style="width: 100%" :hidden="hidden" value=" ">
    <div
      :class="{
        'is-selected': isSelected,
      }"
      class="title-name"
      @click="ev => emits('click', ev)"
    >
      {{ notice.title }}
    </div>
  </el-badge>
</template>

<style scoped>
.notice-title {
  --mb: 0;

  &:not(:last-of-type) {
    --mb: 12px;
  }

  :deep(.el-badge__content) {
    border: none;
    filter: drop-shadow(0 0 1px #e6445e);
    &::before {
      content: '!';
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      display: grid;
      place-items: center;
      font-weight: bold;
      transform: translate(-1%, 3%) rotate(10deg);
    }
    &.is-fixed {
      width: 16px;
      height: 16px;
      right: 0;
      top: 0;
      transform: translate(50%, -50%);
      padding: 0;
      background-color: #e6445e;
    }
  }
}

.title-name {
  --padding: 2px;
  --line-color: #eee7dd;
  --arrow-opacity: 0;

  background: #f9f6f2;
  color: #737883;
  padding: 0 20px 0 12px;
  border-radius: 4px;
  position: relative;
  outline: 2px solid transparent;
  filter: drop-shadow(0 0 4px #33333340);
  cursor: pointer;
  user-select: none;
  margin: 0 0 var(--mb);
  height: 50px;
  line-height: 50px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;

  &:hover {
    outline-color: #e5bfb2;
    background: #ffffff;
  }

  &:active {
    --line-color: #e5d9c2;
    background: #f0efec;
  }

  &.is-selected {
    color: #3b4354;
    outline-color: #da9781;
    background: #fffdfa;
    --arrow-opacity: 1;
  }

  &::before {
    content: '';
    position: absolute;
    top: var(--padding);
    left: var(--padding);
    width: calc(100% - calc(2 * var(--padding)));
    height: calc(100% - calc(2 * var(--padding)));
    border-radius: 2px;
    border: 2px solid var(--line-color);
    pointer-events: none;
  }

  &::after {
    content: '';
    opacity: var(--arrow-opacity);
    position: absolute;
    width: 10px;
    height: 10px;
    top: 50%;
    right: 12px;
    background: conic-gradient(
      from -135deg at 50% 50%,
      transparent 25%,
      #3b4354 25%,
      #3b4354 75%,
      transparent 75%
    );
    filter: drop-shadow(0 0 2px #3b435480);
    border-radius: 1px;
    transform-origin: 50% 50%;
    transform: translate(0, -50%) rotate(45deg);
    transition: all 0.2s ease;
  }
}
</style>
