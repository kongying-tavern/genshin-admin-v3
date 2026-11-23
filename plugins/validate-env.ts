import type { ValidateFunction } from 'ajv'
import type { ConfigEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { Ajv } from 'ajv'
import { loadEnv } from 'vite'
import { normalizeBridgeMode } from '../src/ai/normalizeMode.ts'

const requiredKeys = [
  'VITE_API_BASE',
  'VITE_WS_BASE',
  'VITE_API_AUTH_USERNAME',
  'VITE_API_AUTH_PASSWORD',
]

const isRootRelativePath = (value: string) =>
  value.startsWith('/') && !value.startsWith('//') && !/[\s\\?#]/.test(value)

const isAbsoluteUrl = (value: string, protocol: RegExp) =>
  protocol.test(value) && !/[\s\\]/.test(value) && URL.canParse(value)

const isHttpUrl = (value: string) => isAbsoluteUrl(value, /^https?:\/\/[^/]/i)
const archiveResources = ['marker', 'item', 'markerLink']

const formats = {
  'http-url': {
    validate: isHttpUrl,
    message: '应为 HTTP(S) 绝对 URL',
  },
  'api-base': {
    validate: (value: string) => isHttpUrl(value) || isRootRelativePath(value),
    message: '应为 HTTP(S) 绝对 URL 或以 / 开头的同源路径',
  },
  'proxy-target': {
    validate: (value: string) => value === '' || isHttpUrl(value),
    message: '应为 HTTP(S) 绝对 URL 或空字符串',
  },
  'socket-url': {
    validate: (value: string) => isAbsoluteUrl(value, /^(?:https?|wss?):\/\/[^/]/i),
    message: '应为 HTTP(S) 或 WS(S) 绝对 URL',
  },
  'ai-bridge-mode': {
    validate: (value: string) => !value.trim() || normalizeBridgeMode(value) !== undefined,
    message: '应为 off、read、write 或桥接支持的别名',
  },
  'entity-archives': {
    validate: (value: string) =>
      !value.trim()
      || value.split(',').every(resource => archiveResources.includes(resource.trim())),
    message: '应为 marker、item、markerLink 中的逗号分隔列表或空字符串',
  },
}

const text = { type: 'string' }
const nonBlank = { ...text, pattern: '\\S' }
const httpUrl = { ...text, format: 'http-url' }
const properties = {
  VITE_TITLE: nonBlank,
  VITE_ROUTER_MODE: { ...text, enum: ['history', 'hash', 'memory'] },
  VITE_AUTO_COMPLETE_USERNAME: text,
  VITE_AUTO_COMPLETE_PASSWORD: text,
  VITE_AI_BRIDGE: { ...text, format: 'ai-bridge-mode' },
  VITE_BANNER_IMAGE: httpUrl,
  VITE_DOCUMENT_URL: httpUrl,
  VITE_API_BASE: { ...text, format: 'api-base' },
  VITE_API_PROXY_TARGET: { ...text, format: 'proxy-target' },
  VITE_DEVELOPMENT_MODE: { ...text, enum: ['default', 'offline'] },
  VITE_WS_BASE: { ...text, format: 'socket-url' },
  VITE_ASSETS_BASE: httpUrl,
  VITE_CONFIG_ARCHIVE: httpUrl,
  VITE_API_AUTH_USERNAME: text,
  VITE_API_AUTH_PASSWORD: text,
  VITE_TEST_USERNAME: text,
  VITE_TEST_PASSWORD: text,
  VITE_HTTPS: { ...text, enum: ['0', '1'] },
  VITE_MAP_ENTITY_ARCHIVES: { ...text, format: 'entity-archives' },
}

const ajv = new Ajv({ allErrors: true })
for (const [name, { validate }] of Object.entries(formats)) {
  ajv.addFormat(name, validate)
}

const knownKeys = Object.fromEntries(Object.keys(properties).map(key => [key, text]))
const compileKeyValidator = (required: string[] = []) =>
  ajv.compile({
    type: 'object',
    additionalProperties: false,
    required,
    properties: {
      ...knownKeys,
      ...Object.fromEntries(required.map(key => [key, nonBlank])),
    },
  })

const validateKnownKeys = compileKeyValidator()
const validateRequiredEnv = compileKeyValidator(requiredKeys)
const validateProxyEnv = compileKeyValidator([...requiredKeys, 'VITE_API_PROXY_TARGET'])
const validateTestEnv = compileKeyValidator([
  ...requiredKeys,
  'VITE_TEST_USERNAME',
  'VITE_TEST_PASSWORD',
])

const validateValues = ajv.compile({ type: 'object', properties })
const validateTestValues = ajv.compile({
  type: 'object',
  properties: { ...properties, VITE_API_BASE: httpUrl },
})

const assertEnv = (validate: ValidateFunction, env: object, message: string) => {
  if (validate(env)) return

  const issues = (validate.errors ?? []).map(({ keyword, params, instancePath }) => {
    const key = instancePath.slice(1)
    switch (keyword) {
      case 'required':
        return `${params.missingProperty} 缺失`
      case 'additionalProperties':
        return `${params.additionalProperty} 是未知环境变量`
      case 'pattern':
        return `${key} 不能为空`
      case 'format':
        return `${key} ${formats[params.format as keyof typeof formats].message}`
      case 'enum':
        return `${key} 应为 ${(params.allowedValues as string[]).join('、')} 之一`
      default:
        return `${key} 应为字符串`
    }
  })
  throw new Error(`[环境变量] ${message}\n${issues.join('\n')}`)
}

const readEnvFile = (envDir: string, file: string) => {
  try {
    return parseEnv(readFileSync(join(envDir, file), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`[环境变量] 无法读取 ${file}。`)
    }
  }
}

export const loadValidatedEnv = ({ command, mode }: ConfigEnv, envDir: string) => {
  const env = loadEnv(mode, envDir)
  const envFile = `.env.${mode}.local`
  const localEnv = readEnvFile(envDir, envFile)
  if (!localEnv) {
    throw new Error(`[环境变量] 缺少 ${envFile}。请参考 .env.example 配置对应环境。`)
  }

  for (const file of ['.env', '.env.local', `.env.${mode}`]) {
    const values = readEnvFile(envDir, file)
    if (values) {
      assertEnv(validateKnownKeys, values, `请参考 .env.example 修正 ${file}。`)
    }
  }

  const isTest = mode === 'test'
  const usesProxy = command === 'serve' && isRootRelativePath(env.VITE_API_BASE ?? '')
  const validateKeys = isTest ? validateTestEnv : usesProxy ? validateProxyEnv : validateRequiredEnv

  assertEnv(validateKeys, localEnv, `请参考 .env.example 修正 ${envFile}。`)

  const message = `${envFile} 加载后的环境变量有误。请检查配置、变量引用和进程环境。`
  assertEnv(validateKeys, env, message)
  assertEnv(isTest ? validateTestValues : validateValues, env, message)
  return env
}
