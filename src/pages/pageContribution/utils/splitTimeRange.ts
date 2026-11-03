import dayjs from 'dayjs'

export const splitTimeRange = (
  startTime: number,
  endTime: number,
  unit: 'year' | 'month',
): { startTime: number; endTime: number }[] => {
  const start = dayjs(startTime)
  const end = dayjs(endTime)
  const result: { startTime: number; endTime: number }[] = []

  if (!start.isValid() || !end.isValid()) throw new Error('Invalid start or end time')

  if (unit === 'year') {
    let current = start.startOf('year')
    const endOfYear = end.endOf('year')

    while (current.isBefore(endOfYear) || current.isSame(endOfYear)) {
      const next = current.clone().endOf('year')
      result.push({
        startTime: current.valueOf(),
        endTime: next.isAfter(end) ? end.valueOf() : next.valueOf(),
      })
      current = current.add(1, 'year').startOf('year')
    }
  } else if (unit === 'month') {
    let current = start.startOf('month')
    const endOfMonth = end.endOf('month')

    while (current.isBefore(endOfMonth) || current.isSame(endOfMonth)) {
      const next = current.clone().endOf('month')
      result.push({
        startTime: current.valueOf(),
        endTime: next.isAfter(end) ? end.valueOf() : next.valueOf(),
      })
      current = current.add(1, 'month').startOf('month')
    }
  } else {
    throw new Error('Invalid unit. Use "year" or "month".')
  }

  return result
}
