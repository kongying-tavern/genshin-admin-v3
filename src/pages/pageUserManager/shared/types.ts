import type { SysUserRegisterVo, SysUserUpdateVo } from '@/api/alova/globals'

export type UserDetailVo = SysUserUpdateVo
  & SysUserRegisterVo & {
    confirmPassword?: string
  }
