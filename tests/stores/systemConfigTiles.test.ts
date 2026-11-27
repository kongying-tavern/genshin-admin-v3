import { assert, describe, expect, it } from 'vitest'
import { resolveSystemConfigTiles } from '@/stores/systemConfigTiles'

describe('地区底图配置解析', () => {
  it('区分点位原点、视口中心和瓦片边界，并保留引用模板原文', () => {
    const areaCode = 'A:SIMULANKA:MAIN'
    const area: DTO.TileConfig = { extend: '希穆兰卡-base', settings: { center: [500, -2211] } }
    const template: DTO.TileConfig = {
      code: 'simulanka',
      name: '希穆兰卡',
      center: [3568, 6286],
      size: [8192, 8192],
      tilesOffset: [-100, 200],
      settings: { zoom: -2 },
    }
    const resolved = resolveSystemConfigTiles(
      { tiles: { [areaCode]: area, '希穆兰卡-base': template } },
      false,
    )
    expect([...resolved.keys()]).toEqual([areaCode])
    const tile = resolved.get(areaCode)
    assert(tile)
    expect(tile.config.tile.center).toEqual([3568, 6286])
    expect(tile.config.initViewState).toEqual({ target: [500, -2211], zoom: -2 })
    expect(tile.mapTarget).toEqual([4068, 4075])
    expect(tile.bounds).toEqual([
      [-100, 200],
      [8092, 8392],
    ])
    expect(tile.sources).toEqual({
      code: ['tiles["希穆兰卡-base"].code'],
      name: ['tiles["希穆兰卡-base"].name'],
      center: ['tiles["希穆兰卡-base"].center'],
      size: ['tiles["希穆兰卡-base"].size'],
      tilesOffset: ['tiles["希穆兰卡-base"].tilesOffset'],
      extension: ['代码默认值'],
      'settings.center': ['tiles["A:SIMULANKA:MAIN"].settings.center'],
      'settings.zoom': ['tiles["希穆兰卡-base"].settings.zoom'],
    })
    expect(tile.fragments).toEqual([
      { path: 'tiles["A:SIMULANKA:MAIN"]', value: area, kind: 'area', beta: false },
      { path: 'tiles["希穆兰卡-base"]', value: template, kind: 'template', beta: false },
    ])
    expect(tile.fragments[0].value).toEqual({
      extend: '希穆兰卡-base',
      settings: { center: [500, -2211] },
    })
  })

  it('权限降级后恢复正式配置，并清除 Beta 地区、来源和原文', () => {
    const areaCode = 'A:MD:MAIN'
    const input: DTO.DadianJSON = {
      tiles: {
        [areaCode]: { extend: '提瓦特-base1', name: '蒙德', settings: { zoom: -1 } },
        '提瓦特-base1': { code: 'formal', center: [10, 20] },
      },
      tilesBeta: {
        [areaCode]: { settings: { center: [30, 40] } },
        'A:MD:BETA': { extend: '提瓦特-base1', name: 'Beta 地区' },
        '提瓦特-base1': { code: 'beta', name: 'Beta 模板', settings: { zoom: -4 } },
      },
    }
    const original = structuredClone(input)
    const initialPublic = resolveSystemConfigTiles(input, false)
    const beta = resolveSystemConfigTiles(input, true)
    const initialBetaTile = beta.get(areaCode)
    assert(initialBetaTile)
    expect(beta.has('A:MD:BETA')).toBe(true)
    expect(initialBetaTile.config.tile).toMatchObject({
      code: 'beta',
      name: '蒙德',
      center: [10, 20],
    })
    expect(initialBetaTile.config.initViewState).toEqual({ target: [30, 40], zoom: -1 })
    expect(initialBetaTile.sources.code).toEqual(['tilesBeta["提瓦特-base1"].code'])
    expect(initialBetaTile.sources.name).toEqual(['tiles["A:MD:MAIN"].name'])
    expect(initialBetaTile.sources['settings.center']).toEqual([
      'tilesBeta["A:MD:MAIN"].settings.center',
    ])
    expect(initialBetaTile.fragments.filter(fragment => fragment.beta)).toHaveLength(2)

    const downgraded = resolveSystemConfigTiles(input, false)
    expect(downgraded).toEqual(initialPublic)
    expect(downgraded.has('A:MD:BETA')).toBe(false)
    const tile = downgraded.get(areaCode)
    assert(tile)
    expect(tile.config.tile.code).toBe('formal')
    expect(tile.mapTarget).toEqual([10, 20])
    expect(tile.sources.code).toEqual(['tiles["提瓦特-base1"].code'])
    expect(tile.fragments.every(fragment => !fragment.beta)).toBe(true)
    expect(input).toEqual(original)
  })

  it('使用内置视口覆盖，并在缺少尺寸或有效视口时使用对应回退', () => {
    const tiles: DTO.DadianJSON['tiles'] = {
      'A:MD:MAIN': { center: [100, 200], size: [0, 512], settings: { center: [10, 20] } },
      'A:LY:MAIN': { center: [300, 400], settings: { center: [10, Number.NaN] } },
    }
    const resolved = resolveSystemConfigTiles({ tiles }, false, { 'A:MD:MAIN': { target: [1, 2] } })
    expect(resolved.get('A:MD:MAIN')).toMatchObject({
      mapTarget: [101, 202],
      bounds: null,
      sources: {
        size: ['tiles["A:MD:MAIN"].size'],
        'settings.center': ['AREA_ADDITIONAL_CONFIG_MAP["A:MD:MAIN"].target'],
      },
    })
    expect(resolved.get('A:LY:MAIN')).toMatchObject({
      mapTarget: [300, 400],
      bounds: null,
      sources: {
        size: ['代码默认值'],
        'settings.center': ['代码默认值'],
        'settings.zoom': ['代码默认值'],
      },
    })
  })

  it('只应用一层继承，地区之间的计算顺序不改变结果', () => {
    const resolved = resolveSystemConfigTiles(
      {
        tiles: {
          'A:MD:REGION': { extend: '远端模板', center: [10, 20] },
          'A:MD:MAIN': { extend: 'A:MD:REGION' },
          远端模板: { code: 'remote' },
        },
      },
      false,
    )
    expect(resolved.get('A:MD:REGION')?.config.tile.code).toBe('remote')
    expect(resolved.get('A:MD:MAIN')).toMatchObject({
      config: { tile: { code: '', center: [10, 20] } },
      fragments: [
        { path: 'tiles["A:MD:MAIN"]', kind: 'area' },
        { path: 'tiles["A:MD:REGION"]', kind: 'template' },
      ],
    })
  })
})
