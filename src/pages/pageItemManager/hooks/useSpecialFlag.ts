import type { ItemVo } from '@/api/alova/globals'
import { specialMask } from '@/shared'

/**
 * 将一个数值转换为二进制标识列表进行处理
 */
export const useSpecialFlag = (form: Ref<ItemVo>) => {
  const specialFlag = computed({
    get: () => {
      const mask = toValue(form).specialFlag ?? 0
      return specialMask.decode(mask)
    },
    set: keys => {
      let mask = 0
      keys.forEach(key => {
        mask = specialMask.active(mask, key)
      })
      form.value.specialFlag = mask
    },
  })

  return { specialFlag }
}
