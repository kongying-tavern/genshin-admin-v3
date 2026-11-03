<script setup lang="ts">
import type { LinkActionEnum } from '@/shared'
import { LINK_ACTION_CONFIG, LINK_ACTION_OPTIONS } from '@/shared'
import LinkActionLabel from './LinkActionLabel.vue'

const modelValue = defineModel<LinkActionEnum>('modelValue', {
  required: true,
})

const color = computed(() => {
  const colorRange = LINK_ACTION_CONFIG[modelValue.value].lineColor
  return `rgba(${colorRange.join(' ')})`
})
</script>

<template>
  <div class="w-full flex flex-col justify-center items-center py-2">
    <ElSelectV2 v-model="modelValue" :options="LINK_ACTION_OPTIONS" style="width: 120px">
      <template #label>
        <LinkActionLabel :value="modelValue" />
      </template>

      <template #default="{ item }">
        <LinkActionLabel :value="item.value" />
      </template>
    </ElSelectV2>

    <div
      class="arrow-right"
      :style="{
        '--color': color,
      }"
    />
  </div>
</template>

<style scoped>
.arrow-right {
  --h: 8px;
  --stroke-width: 1px;

  margin: 4px 0;
  width: 100%;
  height: var(--h);
  background: var(--color);
  position: relative;

  clip-path: polygon(
    0% calc(50% - var(--stroke-width)),
    calc(100% - var(--h)) calc(50% - var(--stroke-width)),
    calc(100% - var(--h)) 0%,
    100% 50%,
    calc(100% - var(--h)) 100%,
    calc(100% - var(--h)) calc(50% + var(--stroke-width)),
    0% calc(50% + var(--stroke-width))
  );
}
</style>
