<script setup lang="ts">
defineProps<{
  config: DTO.ExtraConfig
}>()

const modelValue = defineModel<string[] | undefined>({
  required: true,
})
</script>

<template>
  <div class="mb-4">
    <div class="mb-1">1.6 版本海岛层级</div>

    <el-cascader
      v-model="modelValue"
      :options="config['1_6_island']?.stages ?? []"
      clearable
      class="w-full"
    />
  </div>
</template>
