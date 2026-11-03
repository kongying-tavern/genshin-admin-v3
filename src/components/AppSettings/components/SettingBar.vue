<script setup lang="ts">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'

const props = defineProps<{
  label?: string
  note?: string
  icon?: Component
  open?: boolean
  detailDisabled?: boolean
}>()

const slots = defineSlots<{
  default: unknown
  label: unknown
  setting: unknown
  detail: unknown
  note: unknown
}>()

const collapse = ref(props.detailDisabled ? true : !props.open)

watch(
  () => props.detailDisabled,
  disabled => {
    if (!disabled) {
      slots.detail && (collapse.value = false)
      return
    }
    collapse.value = true
  },
)

const toggleCollapse = () => {
  if (props.detailDisabled || !slots.detail) return
  collapse.value = !collapse.value
}
</script>

<template>
  <div
    class="flex flex-col bg-[var(--el-fill-color-light)] select-none rounded overflow-hidden"
    @click="toggleCollapse"
  >
    <slot name="default">
      <div
        class="min-h-[66px] flex gap-2 flex-shrink-0 items-center px-4 py-3 transition-[background-color]"
        :class="
          !detailDisabled && $slots.detail
            ? 'hover:bg-[var(--el-fill-color)] active:bg-[var(--el-fill-color-darker)]'
            : ''
        "
      >
        <div class="flex-1 flex items-center">
          <div v-if="icon" class="grid place-items-center pr-4">
            <el-icon :size="20">
              <component :is="icon" />
            </el-icon>
          </div>

          <div class="flex-1 flex flex-col">
            <slot name="label">
              <div v-if="label" class="text-[var(--el-text-color-primary)]">
                {{ label }}
              </div>
            </slot>
            <slot name="note">
              <div v-if="note" class="text-xs text-[var(--el-text-color-regular)]">
                {{ note }}
              </div>
            </slot>
          </div>
        </div>

        <div @click.stop="">
          <slot name="setting" />
        </div>

        <div v-if="$slots.detail" class="pl-4 flex items-center">
          <el-icon :size="14" :color="detailDisabled ? 'var(--el-text-color-disabled)' : ''">
            <ArrowDown v-if="collapse" />
            <ArrowUp v-else />
          </el-icon>
        </div>
      </div>
    </slot>

    <div
      v-if="$slots.detail"
      class="flex flex-col transition-all ease-in-out"
      :class="collapse ? 'max-h-0' : 'max-h-[1000px]'"
      @click.stop=""
    >
      <div class="w-full h-[1px] bg-[var(--el-bg-color)]" />
      <div class="p-4">
        <slot name="detail" />
      </div>
    </div>
  </div>
</template>
