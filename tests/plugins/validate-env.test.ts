import { mkdtempSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadValidatedEnv } from '../../plugins/validate-env'

const build = { mode: 'env-check', command: 'build' } as const
const serve = { ...build, command: 'serve' } as const
const envFile = `.env.${build.mode}.local`
const requiredEnv = {
  VITE_API_BASE: 'https://api.example.test',
  VITE_WS_BASE: 'wss://socket.example.test',
  VITE_API_AUTH_USERNAME: 'fixture-user',
  VITE_API_AUTH_PASSWORD: 'fixture-password',
}

describe('Vite 必填环境变量', () => {
  let envDir: string

  const writeEnv = (file: string, env: Record<string, string>) => {
    const contents = Object.entries(env).map(([key, value]) => `${key}="${value}"`)
    writeFileSync(join(envDir, file), contents.join('\n'))
  }

  beforeEach(() => {
    envDir = mkdtempSync(join(tmpdir(), 'map-env-'))
    for (const key of [...Object.keys(requiredEnv), 'VITE_API_PROXY_TARGET', 'MAP_TEST_WS_BASE']) {
      vi.stubEnv(key, undefined)
    }
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    rmSync(join(envDir, envFile), { force: true })
    rmSync(join(envDir, '.env.local'), { force: true })
    rmdirSync(envDir)
  })

  it('即使公共文件配置齐全，也要求当前模式的本地文件', () => {
    writeEnv('.env.local', requiredEnv)

    expect(() => loadValidatedEnv(build, envDir)).toThrow(`缺少 ${envFile}`)
  })

  it('列出本地文件缺失和空白的必填项', () => {
    writeEnv('.env.local', requiredEnv)
    vi.stubEnv('VITE_API_AUTH_PASSWORD', requiredEnv.VITE_API_AUTH_PASSWORD)
    writeEnv(envFile, {
      VITE_API_BASE: requiredEnv.VITE_API_BASE,
      VITE_API_AUTH_USERNAME: requiredEnv.VITE_API_AUTH_USERNAME,
      VITE_API_AUTH_PASSWORD: '  ',
    })

    expect(() => loadValidatedEnv(build, envDir)).toThrow(
      'VITE_WS_BASE 缺失\nVITE_API_AUTH_PASSWORD 不能为空',
    )
  })

  it('校验 Vite 展开引用和应用进程覆盖后的值', () => {
    writeEnv(envFile, { ...requiredEnv, VITE_WS_BASE: '${MAP_TEST_WS_BASE}' })

    expect(() => loadValidatedEnv(build, envDir)).toThrow('VITE_WS_BASE 不能为空')

    writeEnv('.env.local', { MAP_TEST_WS_BASE: requiredEnv.VITE_WS_BASE })
    expect(loadValidatedEnv(build, envDir)).toMatchObject(requiredEnv)

    vi.stubEnv('VITE_API_AUTH_USERNAME', ' ')
    expect(() => loadValidatedEnv(build, envDir)).toThrow('VITE_API_AUTH_USERNAME 不能为空')
  })

  it('仅在开发或预览服务使用同源 API 路径时要求反代理目标', () => {
    writeEnv(envFile, requiredEnv)
    expect(loadValidatedEnv(serve, envDir)).toMatchObject(requiredEnv)

    const relativeEnv = { ...requiredEnv, VITE_API_BASE: '/api' }
    writeEnv(envFile, relativeEnv)
    expect(loadValidatedEnv(build, envDir)).toMatchObject(relativeEnv)
    expect(() => loadValidatedEnv(serve, envDir)).toThrow('VITE_API_PROXY_TARGET 缺失')

    const proxyEnv = { ...relativeEnv, VITE_API_PROXY_TARGET: 'https://api.example.test' }
    writeEnv(envFile, proxyEnv)
    expect(loadValidatedEnv(serve, envDir)).toMatchObject(proxyEnv)
  })
})
