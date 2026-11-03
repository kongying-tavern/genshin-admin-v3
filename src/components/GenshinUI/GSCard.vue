<script lang="ts" setup>
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="genshin-dark-card flex flex-col" v-bind="$attrs">
    <slot name="header">
      <div
        v-if="title || $slots.title"
        class="genshin-card-title font-['HYWenHei-85W'] text-center px-[36px]"
      >
        <slot name="title">
          {{ title }}
        </slot>
      </div>
    </slot>

    <slot name="default" />
  </div>
</template>
