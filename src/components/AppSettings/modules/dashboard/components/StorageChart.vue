<script setup lang="ts">
import type { UsageItem } from '../types'
import { Chart } from '@antv/g2'
import { useTemplateRef } from 'vue'
import { useTheme } from '@/hooks'

const props = defineProps<{
  data: UsageItem[]
}>()

const { isDark } = useTheme()

const chartContainerRef = useTemplateRef('chart')
const chartRef = shallowRef<Chart>()

onMounted(() => {
  if (!chartContainerRef.value) return
  const chart = new Chart({
    container: chartContainerRef.value,
    autoFit: true,
    width: 300,
    height: 240,
  })
  chart.coordinate({ type: 'theta', outerRadius: 0.8 })
  chart
    .interval()
    .data(props.data)
    .transform({ type: 'stackY' })
    .encode('y', 'percentage')
    .encode('color', 'name')
    .label({
      text: (data: UsageItem) => {
        return `${data.name}: ${data.percentage.toFixed(2)}%\n${data.text}`
      },
      position: 'spider',
      transform: [{ type: 'exceedAdjust' }, { type: 'overlapDodgeY' }],
    })
    .interaction({
      elementHighlight: true,
    })
    .legend(false)
    .tooltip(false)
    .theme({ type: isDark.value ? 'classicDark' : 'classic' })
  watch(
    () => props.data,
    newData => {
      chart.changeData(newData)
      chart.render()
    },
  )
  watch(isDark, dark => {
    chart.theme({ type: dark ? 'classicDark' : 'classic' })
    chart.render()
  })
  chart.render()
  chartRef.value = chart
})

onUnmounted(() => {
  chartRef.value?.destroy()
})
</script>

<template>
  <div ref="chart" class="w-[300px]" />
</template>
