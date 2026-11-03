import type { FormatedScore, ScoreVo } from '../shared'
import type { ScoreParamsVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export interface ScoreFilterParmas {
  range: [number, number]
}

/** 列表数据与核心操作封装 */
export const useScore = (form: Ref<ScoreFilterParmas>) => {
  // 获取评分数据
  const { onError, ...rest } = useFetchHook({
    initialValue: [],
    immediate: true,
    onRequest: async () => {
      const { range } = toValue(form)
      const [startTime, endTime] = range

      const payload: ScoreParamsVo = {
        startTime: startTime as unknown as string,
        endTime: endTime as unknown as string,
        span: 'DAY',
        scope: 'PUNCTUATE',
      }

      const { data: status, message = '' } = await Apis.score.generate({
        data: payload,
      })
      if (`${status}` !== 'ok') throw new Error(message)

      const { data = [] } = await Apis.score.getData({
        data: payload,
      })

      const formatedData: FormatedScore[] = (data as ScoreVo[]).map(
        ({ data, userId, user, ...rest }) => ({
          ...rest,
          ...user,
          nickname: user?.nickname || user?.username || `(id:${userId})`,
          data,
          userId,
          totalChars: data?.chars
            ? Object.values(data.chars).reduce((sum, count = 0) => sum + count, 0)
            : 0,
          totalCount: data?.fields
            ? Object.values(data.fields).reduce((sum, count = 0) => sum + count, 0)
            : 0,
        }),
      )

      const res = formatedData.toSorted(({ userId: idA = 0 }, { userId: idB = 0 }) => {
        return idA - idB
      })

      return res
    },
  })

  onError(err => {
    ElMessage.error({
      message: `获取评分数据失败，原因为：${err.message}`,
    })
  })

  return {
    onError,
    ...rest,
  }
}
