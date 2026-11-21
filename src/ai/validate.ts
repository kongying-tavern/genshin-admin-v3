import type { FieldSchema, ObjectSchema, ParamType } from './types'

export interface ParamValidationError {
  path: string
  message: string
}

export type ParamsValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: ParamValidationError[] }

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const typeNames = (type: ParamType | ParamType[] | undefined): ParamType[] => {
  if (!type) return ['any']
  return Array.isArray(type) ? type : [type]
}

const matchesType = (value: unknown, type: ParamType): boolean => {
  switch (type) {
    case 'any':
      return true
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
      return isPlainObject(value)
    default:
      return false
  }
}

const validateField = (
  schema: FieldSchema,
  value: unknown,
  path: string,
  errors: ParamValidationError[],
): unknown => {
  const types = typeNames(schema.type)
  if (!types.some(type => matchesType(value, type))) {
    errors.push({ path, message: `应为 ${types.join(' | ')} 类型` })
    return value
  }

  if (value === undefined) return value

  if (schema.enum && !schema.enum.includes(value as string | number)) {
    errors.push({
      path,
      message: `应为 ${schema.enum.map(item => `"${item}"`).join(' / ')} 之一`,
    })
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `长度不能小于 ${schema.minLength}` })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `长度不能大于 ${schema.maxLength}` })
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `不能小于 ${schema.minimum}` })
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `不能大于 ${schema.maximum}` })
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `至少需要 ${schema.minItems} 项` })
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `最多允许 ${schema.maxItems} 项` })
    }
    if (schema.items) {
      return value.map((item, index) =>
        validateField(schema.items!, item, `${path}[${index}]`, errors),
      )
    }
    return value
  }

  if (isPlainObject(value) && schema.properties) {
    return validateObject(schema, value, path, errors)
  }

  return value
}

const validateObject = (
  schema: FieldSchema,
  input: Record<string, unknown>,
  path: string,
  errors: ParamValidationError[],
): Record<string, unknown> => {
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const result: Record<string, unknown> = {}
  const prefix = path ? `${path}.` : ''

  for (const key of Object.keys(input)) {
    if (input[key] === undefined) continue
    if (!(key in properties) && schema.additionalProperties !== true) {
      errors.push({ path: `${prefix}${key}`, message: '未知参数' })
      continue
    }
    const fieldSchema = properties[key]
    const value = input[key]
    result[key] =
      fieldSchema === undefined
        ? value
        : validateField(fieldSchema, value, `${prefix}${key}`, errors)
  }

  for (const key of Object.keys(properties)) {
    if (result[key] !== undefined) continue
    const fieldSchema = properties[key]
    if (fieldSchema.default !== undefined) {
      result[key] = fieldSchema.default
      continue
    }
    if (required.has(key)) {
      errors.push({ path: `${prefix}${key}`, message: '缺少必填参数' })
    }
  }

  return result
}

/** 校验对象参数并填充默认值 */
export const validateParams = (
  schema: ObjectSchema | undefined,
  input: unknown,
): ParamsValidationResult => {
  if (schema === undefined) {
    if (input === undefined || input === null) return { ok: true, value: {} }
    if (!isPlainObject(input)) {
      return { ok: false, errors: [{ path: '', message: '参数应为对象' }] }
    }
    return { ok: true, value: input }
  }

  if (input === undefined) {
    input = {}
  }
  if (!isPlainObject(input)) {
    return { ok: false, errors: [{ path: '', message: '参数应为对象' }] }
  }

  const errors: ParamValidationError[] = []
  const value = validateObject(schema, input, '', errors)
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

/** 构造对象参数 schema 的简写 */
export const objectSchema = (
  properties: Record<string, FieldSchema>,
  required: readonly string[] = [],
  additionalProperties = false,
): ObjectSchema => ({
  type: 'object',
  properties,
  ...(required.length ? { required: [...required] } : {}),
  additionalProperties,
})

/** 将轻量 schema 转为 JSON schema，用于 manifest/help */
export const toJsonSchema = (schema: FieldSchema): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  if (schema.description) result.description = schema.description
  if (schema.default !== undefined) result.default = schema.default
  if (schema.enum) result.enum = [...schema.enum]

  const types = typeNames(schema.type).filter(type => type !== 'any')
  if (types.length === 1) result.type = types[0]
  else if (types.length > 1) result.type = types

  if (schema.minimum !== undefined) result.minimum = schema.minimum
  if (schema.maximum !== undefined) result.maximum = schema.maximum
  if (schema.minLength !== undefined) result.minLength = schema.minLength
  if (schema.maxLength !== undefined) result.maxLength = schema.maxLength
  if (schema.minItems !== undefined) result.minItems = schema.minItems
  if (schema.maxItems !== undefined) result.maxItems = schema.maxItems
  if (schema.required) result.required = [...schema.required]
  if (schema.additionalProperties !== undefined) {
    result.additionalProperties = schema.additionalProperties
  }
  if (schema.items) result.items = toJsonSchema(schema.items)
  if (schema.properties) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toJsonSchema(value)]),
    )
  }

  return result
}
