import { useFetchHook } from '@/hooks'

export interface MiyousheAvatar {
  id?: number
  name?: string
  sort_order?: number
  icon?: string
}

export interface MiyousheAvatarResponse {
  data?: {
    list?: {
      id?: number
      name?: string
      list?: MiyousheAvatar[]
    }[]
  }
}

const cachedAvatars = shallowRef<MiyousheAvatar[]>([])

const autoResetTimer = ref<number>()

/** 头像列表 */
export const useAvatarList = () => {
  const { refresh, onSuccess, ...rest } = useFetchHook({
    initialValue: [],
    onRequest: async () => {
      // TODO 米游社接口，不保证后续可用性
      const res = await fetch('https://bbs-api-static.miyoushe.com/misc/wapi/avatar_set')
      const { data: { list: groups = [] } = {} } = (await res.json()) as MiyousheAvatarResponse

      // 仅使用原神系列头像
      const source = groups.find(({ name = '' }) => name === '原神')?.list ?? []

      const avatars = source
        .sort(({ sort_order: sa = 0 }, { sort_order: sb = 0 }) => sa - sb)
        .map(avatar => {
          // 匹配所有汉字作为 name
          const name =
            avatar.name
              ?.match(/[\u4E00-\u9FA5]/g)
              ?.join('')
              .replace(/社区|头像/g, '') || '<?>'
          return {
            ...avatar,
            name,
          }
        })

      return avatars
    },
  })

  onMounted(() => {
    !cachedAvatars.value.length && refresh()
  })

  onSuccess(avatars => {
    cachedAvatars.value = avatars
    window.clearTimeout(autoResetTimer.value)
    autoResetTimer.value = window.setTimeout(refresh, 60 * 3600 * 1000)
  })

  return { avatarList: cachedAvatars, refresh, onSuccess, ...rest }
}
