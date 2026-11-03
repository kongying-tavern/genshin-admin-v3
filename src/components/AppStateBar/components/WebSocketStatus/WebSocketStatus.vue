<script setup lang="ts">
import { ChromeFilled } from '@element-plus/icons-vue'
import { AppWindowTeleporter, useAppWindow } from '@/components'
import { useSocketStore } from '@/stores'
import BarItem from '../BarItem.vue'
import StatusWindow from './StatusWindow.vue'

const socketStore = useSocketStore()

const { width, height } = useElementSize(document.body, {
  width: 960,
  height: 540,
})

const { info, toggle } = useAppWindow(
  computed(() => ({
    name: '事件记录',
    minWidth: 320,
    minHeight: 400,
    x: width.value - 320 - 6,
    y: height.value - 400 - 50,
  })),
)

const delay = computed(() => Math.min(999, Math.max(0, socketStore.context.delay)))

const isOpen = computed(() => socketStore.context.status === 'OPEN')
const isConnecting = computed(() => socketStore.context.status === 'CONNECTING')

const statusText = computed(() => {
  const { status } = socketStore.context
  return {
    INIT: '初始化',
    CONNECTING: '连接中',
    CLOSED: '未连接',
    CLOSING: '关闭中',
    OPEN: `${delay.value}ms`,
  }[status]
})

const color = computed(() => {
  if (isConnecting.value) return 'var(--color-conn)'
  if (!isOpen.value) return 'var(--color-null)'
  if (delay.value > 500) return 'var(--color-slow)'
  if (delay.value > 200) return 'var(--color-norm)'
  return 'var(--color-fast)'
})
</script>

<template>
  <BarItem label="连接状态" divider @click="toggle">
    <div
      class="h-full flex items-center px-1"
      :style="{
        color: color,
        '--color-conn': '#9CDCDA',
        '--color-null': '#3B4255',
        '--color-fast': '#97C933',
        '--color-norm': '#FFCC32',
        '--color-slow': '#FE5C5C',
      }"
    >
      <div v-if="isConnecting" class="h-full flex items-center">
        <el-icon :size="16" color="var(--color-conn)" class="is-loading">
          <ChromeFilled />
        </el-icon>
      </div>

      <div v-else class="h-full flex items-center">
        <el-icon :size="16" color="currentColor">
          <svg
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
          >
            <path
              d="M944.35555555 2.27555555H780.51555555c-20.13866667 0-36.40888889 16.27022222-36.40888888 36.4088889v946.6311111c0 20.13866667 16.27022222 36.40888889 36.40888888 36.4088889h163.84c20.13866667 0 36.40888889-16.27022222 36.4088889-36.4088889V38.68444445c0-20.13866667-16.27022222-36.40888889-36.4088889-36.4088889z"
              :fill="
                !isOpen
                  ? 'var(--color-null)'
                  : delay > 200
                    ? 'var(--color-null)'
                    : 'var(--color-fast)'
              "
            />
            <path
              d="M593.92 329.95555555H430.08c-20.13866667 0-36.40888889 16.27022222-36.40888889 36.4088889v618.9511111c0 20.13866667 16.27022222 36.40888889 36.40888889 36.4088889h163.84c20.13866667 0 36.40888889-16.27022222 36.40888889-36.4088889V366.36444445c0-20.13866667-16.27022222-36.40888889-36.40888889-36.4088889z"
              :fill="
                !isOpen
                  ? 'var(--color-null)'
                  : delay > 500
                    ? 'var(--color-null)'
                    : delay > 200
                      ? 'var(--color-norm)'
                      : 'var(--color-fast)'
              "
            />
            <path
              d="M243.48444445 657.63555555H79.64444445c-20.13866667 0-36.40888889 16.27022222-36.4088889 36.4088889v291.2711111c0 20.13866667 16.27022222 36.40888889 36.4088889 36.4088889h163.84c20.13866667 0 36.40888889-16.27022222 36.40888888-36.4088889V694.04444445c0-20.13866667-16.27022222-36.40888889-36.40888888-36.4088889z"
              :fill="
                !isOpen
                  ? 'var(--color-null)'
                  : delay > 500
                    ? 'var(--color-slow)'
                    : delay > 200
                      ? 'var(--color-norm)'
                      : 'var(--color-fast)'
              "
            />
          </svg>
        </el-icon>
      </div>

      <div
        class="min-w-[44px] h-full leading-8 text-right"
        :class="{
          'animate-pulse': isConnecting,
        }"
      >
        {{ statusText }}
      </div>
    </div>

    <AppWindowTeleporter :info="info">
      <StatusWindow />
    </AppWindowTeleporter>
  </BarItem>
</template>
