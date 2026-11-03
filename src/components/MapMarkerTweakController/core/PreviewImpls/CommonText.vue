<script setup lang="ts">
import type { ModifierConstructorOptions } from '..'
import type { TextModifierProps } from '../modifiers'

defineProps<{
  options: ModifierConstructorOptions<TextModifierProps>
  value: string
  oldValue?: string
}>()
</script>

<template>
  <div class="common-text h-full overflow-hidden text-xs py-1" :title="value">
    <div v-if="value === oldValue" class="text-[var(--el-text-color-secondary)]">无变化</div>
    <div v-else class="h-full overflow-hidden">
      <textarea
        readonly
        :value="value"
        class="w-full h-full outline-none resize-none bg-transparent text-wrapper"
      />
    </div>
  </div>
</template>

<style scoped>
.text-wrapper {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
    cursor: pointer;
    background-color: light-dark(#fcfcfc, #2c2c2c);
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 3px;
    cursor: pointer;
    background-color: light-dark(#8b8b8b, #9f9f9f);
    border-width: 1px;
    border-style: solid;
    border-color: light-dark(#fcfcfc, #2c2c2c);
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: light-dark(#b9b8b8, #d6d4d4);
    border-color: light-dark(#b9b8b8, #d6d4d4);
  }
}
</style>
