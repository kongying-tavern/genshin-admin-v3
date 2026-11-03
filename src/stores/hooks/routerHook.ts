import { CustomHook } from '.'

export type RouterHookType = 'onBeforeRouterEnter' | 'onAfterRouterEnter'

export class CustomRouterHook extends CustomHook<RouterHookType> {
  onBeforeRouterEnter = this.registerHook('onBeforeRouterEnter')
  onAfterRouterEnter = this.registerHook('onAfterRouterEnter')
}

export const routerHook = new CustomRouterHook()
