import type { ShallowRef } from 'vue'
import type { ItemDetailForm } from '../components'
import type { ItemVo } from '@/api/alova/globals'
import { GSMessageService } from '@/components'
import { useFetchHook } from '@/hooks'
import { HiddenFlagEnum, IconStyle } from '@/shared'
import { useItemStore } from '@/stores'

export interface ItemCreateHookOptions {
  /** 用于控制事件监听器只会被附加一次的 flag */
  isRoot?: boolean
}

export const useItemCreate = (formRef: ShallowRef<InstanceType<typeof ItemDetailForm> | null>) => {
  const itemStore = useItemStore()

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (item: ItemVo) => {
      await itemStore.createItem(item)
    },
  })

  const initFormData = (): ItemVo => ({
    defaultCount: 1,
    defaultRefreshTime: 0,
    typeIdList: [],
    hiddenFlag: HiddenFlagEnum.SHOW,
    iconId: undefined,
    iconStyleType: IconStyle.DEFAULT,
    sortIndex: 0,
  })

  const formData = ref<ItemVo>(initFormData())

  const handleSubmit = async () => {
    const isValid = await formRef.value?.validate()
    if (!isValid) return
    await submit(formData.value)
  }

  onSuccess(() => {
    GSMessageService.info('新增成功，数据同步可能需要几分钟时间', {
      type: 'success',
      duration: 5000,
    })
  })

  onError(err =>
    GSMessageService.info(`新增失败：${err.message}`, {
      type: 'error',
      duration: 5000,
    }),
  )

  return { formData, detailFormRef: formRef, initFormData, handleSubmit, onSuccess, ...rest }
}
