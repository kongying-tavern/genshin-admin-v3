import type { ElFormType } from '@/shared'
import type { ItemFormRules } from '@/utils'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { useUserStore } from '@/stores'
import { useValidateStatus } from './useValidateStatus'

interface RegisterForm {
  code?: string
  username?: string
  nickname?: string
  password?: string
  repeatPassword?: string
}

/** 注册逻辑封装 */
export const useRegisterForm = (init: RegisterForm = {}) => {
  const userStore = useUserStore()

  const formRef = ref<ElFormType | null>(null)

  const { isValid, handleValidate } = useValidateStatus({
    keys: ['username', 'password', 'repeatPassword'],
  })

  const form = ref({
    code: '',
    username: '',
    nickname: '',
    password: '',
    repeatPassword: '',
    ...init,
  })

  const rules: ItemFormRules<typeof form.value> = {
    code: {
      required: true,
      validator: (_, v: string, callback) => {
        if (!v.trim().length) return callback('邀请码不能为空')
        callback()
      },
    },
    username: {
      required: true,
      validator: (_, v: string, callback) => {
        if (v.length < 6) return callback('不能少于 6 个字符')
        if (v.match(/\s/)) return callback('不能包含空白字符')
        callback()
      },
    },
    password: {
      required: true,
      validator: (_, v: string, callback) => {
        if (v.length < 6) return callback('不能少于 6 个字符')
        if (v.match(/\s/)) return callback('不能包含空白字符')
        callback()
      },
    },
    repeatPassword: {
      required: true,
      validator: (_, v: string, callback) => {
        if (v.length < 6) return callback('不能少于 6 个字符')
        if (v.match(/\s/)) return callback('不能包含空白字符')
        if (v !== form.value.password) return callback('两次密码不一致')
        callback()
      },
    },
  }

  const {
    refresh: register,
    onSuccess,
    onError,
    ...rest
  } = useFetchHook({
    onRequest: async () => {
      const isFormValid = await formRef.value
        ?.validate()
        .then(() => true)
        .catch(() => false)
      if (!isFormValid) throw new Error('表单校验未通过')
      const { code, username, nickname, password } = form.value
      const { data, message } = await Apis.invitation.consumeInvitation({
        data: {
          code,
          nickname,
          username,
          password,
        },
      })
      if (!data) throw new Error(message ?? '无效的注册码')
      // 注册后自动登录
      const auth = await userStore.login({
        grant_type: 'password',
        username,
        password,
      })
      return auth
    },
  })

  onSuccess(() => {
    ElMessage({
      type: 'success',
      message: '注册成功',
    })
  })

  onError(err => {
    ElMessage({
      type: 'error',
      message: `注册失败，原因为：${err.message}`,
    })
  })

  return {
    formRef,
    isValid,
    rules,
    form,
    register,
    onSuccess,
    onError,
    handleValidate,
    ...rest,
  }
}
