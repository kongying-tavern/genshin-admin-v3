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

describe('Vite 环境变量校验', () => {
  let envDir: string
  const writtenFiles = new Set<string>()

  const writeEnv = (file: string, env: Record<string, string>) => {
    const contents = Object.entries(env).map(([key, value]) => `${key}="${value}"`)
    writeFileSync(join(envDir, file), contents.join('\n'))
    writtenFiles.add(file)
  }

  beforeEach(() => {
    envDir = mkdtempSync(join(tmpdir(), 'map-env-'))
    for (const key of Object.keys(process.env).filter(key => key.startsWith('VITE_'))) {
      vi.stubEnv(key, undefined)
    }
    vi.stubEnv('MAP_TEST_WS_BASE', undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    for (const file of writtenFiles) rmSync(join(envDir, file), { force: true })
    writtenFiles.clear()
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

    vi.stubEnv('MAP_TEST_WS_BASE', requiredEnv.VITE_WS_BASE)
    expect(loadValidatedEnv(build, envDir)).toMatchObject(requiredEnv)

    vi.stubEnv('VITE_WS_BASE', 'ftp://socket.example.test')
    expect(() => loadValidatedEnv(build, envDir)).toThrow('VITE_WS_BASE 应为 HTTP(S) 或 WS(S)')

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

  it.each(['.env', '.env.local', `.env.${build.mode}`, envFile])(
    '拒绝 %s 中未声明的环境变量',
    file => {
      writeEnv(envFile, requiredEnv)
      writeEnv(file, { ...requiredEnv, VITE_API_BAES: 'typo', EXTRA_KEY: 'unknown' })

      expect(() => loadValidatedEnv(build, envDir)).toThrow('VITE_API_BAES 是未知环境变量')
      expect(() => loadValidatedEnv(build, envDir)).toThrow('EXTRA_KEY 是未知环境变量')
    },
  )

  it('拒绝由进程环境注入的未知 VITE_ 键', () => {
    writeEnv(envFile, requiredEnv)
    vi.stubEnv('VITE_UNKNOWN_ENV', 'unknown')

    expect(() => loadValidatedEnv(build, envDir)).toThrow('VITE_UNKNOWN_ENV 是未知环境变量')
  })

  it.each([
    ['VITE_API_BASE', 'api-dev', '应为 HTTP(S) 绝对 URL 或以 / 开头的同源路径'],
    ['VITE_API_BASE', '//api.example.test', '应为 HTTP(S) 绝对 URL 或以 / 开头的同源路径'],
    ['VITE_API_PROXY_TARGET', 'ftp://proxy.example.test', '应为 HTTP(S) 绝对 URL'],
    ['VITE_WS_BASE', 'http://', '应为 HTTP(S) 或 WS(S) 绝对 URL'],
    ['VITE_BANNER_IMAGE', 'https://assets.example.test/bad image.png', '应为 HTTP(S) 绝对 URL'],
    ['VITE_DOCUMENT_URL', 'https:docs.example.test', '应为 HTTP(S) 绝对 URL'],
    ['VITE_ASSETS_BASE', 'https:///assets.example.test', '应为 HTTP(S) 绝对 URL'],
    ['VITE_CONFIG_ARCHIVE', '/system.json.bz2', '应为 HTTP(S) 绝对 URL'],
    ['VITE_ROUTER_MODE', 'malformed', '应为 history、hash、memory 之一'],
    ['VITE_DEVELOPMENT_MODE', 'online', '应为 default、offline 之一'],
    ['VITE_HTTPS', 'false', '应为 0、1 之一'],
    ['VITE_AI_BRIDGE', 'maybe', '应为 off、read、write 或桥接支持的别名'],
    ['VITE_MAP_ENTITY_ARCHIVES', 'marker,area', '应为 marker、item、markerLink'],
  ])('拒绝 %s 中格式错误的值 %s', (key, value, message) => {
    writeEnv(envFile, { ...requiredEnv, [key]: value })

    expect(() => loadValidatedEnv(build, envDir)).toThrow(`${key} ${message}`)
  })

  it('接受既有地址格式、枚举、桥接别名和归档列表', () => {
    const sharedEnv = {
      VITE_DOCUMENT_URL: 'https://docs.example.test/dash',
      VITE_ASSETS_BASE: 'https://assets.example.test',
      VITE_BANNER_IMAGE: 'https://assets.example.test/banner.png',
      VITE_CONFIG_ARCHIVE: 'https://assets.example.test/system.json.bz2',
      VITE_ROUTER_MODE: 'hash',
      VITE_DEVELOPMENT_MODE: 'offline',
      VITE_HTTPS: '0',
      VITE_AI_BRIDGE: ' ReadWrite ',
      VITE_MAP_ENTITY_ARCHIVES: 'marker, markerLink',
    }
    writeEnv('.env.local', sharedEnv)

    for (const protocol of ['http', 'https', 'ws', 'wss']) {
      const env = { ...requiredEnv, VITE_WS_BASE: `${protocol}://socket.example.test/socket.io` }
      writeEnv(envFile, env)
      expect(loadValidatedEnv(serve, envDir)).toMatchObject({ ...sharedEnv, ...env })
    }
  })

  it('测试模式要求集成测试账号和绝对接口地址', () => {
    const testConfig = { ...build, mode: 'test' }
    const file = '.env.test.local'
    writeEnv(file, requiredEnv)

    expect(() => loadValidatedEnv(testConfig, envDir)).toThrow('VITE_TEST_USERNAME 缺失')
    expect(() => loadValidatedEnv(testConfig, envDir)).toThrow('VITE_TEST_PASSWORD 缺失')

    const testEnv = {
      ...requiredEnv,
      VITE_TEST_USERNAME: 'test-user',
      VITE_TEST_PASSWORD: 'test-password',
    }
    writeEnv(file, { ...testEnv, VITE_API_BASE: '/api-dev' })
    expect(() => loadValidatedEnv(testConfig, envDir)).toThrow(
      'VITE_API_BASE 应为 HTTP(S) 绝对 URL',
    )

    writeEnv(file, testEnv)
    expect(loadValidatedEnv(testConfig, envDir)).toMatchObject(testEnv)
  })
})
