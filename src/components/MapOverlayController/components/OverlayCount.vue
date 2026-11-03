<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    current?: number
    total?: number
    label: string
    maxLength?: number
  }>(),
  {
    current: 0,
    total: 0,
    maxLength: 2,
  },
)

const isActived = computed(() => props.current > 0)
</script>

<template>
  <div class="flex-1 flex items-center overflow-hidden gap-1">
    <div
      class="h-5 min-w-[20px] px-1 grid place-content-center rounded text-xs border font-mono"
      :class="
        isActived ? 'text-[#CCFF33] border-[#FFF] bg-[#809933]' : 'border-[currentColor] opacity-40'
      "
      title="已启用 / 图层总数"
    >
      {{ !current ? '--' : `${current}`.padStart(maxLength, '0') }}
      /
      {{ !total ? '--' : `${total}`.padStart(maxLength, '0') }}
    </div>
    <div class="flex-1 overflow-hidden whitespace-nowrap text-ellipsis" :title="label">
      {{ label }}
    </div>
  </div>
</template>
