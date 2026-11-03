import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useUserStore } from '@/stores'
import { useValidateStatus } from './useValidateStatus'

/** 登录逻辑封装 */
export const useLoginForm = () => {
  const userStore = useUserStore()

  const formRef = ref<ElFormType | null>(null)

  const loginForm = ref<OauthAPI.SysTokenVO>({
    grant_type: 'password',
    username: import.meta.env.VITE_AUTO_COMPLETE_USERNAME ?? '',
    password: import.meta.env.VITE_AUTO_COMPLETE_PASSWORD ?? '',
  })

  const { isValid, handleValidate } = useValidateStatus({
    keys: [],
  })

  const rules: ItemFormRules<OauthAPI.SysTokenVO> = {
    username: {
      required: true,
      validator: (_, v: string, callback) => {
        if (!v.length) return callback('不能为空')
        if (v.match(/\s/)) return callback('不能包含空白字符')
        callback()
      },
    },
    password: {
      required: true,
      validator: (_, v: string, callback) => {
        if (!v.length) return callback('不能为空')
        if (v.match(/\s/)) return callback('不能包含空白字符')
        callback()
      },
    },
  }

  const {
    refresh: submit,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: () => userStore.login(loginForm.value),
  })

  const login = async () => {
    try {
      await formRef.value?.validate()
      await submit()
    } catch {
      // cancel, no error
    }
  }

  onSuccess(auth => {
    ElMessage({
      type: auth?.message ? 'warning' : 'success',
      message: auth?.message || '登录成功',
      duration: 5000,
    })
  })

  onError(err => {
    // 报错信息优化
    switch (err.message) {
      // 账号或密码错误
      case 'Bad credentials':
        err.message = '账号或密码错误'
        break
      // 其他错误
      default:
        break
    }
    ElMessage.error({
      message: err.message,
    })
  })

  return {
    formRef,
    rules,
    loginForm,
    isValid,
    handleValidate,
    login,
    onSuccess,
    onError,
    ...rest,
  }
}
