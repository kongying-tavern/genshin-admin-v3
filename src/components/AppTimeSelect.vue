<script lang="ts" setup>
const props = defineProps<{
  modelValue?: number
  disabled?: boolean
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', v?: number): void
}>()

const parseredTime = computed({
  get: () => {
    if (props.modelValue === undefined || props.modelValue < 0)
      return { days: 0, hours: 0, minutes: 0 }
    return {
      days: Math.floor(props.modelValue / 86400000),
      hours: Math.floor((props.modelValue % 86400000) / 3600000),
    }
  },
  set: ({ days, hours }) => {
    emits('update:modelValue', (days * 86400 + hours * 3600) * 1000)
  },
})

const naturalNumberComputed = <T extends keyof typeof parseredTime.value>(key: T) =>
  computed({
    get: () => `${parseredTime.value[key]}`,
    set: v => {
      const num = Number(v.trim())
      if (!Number.isInteger(num) || num < 0) return
      parseredTime.value = {
        ...parseredTime.value,
        [key]: Number(v.trim()),
      }
    },
  })

const days = naturalNumberComputed('days')
const hours = naturalNumberComputed('hours')
</script>

<template>
  <div v-bind="$attrs" class="app-time-select">
    <el-input v-model="days" :disabled="disabled" class="time-input">
      <template #append> 天 </template>
    </el-input>
    <el-input v-model="hours" :disabled="disabled" class="time-input">
      <template #append> 时 </template>
    </el-input>
  </div>
</template>

<style lang="scss" scoped>
.app-time-select {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  border-radius: 4px;
  text-align: center;
}

.time-input {
  :deep(.el-input__wrapper) {
    padding: 0;
    .el-input__inner {
      text-align: center;
    }
  }
  :deep(.el-input-group__append) {
    padding: 0 4px;
  }
}
</style>
