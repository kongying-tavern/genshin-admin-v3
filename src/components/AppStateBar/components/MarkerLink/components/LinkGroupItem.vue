<script setup lang="ts">
import type { ModifyLinkOptions } from '../shared'
import LinkInfo from './LinkInfo.vue'

defineProps<{
  groupId: string
  group: Map<string, ModifyLinkOptions>
  groupTitle?: string
  isTemp?: boolean
  editable?: boolean
}>()

defineEmits<{
  delete: [linkKey: string, options: ModifyLinkOptions]
  extract: [linkKey: string, options: ModifyLinkOptions]
  revest: [linkKey: string, options: ModifyLinkOptions]
}>()

const hoverKey = defineModel<string>('hoverKey', {
  required: false,
  default: '',
})

const focusKey = defineModel<string>('focusKey', {
  required: false,
  default: '',
})
</script>

<template>
  <details
    class="link-group-item"
    :class="{
      'is-temp': isTemp,
    }"
    open
  >
    <summary class="link-group-summary" :title="groupTitle || groupId">
      <div>
        <template v-if="groupTitle">
          {{ groupTitle }}
        </template>
        <template v-else>
          组 <span class="text-xs font-mono">{{ groupId.slice(-8) }}</span>
        </template>
      </div>
      <div class="font-mono">({{ group.size }})</div>
    </summary>

    <div>
      <LinkInfo
        v-for="[key, opt] in group"
        :key="key"
        v-model:hover-key="hoverKey"
        v-model:focus-key="focusKey"
        :link-key="key"
        :link-option="opt"
        :editable="editable"
        @delete="() => $emit('delete', key, opt)"
        @extract="() => $emit('extract', key, opt)"
        @revest="() => $emit('revest', key, opt)"
      />
      <div
        v-if="!group.size"
        class="text-xs text-[var(--el-text-color-secondary)] grid place-items-center p-2"
      >
        关联项为空
      </div>
    </div>
  </details>
</template>

<style scoped>
.link-group-item {
  --propmt-color: var(--el-fill-color-darker);

  @apply w-full overflow-hidden my-2 rounded
    border border-[var(--propmt-color)];

  &.is-temp {
    --propmt-color: var(--el-color-warning-light-7);
  }

  &[open] summary {
    @apply border-b-[1px] border-[var(--el-border-color)];
  }
}

.link-group-summary {
  @apply flex justify-between items-center px-1
    overflow-hidden whitespace-nowrap text-ellipsis
    text-xs text-[var(--el-text-color-primary)] leading-[22px]
    select-none
    cursor-pointer;
  background-color: var(--propmt-color);
  &:hover {
    filter: brightness(105%);
  }
  &:active {
    filter: brightness(95%);
  }
}
</style>
