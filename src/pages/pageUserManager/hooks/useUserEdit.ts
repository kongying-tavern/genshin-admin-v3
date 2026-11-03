import type { ElForm } from 'element-plus'
import type { ShallowRef } from 'vue'
import type { SysUserVo } from '@/api/alova/globals'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'

export const useUserEdit = (
  formData: Ref<SysUserVo>,
  form: ShallowRef<InstanceType<typeof ElForm>>,
  options: { loading: Ref<boolean> },
) => {
  const { loading } = options

  const {
    refresh: submit,
    onError,
    onSuccess,
    ...rest
  } = useFetchHook({
    loading,
    onRequest: async () => {
      const isValid = form.value
        ?.validate()
        .then(() => true)
        .catch(() => false)
      if (!isValid) throw new Error('表单校验未通过')

      const {
        id,
        accessPolicy = [],
        logo = '',
        nickname = '',
        phone = '',
        qq = '',
        roleId,
        remark = '',
      } = toValue(formData)

      if (id === undefined) throw new Error('表单信息中用户 id 为空')

      await Apis.user.updateUser({
        data: {
          userId: id,
          accessPolicy,
          logo,
          nickname,
          phone,
          qq,
          roleId,
          remark,
        },
      })
    },
  })

  onSuccess(() => {
    ElMessage.success({
      message: '编辑成功',
    })
  })

  onError(err => {
    ElMessage.error({
      message: `编辑失败，原因为：${err.message}`,
    })
  })

  return {
    submit,
    onSuccess,
    onError,
    ...rest,
  }
}
