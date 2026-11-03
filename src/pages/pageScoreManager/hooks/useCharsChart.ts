import type { ShallowRef } from 'vue'
import type { FormatedScore } from '../shared'
import { Chart, Dark, Light } from '@antv/g2'
import { useTheme } from '@/hooks'

export const useCharsChart = (
  container: Ref<HTMLElement | undefined>,
  data: Ref<FormatedScore[]>,
) => {
  const chartRef = shallowRef<Chart>()

  const { isDark } = useTheme()

  // 取前 5
  const getData = () => {
    const raw = toValue(data)
    const res = raw.toSorted(({ totalChars: a = 0 }, { totalChars: b = 0 }) => b - a).slice(0, 5)
    return res
  }

  onMounted(async () => {
    const ele = toValue(container)
    if (!ele) throw new Error('挂载元素为空')

    const chart = new Chart({
      autoFit: true,
      container: ele,
    })

    chart.data(getData())

    chart
      .title('编辑字数前 5 位用户')
      .style({
        maxWidth: 20,
      })
      .interval()
      .style('maxWidth', 20)
      .coordinate({ transform: [{ type: 'transpose' }] })
      .encode('x', 'nickname')
      .encode('y', 'totalChars')
      .axis('x', {
        title: '',
      })
      .axis('y', {
        title: '编辑字数',
      })
      .interaction('elementHighlight', { background: true })
      .theme({ type: toValue(isDark) ? Dark : Light })

    watch(data, () => {
      chart.changeData(getData())
    })

    watch(isDark, () => {
      chart.theme({ type: toValue(isDark) ? Dark : Light })
      chart.render()
    })

    await chart.render()

    chartRef.value = chart
  })

  return {
    chart: chartRef as Readonly<ShallowRef<Chart | undefined>>,
  }
}
