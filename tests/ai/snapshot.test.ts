import { describe, expect, it } from 'vitest'
import { createSnapshotBuilder } from '@/ai/snapshot'
import type { SnapshotSection } from '@/ai/types'

describe('ai/snapshot', () => {
  const sections: SnapshotSection[] = [
    {
      key: 'app',
      title: '应用',
      build: () => ({ version: '1.0.0' }),
    },
    {
      key: 'auth',
      title: '登录',
      build: () => ({ isLogin: false }),
    },
    {
      key: 'ui',
      title: '界面',
      build: context => ({ includeSurfaceStates: context.includeSurfaceStates }),
    },
    {
      key: 'map',
      title: '地图',
      build: () => {
        throw new Error('map failed')
      },
    },
  ]

  it('默认返回全部 section，并隔离单个失败', async () => {
    const builder = createSnapshotBuilder(sections, { now: () => 1000 })
    const result = await builder()

    expect(result.app).toEqual({ version: '1.0.0' })
    expect(result.auth).toEqual({ isLogin: false })
    expect(result.map).toBeUndefined()
    expect(result.meta.failedSections).toEqual([{ section: 'map', error: 'map failed' }])
    expect(result.meta.requestedSections).toEqual(['app', 'auth', 'ui', 'map'])
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('只构建指定 section 并传递上下文', async () => {
    const builder = createSnapshotBuilder(sections, { now: () => 2000 })
    const result = await builder({
      sections: ['ui'],
      includeSurfaceStates: false,
      maxStringLength: 10,
    })
    expect(result.ui).toEqual({ includeSurfaceStates: false })
    expect(result.app).toBeUndefined()
    expect(result.meta.requestedSections).toEqual(['ui'])
  })

  it('对结果做字符串截断', async () => {
    const builder = createSnapshotBuilder([
      {
        key: 'app',
        title: '应用',
        build: () => ({ text: 'abcdefghij' }),
      },
    ])
    const result = await builder({ maxStringLength: 4 })
    expect((result.app as { text: string }).text).toBe('abcd…[truncated]')
  })
})
