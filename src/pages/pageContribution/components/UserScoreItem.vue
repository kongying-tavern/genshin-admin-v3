<script setup lang="ts">
import type { TransformedScore } from '../types'
import { Chart } from '@antv/g2'
import { UserFilled } from '@element-plus/icons-vue'
import { useTemplateRef } from 'vue'
import { useTheme } from '@/hooks'

const props = defineProps<{
  data: TransformedScore
  index: number
}>()

const containerRef = useTemplateRef('container')

const { isDark } = useTheme()

const chartRef = shallowRef<Chart>()

const init = async () => {
  if (!containerRef.value) return

  const chart = new Chart({
    container: containerRef.value,
    theme: isDark.value ? 'classicDark' : 'classic',
    width: 402,
    height: 362,
  })

  chartRef.value = chart

  chart.coordinate({ type: 'theta', innerRadius: 0.25, outerRadius: 0.8 })

  chart
    .interval()
    .data(props.data.fields)
    .transform({ type: 'stackY' })
    .encode('y', 'value')
    .encode('color', 'key')
    .label({
      text: (data: TransformedScore['fields'][number]) => `${data.label}\n${data.value}`,
      position: 'spider',
      transform: [{ type: 'exceedAdjust' }, { type: 'overlapDodgeY' }],
    })
    .style('radius', 4)
    .style('stroke', '#fff')
    .style('lineWidth', 2)
    .animate({
      enter: { type: 'waveIn' },
    })
    .state('active', { opacity: 1 })
    .state('inactive', { opacity: 0.2 })
    .interaction('elementHighlight', true)
    .interaction('legendHighlight', true)
    .legend(false)
    .tooltip(false)

  await chart.render()
}

watch(isDark, dark => {
  chartRef.value?.theme({ type: dark ? 'classicDark' : 'classic' })
  chartRef.value?.render()
})

watch(
  () => props.data,
  () => {
    chartRef.value?.changeData(props.data.fields)
  },
)

onBeforeUnmount(() => {
  chartRef.value?.destroy()
})

const { stop } = useIntersectionObserver(containerRef, ([entry]) => {
  const isVisible = entry?.isIntersecting ?? false
  if (!isVisible) return

  init()
  stop()
})
</script>

<template>
  <div
    class="w-[420px] h-[420px] m-2 border border-[var(--el-border-color)] rounded p-2 pb-0 flex flex-col gap-2"
  >
    <div class="shrink-0 flex gap-2">
      <el-image
        :src="data.user.logo"
        style="
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border: 1px solid var(--el-border-color);
          border-radius: 20px;
          background-color: var(--el-text-color-disabled);
        "
      >
        <template #placeholder>
          <el-icon color="var(--el-bg-color)" :size="38" class="p-2">
            <UserFilled />
          </el-icon>
        </template>
        <template #error>
          <el-icon color="var(--el-bg-color)" :size="38" class="p-2">
            <UserFilled />
          </el-icon>
        </template>
      </el-image>

      <div class="flex-1">
        <div
          class="w-[320px] text-[var(--el-color-primary)] text-sm whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {{ data.user.nickname }}
          <span class="text-xs text-[var(--el-text-color-secondary)]">{{
            `UID: ${data.user.id}`
          }}</span>
        </div>
        <div class="text-[var(--el-text-color-secondary)] text-xs flex gap-3">
          {{ data.count }} 次提交
        </div>
      </div>

      <div class="shrink-0 text-[var(--el-text-color-secondary)] text-xs"># {{ index }}</div>
    </div>

    <div ref="container" class="flex-1" />
  </div>
</template>
