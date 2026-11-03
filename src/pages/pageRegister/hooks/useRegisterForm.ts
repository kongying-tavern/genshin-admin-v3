import type { SysUserRegisterVo } from '@/api/alova/globals'
import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import Oauth from '@/api/oauth'
import { useFetchHook } from '@/hooks'
import { useArchiveStore, useUserStore } from '@/stores'
import { passwordCheck, qqCheck } from '@/utils'

/** 注册逻辑封装 */
export const useRegisterForm = () => {
  const formRef = ref<ElFormType | null>(null)

  const registerForm = reactive<Required<SysUserRegisterVo>>({
    username: '',
    password: '',
  })

  watch(
    registerForm,
    () => {
      for (const key in registerForm) {
        const raw = registerForm[key as keyof SysUserRegisterVo] ?? ''
        registerForm[key as keyof SysUserRegisterVo] = raw.replace(/\s+/g, '')
      }
    },
    { deep: true },
  )

  const rules: ItemFormRules<SysUserRegisterVo> = {
    username: [qqCheck()],
    password: [passwordCheck()],
  }

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      await Apis.user.registerUserByQQ({
        data: registerForm,
      })
      return Oauth.oauth.token({
        grant_type: 'password',
        ...registerForm,
      })
    },
  })

  const register = async () => {
    try {
      await formRef.value?.validate()
      await submit()
    } catch {
      // cancel, no error
    }
  }

  const userStore = useUserStore()
  const router = useRouter()
  const archiveStore = useArchiveStore()

  onSuccess(async auth => {
    ElMessage.success({
      message: '注册成功',
    })
    userStore.setAuth(auth)
    await router.push('/map')
    await archiveStore.fetchArchive()
    await archiveStore.loadLatestArchive()
  })

  onError(err =>
    ElMessage.error({
      message: `注册失败，原因为：${err.message}`,
    }),
  )

  return { formRef, rules, registerForm, register, onSuccess, onError, ...rest }
}
