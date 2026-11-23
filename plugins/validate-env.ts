import type { ValidateFunction } from 'ajv'
import type { ConfigEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { Ajv } from 'ajv'
import { loadEnv } from 'vite'

const requiredKeys = [
  'VITE_API_BASE',
  'VITE_WS_BASE',
  'VITE_API_AUTH_USERNAME',
  'VITE_API_AUTH_PASSWORD',
]

const ajv = new Ajv({ allErrors: true })
const compileEnvValidator = (required: string[]) =>
  ajv.compile({
    type: 'object',
    required,
    properties: Object.fromEntries(required.map(key => [key, { type: 'string', pattern: '\\S' }])),
  })

const validateRequiredEnv = compileEnvValidator(requiredKeys)
const validateProxyEnv = compileEnvValidator([...requiredKeys, 'VITE_API_PROXY_TARGET'])

const assertEnv = (validate: ValidateFunction, env: object, message: string) => {
  if (validate(env)) return

  const issues = (validate.errors ?? []).map(({ keyword, params, instancePath }) =>
    keyword === 'required' ? `${params.missingProperty} 缺失` : `${instancePath.slice(1)} 不能为空`,
  )
  throw new Error(`[环境变量] ${message}\n${issues.join('\n')}`)
}

export const loadValidatedEnv = ({ command, mode }: ConfigEnv, envDir: string) => {
  const env = loadEnv(mode, envDir)
  const envFile = `.env.${mode}.local`
  let contents: string
  try {
    contents = readFileSync(join(envDir, envFile), 'utf8')
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? '缺少' : '无法读取'
    throw new Error(`[环境变量] ${reason} ${envFile}。请参考 .env.example 配置对应环境。`)
  }

  const usesProxy = command === 'serve' && /^\/(?!\/)/.test(env.VITE_API_BASE ?? '')
  const validate = usesProxy ? validateProxyEnv : validateRequiredEnv

  assertEnv(validate, parseEnv(contents), `请参考 .env.example 补全 ${envFile} 中的必填项。`)
  assertEnv(validate, env, `加载 ${envFile} 后必填项仍为空。请检查变量引用和进程环境。`)
  return env
}
