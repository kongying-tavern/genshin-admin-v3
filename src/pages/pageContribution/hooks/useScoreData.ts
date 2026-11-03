import type { SheetableData } from '../types'
import type { ScoreVo } from '@/pages/pageScoreManager/shared'
import dayjs from 'dayjs'
import db from '@/database'
import { useFetchHook } from '@/hooks'
import { useMarkerStore } from '@/stores'
import { promisePool, splitTimeRange } from '../utils'

interface ScoreDataHookOptions {
  note: Ref<string>
  timeRange: Ref<[number, number]>
  abortController: Ref<AbortController | undefined>
}

export const useScoreData = (options: ScoreDataHookOptions) => {
  const { note, timeRange, abortController } = options

  const markerStore = useMarkerStore()

  const hook = useFetchHook({
    immediate: false,
    initialValue: [],
    onRequest: async () => {
      const [rangeStartTime, rangeEndTime] = timeRange.value

      const start = dayjs(rangeStartTime)
      if (!start.isValid()) throw new Error(`开始时间 "${rangeStartTime}" 不是一个合法的时间`)
      const end = dayjs(rangeEndTime)
      if (!end.isValid()) throw new Error(`结束时间 "${rangeEndTime}" 不是一个合法的时间`)

      note.value = ''

      const result = splitTimeRange(rangeStartTime, rangeEndTime, 'month')

      let generatedCount = 0

      const newAbortController = new AbortController()

      abortController.value = newAbortController

      const cachedScoreList = await db.scoreCache.toArray()
      const cachedScoreSet = new Set(cachedScoreList.map(({ id }) => id))

      const missions = result.map(({ startTime, endTime }) => {
        return async () => {
          const rangeId = `${startTime}-${endTime}`
          // 查询区间是否已经生成过，是则跳过生成
          if (cachedScoreSet.has(rangeId)) {
            note.value = `正在生成评分: ${((100 * ++generatedCount) / result.length).toFixed(2)}%`
            return
          }
          const { data: status, message = '' } = await Apis.score.generate({
            data: {
              span: 'DAY',
              scope: 'PUNCTUATE',
              startTime: startTime as unknown as string,
              endTime: endTime as unknown as string,
            },
            signal: newAbortController.signal,
          })
          if (`${status}` !== 'ok') throw new Error(message)
          const splitedEndtime = dayjs(endTime)
          const endOfMonth = splitedEndtime.endOf('month')
          // 只缓存完整的月份生成记录，如果结束时间不是每月最后一天的结束时刻，则跳过此区间的缓存
          if (!splitedEndtime.isSame(endOfMonth)) return
          note.value = `正在生成评分: ${((100 * ++generatedCount) / result.length).toFixed(2)}%`
          return rangeId
        }
      })

      const generatedIds = await promisePool(missions, 6)

      // 缓存已经生成过的区间
      await db.scoreCache.bulkPut((generatedIds.filter(Boolean) as string[]).map(id => ({ id })))

      note.value = '正在汇总评分...'

      // 查询评分
      const { data: list = [] } = await Apis.score.getData({
        data: {
          span: 'DAY',
          scope: 'PUNCTUATE',
          startTime: rangeStartTime as unknown as string,
          endTime: rangeEndTime as unknown as string,
        },
      })

      const userScoreMap = new Map<number, SheetableData>()

      ;(list as ScoreVo[]).forEach(({ data: contribution = {}, userId, user: userInfo = {} }) => {
        const { chars = {}, fields = {} } = contribution
        const { markerTitle: markerTitleChars = 0, content: contentChars = 0 } = chars
        const {
          markerTitle = 0,
          content = 0,
          extra = 0,
          hiddenFlag = 0,
          picture = 0,
          position = 0,
          refreshTime = 0,
        } = fields
        userScoreMap.set(userId!, {
          userId: userId!,
          nickname: userInfo.nickname,
          markerCreation: 0,
          markerTitleChars,
          contentChars,
          markerTitle,
          content,
          extra,
          hiddenFlag,
          picture,
          position,
          refreshTime,
        })
      })

      // 查询点位创建数据
      const markerList = markerStore.markerList

      markerList.forEach(markerInfo => {
        const { createTime, creatorId } = markerInfo
        if (createTime === undefined || creatorId === undefined) return
        const time = dayjs(createTime)
        if (time.isBefore(start) || time.isAfter(end)) return
        const query = userScoreMap.get(creatorId)
        if (!query) {
          userScoreMap.set(creatorId, {
            userId: creatorId,
            markerCreation: 0,
            markerTitleChars: 0,
            contentChars: 0,
            markerTitle: 0,
            content: 0,
            extra: 0,
            hiddenFlag: 0,
            picture: 0,
            position: 0,
            refreshTime: 0,
          })
          return
        }
        ++query.markerCreation
      })

      return [...userScoreMap.values()]
    },
  })

  return {
    ...hook,
  }
}
