import type { ItemDetailForm } from '../components'
import type { ItemVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { pick } from 'lodash'
import { useFetchHook } from '@/hooks'
import { useItemStore } from '@/stores'

export interface ItemEditHookOptions {
  initFormData?: () => ItemVo
}

/** 只选择需要的字段 */
const pickRequiredKeys = (item: ItemVo): ItemVo =>
  pick(item, [
    'id',
    'name',
    'areaId',
    'defaultContent',
    'iconId',
    'typeIdList',
    'iconStyleType',
    'hiddenFlag',
    'defaultRefreshTime',
    'defaultCount',
    'sortIndex',
    'specialFlag',
    'version',
  ])

export const useItemEdit = (
  detailFormRef: Ref<InstanceType<typeof ItemDetailForm> | null>,
  options: ItemEditHookOptions = {},
) => {
  const { initFormData } = options

  const itemStore = useItemStore()

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async (item: ItemVo) => {
      await itemStore.updateItem(pickRequiredKeys(item))
    },
  })

  const formData = ref<ItemVo>(initFormData?.() ?? {})

  const handleSubmit = async () => {
    const isValid = await detailFormRef.value?.validate()
    if (!isValid) return
    await submit(formData.value)
  }

  onSuccess(() => {
    ElMessage.success('编辑成功')
  })

  onError(err => {
    ElMessage.error(`编辑失败，原因为：${err.message}`)
  })

  return { detailFormRef, formData, handleSubmit, onSuccess, onError, ...rest }
}
