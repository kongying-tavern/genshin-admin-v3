import type {
  FormDefinition,
  FormFieldMeta,
  FormOutcome,
  MapContextBinding,
  SurfaceDefinition,
  SurfaceInfo,
  SurfaceKind,
} from './types'
import { sanitize } from './sanitize'

const capabilities = new Map<string, SurfaceDefinition>()
const forms = new Map<string, FormDefinition>()
let mapContext: MapContextBinding | undefined

/** 注册页面句柄，返回注销函数 */
export const registerCapability = (definition: SurfaceDefinition): (() => void) => {
  capabilities.set(definition.id, definition)
  return () => {
    if (capabilities.get(definition.id) === definition) capabilities.delete(definition.id)
  }
}

/** 注册表单句柄，返回注销函数 */
export const registerForm = (definition: FormDefinition): (() => void) => {
  forms.set(definition.id, definition)
  return () => {
    if (forms.get(definition.id) === definition) forms.delete(definition.id)
  }
}

/** 绑定地图上下文（视口/容器尺寸） */
export const bindMapContext = (binding: MapContextBinding): (() => void) => {
  mapContext = binding
  return () => {
    if (mapContext === binding) mapContext = undefined
  }
}

export const getMapContext = (): MapContextBinding | undefined => mapContext

export const getCapability = (id: string): SurfaceDefinition | undefined => capabilities.get(id)

export const getForm = (id: string): FormDefinition | undefined => forms.get(id)

export const listCapabilities = (): SurfaceDefinition[] => [...capabilities.values()]

export const listForms = (): FormDefinition[] => [...forms.values()]

/** 测试/卸载时清空所有绑定 */
export const clearBindings = () => {
  capabilities.clear()
  forms.clear()
  mapContext = undefined
}

const safeEnabled = (definition: SurfaceDefinition): boolean => {
  if (!definition.enabled) return true
  try {
    return definition.enabled()
  } catch {
    return false
  }
}

const isObjectState = (state: unknown): state is Record<string, unknown> =>
  typeof state === 'object' && state !== null && !Array.isArray(state)

/** 表单摘要（不包含字段值） */
export const summarizeForm = (form: FormDefinition) => ({
  id: form.id,
  title: form.title,
  description: form.description,
  busy: form.isBusy?.() ?? false,
  dirty: form.isDirty?.() ?? false,
})

/** 读取单个句柄信息 */
export const inspectSurface = (
  id: string,
  options: { includeState?: boolean } = {},
): SurfaceInfo | undefined => {
  const capability = capabilities.get(id)
  const form = forms.get(id)
  if (!capability && !form) return undefined

  const includeState = options.includeState ?? true
  let state: unknown
  let stateError: string | undefined
  if (includeState && capability?.getState) {
    try {
      state = capability.getState()
    } catch (error) {
      stateError = error instanceof Error ? error.message : String(error)
    }
  }

  let open: boolean | undefined
  if (isObjectState(state) && typeof state.open === 'boolean') {
    open = state.open
  } else if (!capability && form) {
    open = true
  }

  return {
    id,
    kind: capability?.kind ?? 'form',
    title: capability?.title ?? form?.title ?? id,
    description: capability?.description ?? form?.description,
    available: capability ? safeEnabled(capability) : true,
    ...(open === undefined ? {} : { open }),
    ...(state === undefined ? {} : { state }),
    ...(stateError === undefined ? {} : { stateError }),
    ...(form
      ? {
          form: {
            busy: form.isBusy?.() ?? false,
            dirty: form.isDirty?.() ?? false,
          },
        }
      : {}),
  }
}

/** 列出句柄信息 */
export const inspectSurfaces = (
  options: { kind?: SurfaceKind; includeState?: boolean } = {},
): SurfaceInfo[] => {
  const ids = new Set([...capabilities.keys(), ...forms.keys()])
  const result: SurfaceInfo[] = []
  for (const id of [...ids].sort()) {
    const info = inspectSurface(id, options)
    if (!info) continue
    if (options.kind && info.kind !== options.kind) continue
    result.push(info)
  }
  return result
}

/** 表单状态视图 */
export interface FormStateView {
  id: string
  title: string
  description?: string
  fields?: FormFieldMeta[]
  values: Record<string, unknown>
  readonlyFields: string[]
  sensitiveFields: string[]
  busy: boolean
  dirty: boolean
  canSet: boolean
  canSubmit: boolean
  canClose: boolean
}

/** 读取表单完整状态（字段值会脱敏/截断） */
export const readFormState = (
  form: FormDefinition,
  options: { maxStringLength?: number } = {},
): FormStateView => {
  const rawValues = form.getValues()
  const values = sanitize<Record<string, unknown>>(rawValues, {
    redactKeys: form.sensitiveFields,
    maxStringLength: options.maxStringLength ?? 20000,
  })
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    ...(form.fields ? { fields: form.fields } : {}),
    values,
    readonlyFields: [...(form.readonlyFields ?? [])],
    sensitiveFields: [...(form.sensitiveFields ?? [])],
    busy: form.isBusy?.() ?? false,
    dirty: form.isDirty?.() ?? false,
    canSet: Boolean(form.setValues),
    canSubmit: Boolean(form.submit),
    canClose: Boolean(form.close),
  }
}

/** 写入表单字段，忽略只读字段；返回实际写入的键 */
export const applyFormValues = async (
  form: FormDefinition,
  patch: Record<string, unknown>,
): Promise<string[]> => {
  const readonly = new Set(form.readonlyFields ?? [])
  const writable = Object.fromEntries(Object.entries(patch).filter(([key]) => !readonly.has(key)))
  if (!form.setValues || Object.keys(writable).length === 0) return []
  await form.setValues(writable)
  return Object.keys(writable)
}

/** 等待表单成功/失败事件 */
export const waitFormOutcome = (
  form: FormDefinition,
  options: { timeoutMs?: number } = {},
): Promise<FormOutcome> => {
  const timeoutMs = Math.max(0, options.timeoutMs ?? 30000)
  const offs: (() => void)[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false

  return new Promise<FormOutcome>(resolve => {
    const finish = (outcome: FormOutcome) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      offs.forEach(off => off())
      resolve(outcome)
    }

    const attach = (result: unknown) => {
      if (result && typeof result === 'object' && 'off' in result) {
        const off = (result as { off?: unknown }).off
        if (typeof off === 'function') offs.push(off as () => void)
      }
    }

    try {
      if (form.events?.onSuccess) {
        attach(form.events.onSuccess(() => finish({ success: true })))
      }
      if (form.events?.onError) {
        attach(
          form.events.onError(error =>
            finish({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          ),
        )
      }
    } catch (error) {
      finish({
        success: null,
        error: error instanceof Error ? error.message : String(error),
      })
      return
    }

    if (offs.length === 0) {
      finish({ success: null })
      return
    }

    timer = setTimeout(() => finish({ success: null, timedOut: true }), timeoutMs)
  })
}
