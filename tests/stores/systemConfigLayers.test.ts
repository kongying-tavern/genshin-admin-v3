import type { AreaTileConfig } from '@/stores/tile'
import { describe, expect, it } from 'vitest'
import { resolveMarkerExtras, resolveOverlayConfig } from '@/stores/systemConfigLayers'

const makeTile = (center: DTO.Coordinate2D): AreaTileConfig => ({
  tile: {
    center,
    code: 'shared',
    name: '共用底图',
    extension: 'png',
    size: [8000, 8000],
    tilesOffset: [0, 0],
  },
  initViewState: { target: [0, 0], zoom: 0 },
})

describe('系统配置叠层解析', () => {
  it('按分片、叠层项、分组的优先级读取边界，用地区的点位原点换算', () => {
    const config: DTO.DadianJSON = {
      plugins: {
        'GS:ISLAND': {
          overlay: true,
          overlayConfig: {
            overlays: [
              {
                label: '金苹果群岛',
                role: 'tile',
                bounds: [
                  [-3, -2],
                  [30, 40],
                ],
                children: [{ label: '第一阶段' }, { label: '第二阶段' }],
              },
            ],
          },
        },
        'GS:SUMMER': {
          overlay: true,
          overlayConfig: {
            multiple: true,
            urlTemplate: '/{{groupValue}}/{{itemValue}}/{{chunkValue}}.png',
            overlays: [
              {
                label: '星轨王城',
                value: 'castle',
                bounds: [
                  [0, 0],
                  [10, 20],
                ],
                children: [
                  {
                    label: '城堡',
                    value: 'main',
                    bounds: [
                      [100, 200],
                      [300, 400],
                    ],
                    chunks: [
                      {
                        label: '城堡中部',
                        value: 'middle',
                        bounds: [
                          [-10, 20],
                          [30, 40],
                        ],
                      },
                      { label: '城堡下部', value: 'lower' },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    }
    const tiles = { 'GS:ISLAND': makeTile([100, 200]), 'GS:SUMMER': makeTile([3568, 6286]) }
    const { groupsByArea, chunks } = resolveOverlayConfig(config, false, tiles)

    const [island] = groupsByArea.get('GS:ISLAND')!
    expect(island).toMatchObject({ name: '金苹果群岛', role: 'tile', multiple: false })
    expect(island.items.map(item => item.bounds)).toEqual(
      Array(2).fill({
        pointBounds: [
          [-3, -2],
          [30, 40],
        ],
        mapBounds: [
          [97, 198],
          [130, 240],
        ],
        sourcePaths: ['plugins["GS:ISLAND"].overlayConfig.overlays[0].bounds'],
      }),
    )

    const [summer] = groupsByArea.get('GS:SUMMER')!
    expect(summer).toMatchObject({ name: '星轨王城', role: 'default', multiple: true })
    const [middle, lower] = summer.items[0].chunks
    expect(middle.bounds).toEqual({
      pointBounds: [
        [-10, 20],
        [30, 40],
      ],
      mapBounds: [
        [3558, 6306],
        [3598, 6326],
      ],
      sourcePaths: ['plugins["GS:SUMMER"].overlayConfig.overlays[0].children[0].chunks[0].bounds'],
    })
    expect(lower.bounds).toEqual({
      pointBounds: [
        [100, 200],
        [300, 400],
      ],
      mapBounds: [
        [3668, 6486],
        [3868, 6686],
      ],
      sourcePaths: ['plugins["GS:SUMMER"].overlayConfig.overlays[0].children[0].bounds'],
    })
    expect(chunks.find(chunk => chunk.label === '城堡中部')).toMatchObject({
      url: '/castle/main/middle.png',
      bounds: middle.bounds.mapBounds,
    })
  })

  it('保留无边界的项与分片，并区分未启用和缺少底图', () => {
    const config: DTO.DadianJSON = {
      plugins: {
        'GS:DISABLED': { overlay: false },
        'GS:EMPTY': { overlay: true },
        'GS:NO_TILE': {
          overlay: true,
          overlayConfig: {
            overlays: [
              {
                bounds: [
                  [0, 0],
                  [10, 10],
                ],
                children: [{}],
              },
            ],
          },
        },
        'GS:NO_BOUNDS': {
          overlay: true,
          overlayConfig: { overlays: [{ children: [{ chunks: [{}] }] }] },
        },
      },
    }
    const result = resolveOverlayConfig(config, false, { 'GS:NO_BOUNDS': makeTile([0, 0]) })

    expect(result.enabledAreas.has('GS:DISABLED')).toBe(false)
    expect(result.enabledAreas.has('GS:EMPTY')).toBe(true)
    expect(result.groupsByArea.get('GS:EMPTY')).toEqual([])
    expect(result.groupsByArea.get('GS:NO_TILE')?.[0].items[0].bounds).toMatchObject({
      pointBounds: [
        [0, 0],
        [10, 10],
      ],
      reason: '缺少有效的点位原点',
    })
    expect(result.groupsByArea.get('GS:NO_BOUNDS')?.[0].items[0].chunks[0].bounds).toEqual({
      sourcePaths: [],
      reason: '配置未提供边界',
    })
    expect(result.chunks).toEqual([])
  })

  it('保留旧分组字段，并列出各坐标实际使用的正式与 Beta 片段', () => {
    const areaCode = 'GS:LEGACY'
    const group = {
      id: 'legacy-group',
      mask: true,
      label: '旧分组',
      role: 'tile',
      multiple: true,
      items: [
        {
          bounds: [
            [-3, -2],
            [30, 40],
          ],
        },
      ],
    } as const
    const baseGroup = structuredClone(group) as unknown as DTO.OverlayGroupOption
    const partialBetaGroup = {
      items: [{ bounds: [[8]] }],
    } as unknown as DTO.OverlayGroupOption
    const config: DTO.DadianJSON = {
      plugins: { [areaCode]: { overlay: true, overlayConfig: { overlays: [baseGroup] } } },
      pluginsBeta: { [areaCode]: { overlayConfig: { overlays: [partialBetaGroup] } } },
    }
    const { groupsByArea, chunks } = resolveOverlayConfig(config, true, {
      [areaCode]: makeTile([1, 2]),
    })

    expect(groupsByArea.get(areaCode)?.[0]).toMatchObject({
      role: 'tile',
      multiple: true,
      items: [
        {
          bounds: {
            pointBounds: [
              [8, -2],
              [30, 40],
            ],
            mapBounds: [
              [9, 0],
              [31, 42],
            ],
            sourcePaths: [
              'plugins["GS:LEGACY"].overlayConfig.overlays[0].items[0].bounds',
              'pluginsBeta["GS:LEGACY"].overlayConfig.overlays[0].items[0].bounds',
            ],
          },
        },
      ],
    })
    expect(chunks[0].group).toMatchObject({
      id: 'legacy-group',
      mask: true,
      multiple: true,
      role: 'tile',
    })
  })
})

describe('系统配置插件权限与原文', () => {
  it('切换 Beta 权限后恢复正式叠层和点位扩展，原始输入始终不变', () => {
    const config: DTO.DadianJSON = {
      plugins: {
        'GS:FORMAL': {
          overlay: true,
          overlayConfig: {
            overlays: [
              {
                label: '正式分组',
                bounds: [
                  [0, 0],
                  [10, 10],
                ],
                children: [{}],
              },
            ],
          },
          extra: ['underground', 'indoor'],
          extraConfig: { underground: { textActive: '正式提示' } },
        },
      },
      pluginsBeta: {
        'GS:FORMAL': {
          overlayConfig: {
            overlays: [
              {
                label: 'Beta 分组',
                bounds: [
                  [1, 2],
                  [3, 4],
                ],
              },
            ],
          },
          extra: ['1_6_island'],
          extraConfig: {
            underground: { textActive: 'Beta 提示', useDetail: true },
            '1_6_island': { stages: [{ label: '第一阶段', value: 'first' }] },
          },
        },
        'GS:BETA': { overlay: true, overlayConfig: { overlays: [{ label: '独有分组' }] } },
      },
    }
    const original = structuredClone(config)
    const tiles = { 'GS:FORMAL': makeTile([0, 0]), 'GS:BETA': makeTile([0, 0]) }

    const betaOverlay = resolveOverlayConfig(config, true, tiles)
    expect(betaOverlay.enabledAreas.has('GS:BETA')).toBe(true)
    expect(betaOverlay.groupsByArea.get('GS:FORMAL')?.[0]).toMatchObject({
      name: 'Beta 分组',
      bounds: {
        pointBounds: [
          [1, 2],
          [3, 4],
        ],
        sourcePaths: ['pluginsBeta["GS:FORMAL"].overlayConfig.overlays[0].bounds'],
      },
    })
    const betaExtras = resolveMarkerExtras(config, true)
    expect(betaExtras.mergedAreaExtraConfigs['GS:FORMAL']).toEqual({
      underground: { textActive: '正式提示', useDetail: true },
      '1_6_island': { stages: [{ label: '第一阶段', value: 'first' }] },
    })
    expect(betaExtras.enabledExtrasByArea.get('GS:FORMAL')).toContainEqual({
      key: '1_6_island',
      config: { stages: [{ label: '第一阶段', value: 'first' }] },
      sourcePaths: [
        'pluginsBeta["GS:FORMAL"].extra[0]',
        'pluginsBeta["GS:FORMAL"].extraConfig["1_6_island"]',
      ],
    })

    const formalOverlay = resolveOverlayConfig(config, false, tiles)
    expect(formalOverlay.enabledAreas.has('GS:BETA')).toBe(false)
    expect(formalOverlay.groupsByArea.get('GS:FORMAL')?.[0]).toMatchObject({
      name: '正式分组',
      bounds: {
        pointBounds: [
          [0, 0],
          [10, 10],
        ],
        sourcePaths: ['plugins["GS:FORMAL"].overlayConfig.overlays[0].bounds'],
      },
    })
    const formalExtras = resolveMarkerExtras(config, false)
    expect(formalExtras.mergedAreaExtraConfigs['GS:FORMAL']).toEqual({
      underground: { textActive: '正式提示' },
    })
    expect(formalExtras.enabledExtrasByArea.get('GS:FORMAL')).toContainEqual({
      key: 'indoor',
      config: undefined,
      sourcePaths: ['plugins["GS:FORMAL"].extra[1]'],
    })
    expect(config).toEqual(original)
  })
})
