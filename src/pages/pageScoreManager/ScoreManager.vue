<script lang="ts" setup>
import type { ScoreFilterParmas } from './hooks'
import dayjs from 'dayjs'
import { ScoreFilter, ScoreTable } from './components'
import { useCharsChart, useCountChart, useScore } from './hooks'

const filterForm = ref<ScoreFilterParmas>({
  range: (() => {
    const now = dayjs()
    const toFormated = (time: dayjs.Dayjs) => time.valueOf()
    return [toFormated(now.add(-180, 'day')), toFormated(now)]
  })(),
})

const { data, loading, refresh } = useScore(filterForm)

const countChartRef = ref<HTMLElement>()
useCountChart(countChartRef, data)

const charsChartRef = ref<HTMLElement>()
useCharsChart(charsChartRef, data)
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <ScoreFilter v-model="filterForm.range" class="flex-shrink-0" @change="refresh" />

    <div class="flex-1 p-2 flex gap-2">
      <div ref="countChartRef" class="flex-1 rounded border border-[var(--el-border-color)]" />
      <div ref="charsChartRef" class="flex-1 rounded border border-[var(--el-border-color)]" />
    </div>

    <ScoreTable class="flex-2 px-2 pb-2" :data="data" :loading="loading" />
  </div>
</template>
