<script setup lang="ts">
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { useId } from 'vue'

const props = defineProps<{
  label?: string
  note?: string
  icon?: Component
  open?: boolean
  detailDisabled?: boolean
}>()

const emit = defineEmits<{
  expanded: [value: boolean]
}>()

const slots = defineSlots<{
  default: unknown
  label: unknown
  setting: unknown
  detail: unknown
  note: unknown
}>()

const detailId = useId()
const collapse = ref(props.detailDisabled ? true : !props.open)

watch(collapse, value => emit('expanded', !value))

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
        <div class="min-w-0 flex-1 flex items-center">
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

        <div class="min-w-0" @click.stop="">
          <slot name="setting" />
        </div>

        <button
          v-if="$slots.detail"
          type="button"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--el-color-primary)]"
          :disabled="detailDisabled"
          :aria-label="
            label
              ? `${collapse ? '展开' : '收起'}${label}`
              : collapse
                ? '展开设置详情'
                : '收起设置详情'
          "
          :aria-expanded="!collapse"
          :aria-controls="detailId"
          @click.stop="toggleCollapse"
        >
          <el-icon
            aria-hidden="true"
            :size="14"
            :color="detailDisabled ? 'var(--el-text-color-disabled)' : ''"
          >
            <ArrowDown v-if="collapse" />
            <ArrowUp v-else />
          </el-icon>
        </button>
      </div>
    </slot>

    <div
      v-if="$slots.detail"
      v-show="!collapse"
      :id="detailId"
      class="flex min-w-0 flex-col"
      @click.stop=""
    >
      <div class="w-full h-[1px] bg-[var(--el-bg-color)]" />
      <div class="min-w-0 p-2 sm:p-4">
        <slot name="detail" />
      </div>
    </div>
  </div>
</template>
