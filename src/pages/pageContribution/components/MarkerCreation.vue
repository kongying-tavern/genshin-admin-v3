<script setup lang="ts">
import type { SysUserVo } from '@/api/alova/globals'
import { Chart } from '@antv/g2'
import { lines } from '@antv/g-pattern'
import { useTemplateRef } from 'vue'
import { useFetchHook, useTheme } from '@/hooks'
import { DATA_START_TIME } from '@/shared/constant'
import { useMarkerStore } from '@/stores'
import { disabledDate, shortcuts } from '../shared'

interface UserCountInfo {
  userId: number
  count: number
}

const CHART_HEIGHT = 380

const markerStore = useMarkerStore()
const { isDark } = useTheme()

const userMap = ref(new Map<number, SysUserVo>())
const note = ref('完成')
const containerRef = useTemplateRef('container')

const timeRange = ref(
  ((): [number, number] => {
    const now = Date.now()
    return [DATA_START_TIME, now]
  })(),
)

const histories = computed(() => {
  const [startTime, endTime] = timeRange.value
  const output = markerStore.markerList.reduce((result, { creatorId = -1, createTime }) => {
    if (!createTime) return result
    const time = new Date(createTime).getTime()
    if (time < startTime || time > endTime) return result
    if (result[creatorId] === undefined) result[creatorId] = { userId: creatorId, count: 0 }
    result[creatorId].count += 1
    return result
  }, [] as UserCountInfo[])

  return output
    .filter(Boolean)
    .sort(({ count: ca }, { count: cb }) => cb - ca)
    .slice(0, 10)
})

const { refresh: updateUsers, onSuccess: onUpdateUsers } = useFetchHook({
  onRequest: async () => {
    note.value = '正在查询用户信息'

    const userIds = histories.value.reduce((ids, { userId }) => {
      ids.push(userId)
      return ids
    }, [] as number[])

    const missions: (() => Promise<SysUserVo>)[] = []

    let sum = 0

    userIds.forEach(userId => {
      if (userMap.value.has(userId)) return
      missions.push(async () => {
        try {
          const { data = { id: userId } } = await Apis.user.getUserInfo({
            pathParams: {
              userId,
            },
          })
          return data
        } catch {
          return { id: userId }
        } finally {
          ++sum
          note.value = `正在查询用户信息 ${sum}/${userIds.length}`
        }
      })
    })

    const userList = await Promise.all(missions.map(mission => mission()))

    note.value = '完成'

    return userList.reduce((map, user) => {
      return map.set(user.id!, user)
    }, new Map<number, SysUserVo>())
  },
})

onMounted(() => {
  if (!containerRef.value) return

  const chart = new Chart({
    container: containerRef.value,
    autoFit: true,
    theme: isDark.value ? 'classicDark' : 'classic',
    paddingRight: 40,
    title: '点位创建统计 (前 10 位)',
    height: CHART_HEIGHT,
  })

  const maskChart = chart
    .interval()
    .theme({
      type: isDark.value ? 'classicDark' : 'classic',
    })
    .data([])
    .encode('x', 'userId')
    .encode('y', 30000)
    .style('fillOpacity', 0.1)
    .style('maxWidth', 32)
    .style('radius', 4)
    .tooltip(false)
    .animate(false)

  chart
    .interval()
    .theme({
      type: isDark.value ? 'classicDark' : 'classic',
    })
    .data([])
    .coordinate({ transform: [{ type: 'transpose' }] })
    .encode('x', 'userId')
    .encode('y', 'count')
    .axis('x', {
      title: false,
      size: 80,
      labelAutoEllipsis: true,
      labelFormatter: (userId: number) => {
        const { nickname = `ID:${userId}` } = userMap.value.get(userId) ?? {}
        return nickname
      },
    })
    .axis('y', {
      title: '创建点位数量',
    })
    .style('maxWidth', 32)
    .style('radius', 4)
    .style('fill', () => {
      return {
        image: lines({
          backgroundColor: '#A1E0D5',
          backgroundOpacity: 1,
          strokeOpacity: 0.6,
          stroke: isDark.value ? '#D1F6ED' : '#6DD0BF',
          lineWidth: 4,
          spacing: 5,
        }),
        repetition: 'repeat',
        transform: 'rotate(-45)',
      }
    })
    .label({
      text: 'count',
      textAlign: 'start',
      dx: 5,
    })
    .tooltip(false)

  chart.render()

  watch(isDark, dark => {
    chart.theme({
      type: dark ? 'classicDark' : 'classic',
    })
    chart.render()
  })

  const resize = useDebounceFn((width: number, height: number) => {
    chart.changeSize(width, height)
  }, 50)

  useResizeObserver(containerRef, entries => {
    if (!entries.length) return
    const [entry] = entries
    const { width } = entry.contentRect
    resize(width, CHART_HEIGHT)
  })

  watch(
    histories,
    async () => {
      const maxCount = histories.value[0]?.count ?? 100
      const e = 10 ** (`${Math.floor(Math.max(0, maxCount))}`.length - 1)
      maskChart.encode('y', Math.ceil(maxCount / e) * e)
      chart.changeData(histories.value)
      await updateUsers()
    },
    { deep: true, immediate: true },
  )

  onUpdateUsers(newUserMap => {
    newUserMap.forEach(user => {
      userMap.value.set(user.id!, user)
    })
    chart.render()
  })
})
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-auto">
    <div class="flex items-center gap-2 p-2">
      <el-text>排名时间段</el-text>

      <el-date-picker
        v-model="timeRange"
        type="datetimerange"
        :disabled-date
        :clearable="false"
        :value-on-clear="false"
        :teleported="false"
        :empty-values="[false]"
        :shortcuts="shortcuts"
        style="max-width: 400px"
      />
    </div>

    <div
      ref="container"
      class="w-[calc(100%_-_16px)] flex-1 border border-[var(--el-border-color)] rounded mx-2 mb-2 overflow-hidden"
    />

    <div
      class="py-1 px-2 text-xs text-[var(--el-text-color-secondary)] bg-[var(--el-color-info-light-9)]"
    >
      {{ note }}
    </div>
  </div>
</template>
