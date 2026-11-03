import dayjs from 'dayjs'

export const urlFormatter = (_: unknown, __: unknown, url = '') => decodeURIComponent(url)

export const timeFormatter = (...{ 2: time = '' }) => {
  if (!time) return ''
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

export const refreshTimeFormatter = (_: unknown, __: unknown, time = 0) => {
  if (!time) return '不刷新'
  if (time < 0) {
    return (
      {
        [-1]: '次日4点',
        [-2]: '手动刷新',
        [-3]: '次日0点',
        [-4]: '+2日0点',
        [-5]: '+3日0点',
      } as Record<number, string>
    )[time]
  }
  const labels: string[] = []
  const days = Math.floor(time / 86_400_000)
  days > 0 && labels.push(`${days} 天`)
  const hours = Math.floor((time % 86_400_000) / 3_600_000)
  hours > 0 && labels.push(`${hours} 小时`)
  const mins = Math.floor((time % 3600) / 60_000)
  mins > 0 && labels.push(`${mins} 分钟`)
  return labels.join(' ')
}

export const plainTimeFormatter = (time = 0) => {
  const labels: string[] = []
  const days = Math.floor(time / 86_400_000)
  days > 0 && labels.push(`${days} 天`)
  const hours = Math.floor((time % 86_400_000) / 3_600_000)
  hours > 0 && labels.push(`${hours} 小时`)
  const mins = Math.floor((time % 3600) / 60_000)
  mins > 0 && labels.push(`${mins} 分钟`)
  return labels.join(' ')
}
