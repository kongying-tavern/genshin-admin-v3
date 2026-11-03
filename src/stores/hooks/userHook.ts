import { CustomHook } from '.'

export type UserHookType = 'onAuthChange' | 'onInfoChange'

class CustomUserHook extends CustomHook<UserHookType> {
  onAuthChange = this.registerHook('onAuthChange')
  onInfoChange = this.registerHook('onInfoChange')
}

export const userHook = new CustomUserHook()
