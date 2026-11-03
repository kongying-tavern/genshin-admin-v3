<script setup lang="ts">
import { useArchiveStore } from '@/stores'
import BarItem from './BarItem.vue'

const archiveStore = useArchiveStore()

const isPopoverHide = computed({
  get: () => {
    return archiveStore.currentArchive.body.Preference['map.setting.hideMarkerPopover']
  },
  set: v => {
    archiveStore.currentArchive.body.Preference['map.setting.hideMarkerPopover'] = v
  },
})

const prefix = crypto.randomUUID()
</script>

<template>
  <BarItem divider :label="`点位弹窗：${isPopoverHide ? '隐藏' : '显示'}`">
    <div
      class="w-8 h-8 relative grid place-items-center"
      :class="{
        'text-[var(--el-color-danger)]': isPopoverHide,
      }"
      @click="isPopoverHide = !isPopoverHide"
    >
      <el-icon :size="20">
        <svg class="icon" viewBox="0 0 1024 1024" fill="currentColor">
          <defs>
            <g :id="`${prefix}-a`">
              <path
                d="M170.666667 85.333333h682.666666a85.333333 85.333333 0 0 1 85.333334 85.333334v512a85.333333 85.333333 0 0 1-85.333334 85.333333h-170.666666l-170.666667 170.666667-170.666667-170.666667H170.666667a85.333333 85.333333 0 0 1-85.333334-85.333333V170.666667a85.333333 85.333333 0 0 1 85.333334-85.333334m0 85.333334v512h206.08L512 817.92 647.253333 682.666667H853.333333V170.666667H170.666667z"
              />
            </g>
            <g :id="`${prefix}-b`" transform="scale(0.8 1)">
              <path
                d="M10.211016 18.410836C26.610656-2.388708 56.809993-6.188624 77.609536 10.211016l1183.974009 927.979628c20.799543 16.39964 24.59946 46.598977 8.19982 67.39852s-46.598977 24.59946-67.398521 8.19982l-1183.974008-927.979628C-2.388707 69.409716-6.188624 39.210379 10.211016 18.410836z"
              />
            </g>
            <mask :id="`${prefix}-c`">
              <g>
                <rect x="0" y="0" width="1024" height="1024" fill="#fff" />
                <use :href="`#${prefix}-b`" fill="#000" stroke="#000" stroke-width="20%" />
              </g>
            </mask>
          </defs>
          <use :href="`#${prefix}-a`" :mask="isPopoverHide ? `url(#${prefix}-c)` : ''" />
          <use v-if="isPopoverHide" :href="`#${prefix}-b`" />
        </svg>
      </el-icon>
    </div>
  </BarItem>
</template>
