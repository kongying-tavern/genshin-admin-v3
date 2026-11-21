import type { BridgeCommand, FormOutcome } from '@/ai/types'
import { nextTick } from 'vue'
import { fail } from '@/ai/errors'
import { objectSchema } from '@/ai/validate'
import {
  applyFormValues,
  getForm,
  listForms,
  readFormState,
  summarizeForm,
  waitFormOutcome,
} from '@/ai/bindings'
import { useUserStore } from '@/stores/user'

const LOGIN_FORM_ID = 'login'

const waitForLoginReady = async (timeoutMs: number) => {
  const userStore = useUserStore()
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (userStore.isLogin) return true
    if (!userStore.auth.accessToken) return false
    await new Promise<void>(resolve => {
      setTimeout(resolve, 100)
    })
  }
  return userStore.isLogin
}

const requireForm = (id: string) => {
  const form = getForm(id)
  if (!form) {
    fail('E_NOT_FOUND', `表单未打开或不存在：${id}`, {
      hint: '调用 forms.list 查看当前已打开表单',
    })
  }
  return form
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

const emitOutcome = (
  context: Parameters<NonNullable<BridgeCommand['handler']>>[1],
  formId: string,
  outcome: FormOutcome,
) => {
  if (outcome.success === true) {
    context.emit('form:succeeded', { form: formId, at: Date.now() })
  } else if (outcome.success === false) {
    context.emit('form:failed', {
      form: formId,
      message: outcome.error ?? '表单提交失败',
      at: Date.now(),
    })
  }
}

/** forms.* 命令 */
export const createFormCommands = (): BridgeCommand[] => [
  {
    id: 'forms.list',
    title: '已打开表单',
    description: '列出当前已挂载的表单句柄及 busy/dirty 状态',
    access: 'read',
    params: objectSchema({}),
    returns: '{ items }',
    examples: [{ title: '查看当前打开的表单' }],
    handler: () => ({ items: listForms().map(summarizeForm) }),
  },
  {
    id: 'forms.get',
    title: '读取表单状态',
    description: '读取表单字段值、只读字段、敏感字段、busy/dirty 与可执行动作',
    access: 'read',
    params: objectSchema(
      {
        id: { type: 'string', description: '表单 id' },
        maxStringLength: {
          type: 'number',
          default: 20000,
          minimum: 100,
          maximum: 1000000,
          description: '字段字符串截断长度',
        },
      },
      ['id'],
    ),
    returns: 'FormStateView',
    examples: [{ title: '读取点位编辑表单', params: { id: 'markerEditor' } }],
    handler: params =>
      readFormState(requireForm(params.id as string), {
        maxStringLength: params.maxStringLength as number | undefined,
      }),
  },
  {
    id: 'forms.set',
    title: '写入表单字段',
    description: '写入表单字段（忽略只读字段），返回写入后的表单状态',
    access: 'write',
    params: objectSchema(
      {
        id: { type: 'string', description: '表单 id' },
        values: {
          type: 'object',
          additionalProperties: true,
          description: '字段补丁',
        },
      },
      ['id', 'values'],
    ),
    returns: 'FormStateView',
    examples: [
      {
        title: '修改点位标题',
        params: { id: 'markerEditor', values: { markerTitle: '新标题' } },
      },
    ],
    handler: async params => {
      const form = requireForm(params.id as string)
      if (form.isBusy?.()) fail('E_BUSY', `表单 ${form.id} 正在提交，无法修改`)
      await applyFormValues(form, params.values as Record<string, unknown>)
      await nextTick()
      return readFormState(form)
    },
  },
  {
    id: 'forms.validate',
    title: '校验表单',
    description: '调用组件自身的校验逻辑，返回 valid/error',
    access: 'read',
    params: objectSchema({ id: { type: 'string', description: '表单 id' } }, ['id']),
    returns: '{ valid, error? }',
    handler: async params => {
      const form = requireForm(params.id as string)
      if (!form.validate) return { valid: true }
      try {
        await form.validate()
        return { valid: true }
      } catch (error) {
        return { valid: false, error: errorMessage(error) }
      }
    },
  },
  {
    id: 'forms.submit',
    title: '提交表单',
    description: '先校验再调用组件自身提交逻辑；默认等待成功/失败事件并返回结果',
    access: 'write',
    tags: ['sensitive'],
    params: objectSchema(
      {
        id: { type: 'string', description: '表单 id' },
        wait: {
          type: 'boolean',
          default: true,
          description: '是否等待成功/失败事件',
        },
        timeoutMs: {
          type: 'number',
          default: 30000,
          minimum: 100,
          maximum: 300000,
          description: '等待超时',
        },
      },
      ['id'],
    ),
    returns: 'FormOutcome | { accepted, sinceSeq }',
    examples: [{ title: '提交点位编辑表单', params: { id: 'markerEditor' } }],
    handler: async (params, context) => {
      const form = requireForm(params.id as string)
      if (!form.submit) fail('E_UNSUPPORTED', `表单 ${form.id} 不支持提交`)
      if (form.isBusy?.()) fail('E_BUSY', `表单 ${form.id} 正在提交`)

      if (form.validate) {
        try {
          await form.validate()
        } catch (error) {
          return {
            success: false,
            validationError: true,
            error: errorMessage(error),
          } satisfies FormOutcome
        }
      }

      const sinceSeq = context.currentSeq()
      const wait = params.wait !== false
      const outcomePromise = wait
        ? waitFormOutcome(form, { timeoutMs: Number(params.timeoutMs ?? 30000) })
        : Promise.resolve<FormOutcome>({ success: null })

      context.emit('form:submitted', { form: form.id, at: Date.now() })
      try {
        await form.submit()
      } catch (error) {
        const outcome: FormOutcome = { success: false, error: errorMessage(error) }
        emitOutcome(context, form.id, outcome)
        return outcome
      }

      if (!wait) {
        return { accepted: true, success: null, sinceSeq }
      }

      const outcome = await outcomePromise
      emitOutcome(context, form.id, outcome)
      // 登录成功事件先于用户信息加载；等待 isLogin 稳定，避免 AI 立刻查询到 false
      if (form.id === LOGIN_FORM_ID && outcome.success === true) {
        await waitForLoginReady(Math.min(10000, Math.max(1000, Number(params.timeoutMs ?? 30000))))
      }
      return outcome
    },
  },
  {
    id: 'forms.close',
    title: '关闭表单',
    description: '调用组件自身的关闭逻辑（不提交）',
    access: 'read',
    params: objectSchema({ id: { type: 'string', description: '表单 id' } }, ['id']),
    returns: '{ closed }',
    handler: params => {
      const form = requireForm(params.id as string)
      if (!form.close) fail('E_UNSUPPORTED', `表单 ${form.id} 不支持关闭`)
      form.close()
      return { closed: true }
    },
  },
]
