import type { HistoryVo, SysUserSmallVo } from '@/api/alova/globals'
import { Chart } from '@antv/g2'
import { useTheme } from '@/hooks'

interface HistoryChartHookOptions {
  data: Ref<(HistoryVo & { diffs: Set<string> })[]>
  users: Ref<Map<string, SysUserSmallVo>>
}

export const useHistoryChart = (
  element: Ref<HTMLElement | undefined>,
  options: HistoryChartHookOptions,
) => {
  const { data, users } = options

  const { isDark } = useTheme()

  const chart = shallowRef<Chart>()

  const destoryer = shallowRef<() => void>()

  watch(element, async container => {
    if (!container) {
      chart.value?.destroy()
      destoryer.value?.()
      chart.value = undefined
      destoryer.value = undefined
      return
    }

    const instance = new Chart({
      container,
      autoFit: true,
      marginLeft: 0,
      paddingLeft: 30,
    })

    instance
      .theme({ type: isDark.value ? 'dark' : 'light' })
      .data(toValue(data))
      .encode('x', (item: (typeof data)['value'][number]) =>
        new Date(item.createTime ?? '').toLocaleString(),
      )
      .encode('y', (item: (typeof data)['value'][number]) => item.diffs.size)
      .axis('x', {
        title: '时间',
        labelSpacing: 15,
        labelFormatter: (date: string) => new Date(date).toLocaleDateString(),
        labelAlign: 'perpendicular',
        labelAutoRotate: false,
      })
      .scale('y', {
        domainMin: 0,
        nice: true,
      })
      .interaction('tooltip', {
        render: (_: Event, { items }: { items: { value: unknown; name: string }[] }) => {
          const [id, diffs, createTime] = items
          const user = users.value.get(`${id.value}`)
          return `
          <div class="w-[120px] text-[var(--el-text-color-regular)]">
            <div>${new Date(Number(createTime.value)).toLocaleString()}</div>
            <div class="w-full text-sm font-bold whitespace-nowrap overflow-hidden text-ellipsis">
              ${user?.nickname ?? user?.username ?? id.value}
            </div>
            <div>修改字段: ${Array.from(diffs.value as Set<string>).join(', ')}</div>
          </div>`
        },
      })

    instance
      .line()
      .encode('shape', 'smooth')
      .tooltip({
        items: ['creatorId', 'diffs', 'createTime'],
      })

    instance.point().style('fill', 'white').tooltip(false)

    await instance.render()

    const stopWatchData = watch(data, async () => {
      await instance.changeData(toValue(data))
      await instance.render()
    })

    const stopWatchTheme = watch(isDark, dark => {
      instance.theme({ type: dark ? 'dark' : 'light' })
      instance.render()
    })

    destoryer.value = () => {
      stopWatchData()
      stopWatchTheme()
    }

    chart.value = instance
  })

  onUnmounted(() => {
    chart.value?.destroy()
    destoryer.value?.()
  })

  return {
    chart,
  }
}
