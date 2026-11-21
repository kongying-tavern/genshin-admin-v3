import { afterEach, describe, expect, it } from 'vitest'
import {
  applyFormValues,
  bindMapContext,
  clearBindings,
  getForm,
  getMapContext,
  inspectSurface,
  inspectSurfaces,
  readFormState,
  registerCapability,
  registerForm,
  summarizeForm,
  waitFormOutcome,
} from '@/ai/bindings'
import type { FormDefinition } from '@/ai/types'

afterEach(() => {
  clearBindings()
})

describe('ai/bindings', () => {
  it('注册/读取/注销页面句柄', () => {
    let open = true
    const unbind = registerCapability({
      id: 'demo',
      kind: 'dialog',
      title: '演示',
      getState: () => ({ open }),
    })

    expect(inspectSurface('demo')).toMatchObject({
      id: 'demo',
      kind: 'dialog',
      title: '演示',
      available: true,
      open: true,
    })

    open = false
    expect(inspectSurface('demo')?.open).toBe(false)
    expect(inspectSurfaces()).toHaveLength(1)

    unbind()
    expect(inspectSurface('demo')).toBeUndefined()
  })

  it('enabled=false 时 available=false', () => {
    registerCapability({
      id: 'restricted',
      kind: 'window',
      title: '受限窗口',
      enabled: () => false,
      getState: () => ({ open: false }),
    })
    expect(inspectSurface('restricted')?.available).toBe(false)
  })

  it('已挂载表单会被识别为打开句柄', () => {
    const form: FormDefinition = {
      id: 'demoForm',
      title: '演示表单',
      getValues: () => ({ a: 1 }),
      setValues: () => {},
      submit: () => {},
      close: () => {},
      isBusy: () => true,
      isDirty: () => true,
    }
    registerForm(form)

    expect(getForm('demoForm')).toBe(form)
    expect(summarizeForm(form)).toMatchObject({ id: 'demoForm', busy: true, dirty: true })
    expect(inspectSurface('demoForm')).toMatchObject({
      kind: 'form',
      available: true,
      open: true,
      form: { busy: true, dirty: true },
    })
  })

  it('读取表单状态会脱敏并过滤只读字段写入', async () => {
    const form: FormDefinition = {
      id: 'login',
      title: '登录',
      sensitiveFields: ['password'],
      readonlyFields: ['id'],
      getValues: () => ({ id: 1, username: 'alice', password: 'secret' }),
      setValues: patch => {
        expect(patch).toEqual({ username: 'bob' })
      },
    }
    registerForm(form)

    const state = readFormState(form)
    expect(state.values).toEqual({ id: 1, username: 'alice', password: '***' })
    expect(state.canSet).toBe(true)

    await expect(applyFormValues(form, { id: 2, username: 'bob' })).resolves.toEqual(['username'])
  })

  it('waitFormOutcome 解析成功/失败/超时', async () => {
    let successCallback: (() => void) | undefined
    let errorCallback: ((error: Error) => void) | undefined
    const form: FormDefinition = {
      id: 'f',
      title: 'f',
      getValues: () => ({}),
      events: {
        onSuccess: callback => {
          successCallback = callback
          return { off: () => {} }
        },
        onError: callback => {
          errorCallback = callback
          return { off: () => {} }
        },
      },
    }

    const successPromise = waitFormOutcome(form, { timeoutMs: 1000 })
    successCallback?.()
    await expect(successPromise).resolves.toEqual({ success: true })

    const errorPromise = waitFormOutcome(form, { timeoutMs: 1000 })
    errorCallback?.(new Error('boom'))
    await expect(errorPromise).resolves.toEqual({ success: false, error: 'boom' })

    const timeoutPromise = waitFormOutcome(form, { timeoutMs: 10 })
    await expect(timeoutPromise).resolves.toEqual({ success: null, timedOut: true })
  })

  it('绑定地图上下文', () => {
    const unbind = bindMapContext({
      getViewState: () => ({ zoom: 1 }),
      getContainerSize: () => ({ width: 100, height: 200 }),
    })
    expect(getMapContext()?.getViewState?.()).toEqual({ zoom: 1 })
    unbind()
    expect(getMapContext()).toBeUndefined()
  })
})
