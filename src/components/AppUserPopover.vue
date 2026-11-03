<script lang="ts" setup>
import type { SysUserSmallVo } from '@/api/alova/globals'

defineProps<{
  triggerRef?: HTMLElement | null
  data?: SysUserSmallVo | null
}>()
</script>

<template>
  <el-popover
    :virtual-ref="triggerRef"
    :visible="Boolean(triggerRef)"
    :width="data?.logo ? '260px' : '130px'"
    virtual-triggering
    placement="top"
  >
    <div
      v-if="data"
      class="grid gap-x-2"
      :style="[`grid-template-columns: ${data.logo ? 'auto' : ''} 1fr`]"
    >
      <img
        v-if="data.logo"
        :src="data.logo"
        class="w-24 rounded aspect-square row-span-4"
        style="
          border-color: var(--el-color-primary-light-8);
          background-color: var(--el-color-primary-light-9);
        "
      />
      <div class="whitespace-nowrap overflow-hidden text-ellipsis">账号：{{ data.username }}</div>
      <div class="whitespace-nowrap overflow-hidden text-ellipsis">昵称：{{ data.nickname }}</div>
      <div class="whitespace-nowrap overflow-hidden text-ellipsis">Q号：{{ data.qq || '--' }}</div>
      <div class="whitespace-nowrap overflow-hidden text-ellipsis">
        手机：{{ data.phone || '--' }}
      </div>
    </div>
  </el-popover>
</template>
