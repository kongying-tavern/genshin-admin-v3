import { flushPromises, mount } from '@vue/test-utils'
import { ElButton } from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, toRaw } from 'vue'
import ModuleMapSetting from '@/components/AppSettings/modules/ModuleMapSetting.vue'
import MapConfigViewer from '@/components/AppSettings/modules/map-config/MapConfigViewer.vue'
import { resolveSystemConfigTiles } from '@/stores/systemConfigTiles'
import { resolveMarkerExtras, resolveOverlayConfig } from '@/stores/systemConfigLayers'

const mondstadt = 'A:MD:MONDSTADT'
const simulanka = 'A:SL:SIMULANKA'
const betaArea = 'A:BT:TEST'
const fixture: DTO.DadianJSON = {
  tiles: {
    [mondstadt]: { extend: '共用模板', name: '蒙德底图' },
    [simulanka]: { extend: '共用模板', name: '希穆兰卡底图', settings: { center: [500, -2211] } },
    共用模板: { code: 'map1', center: [3568, 6286], size: [8192, 8192] },
  },
  tilesBeta: {
    [simulanka]: { code: 'beta-map' },
    [betaArea]: { extend: '共用模板', code: 'beta-only' },
  },
  plugins: {
    [mondstadt]: { extra: ['underground'], extraConfig: { underground: { useDetail: false } } },
    [simulanka]: {
      overlay: true,
      overlayConfig: {
        overlays: [
          {
            label: '星轨王城',
            children: [
              {
                label: '城堡',
                chunks: [
                  {
                    label: '城堡中部',
                    bounds: [
                      [20, 30],
                      [40, 50],
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  pluginsBeta: { [simulanka]: { overlayConfig: { panelIcon: 'beta-glyph' } } },
  application: {
    avatar: [{ label: '头像一', url: '/missing.png' }, { label: '头像二' }],
    nameCard: [],
  },
}

const state = reactive({
  hasBeta: false,
  raw: fixture,
  loading: false,
  digest: 'fixture-digest',
  areaList: [
    { code: mondstadt, name: '蒙德' },
    { code: simulanka, name: '希穆兰卡' },
    { code: betaArea, name: '测试地区' },
  ],
  preference: { areaCode: simulanka, settingActivedKey: 'mapsetting', presets: [] },
})

vi.mock('@/stores/access', () => ({ useAccessStore: () => state }))
vi.mock('@/stores/area', () => ({ useAreaStore: () => state }))
vi.mock('@/stores/userPreference', () => ({ usePreferenceStore: () => state.preference }))
vi.mock('@/stores/dadian', () => ({
  useDadianStore: () => ({
    get raw() {
      return state.raw
    },
    get loading() {
      return state.loading
    },
    get meta() {
      return {
        digest: state.digest,
        version: state.hasBeta ? '正式版本 / 测试版本' : '正式版本',
      }
    },
  }),
}))
vi.mock('@/stores/tile', () => ({
  useTileStore: () => ({
    get resolvedTileConfigs() {
      return resolveSystemConfigTiles(state.raw, state.hasBeta)
    },
  }),
}))
vi.mock('@/stores/overlay', () => ({
  useOverlayStore: () => {
    const resolve = () => {
      const tiles = Object.fromEntries(
        [...resolveSystemConfigTiles(state.raw, state.hasBeta)].map(([code, { config }]) => [
          code,
          config,
        ]),
      )
      return resolveOverlayConfig(state.raw, state.hasBeta, tiles)
    }
    return {
      get groupsByArea() {
        return resolve().groupsByArea
      },
      get enabledAreas() {
        return resolve().enabledAreas
      },
    }
  },
}))
vi.mock('@/stores/markerExtra', () => ({
  useMarkerExtraStore: () => ({
    get enabledExtrasByArea() {
      return resolveMarkerExtras(state.raw, state.hasBeta).enabledExtrasByArea
    },
  }),
}))
vi.mock('@/components/AppSettings/components/ShortcutKey', () => ({}))

const mountMapSettings = () =>
  mount(ModuleMapSetting, {
    attachTo: document.body,
    global: {
      components: { ElButton },
      stubs: {
        ElIcon: true,
        ElInputNumber: true,
        ElScrollbar: { template: '<div><slot /></div>' },
        ElSwitch: true,
      },
    },
  })

describe('地图设置配置查看器', () => {
  let wrapper: ReturnType<typeof mountMapSettings>
  const button = (text: string) =>
    wrapper
      .findAll('button')
      .find(button => (button.attributes('aria-label') ?? button.text()) === text)!
  const chooseView = async (text: string) => {
    const label = wrapper.findAll('label').find(label => label.text() === text)!
    await label.get<HTMLInputElement>('input[type="radio"]').setValue(true)
  }
  const openDetails = async (selector: string, text: string) => {
    const detail = wrapper
      .findAll<HTMLDetailsElement>(selector)
      .find(detail => detail.get('summary').text().includes(text))!
    detail.element.open = true
    await detail.trigger('toggle')
    return detail
  }

  beforeEach(() => {
    state.hasBeta = false
    state.raw = fixture
    state.digest = 'fixture-digest'
    state.preference.areaCode = simulanka
    wrapper = mountMapSettings()
  })

  afterEach(() => wrapper.unmount())

  it('从地图设置打开当前地区，浏览叠层和其他地区后返回并恢复焦点', async () => {
    const initialPrefs = structuredClone(toRaw(state.preference))
    const entry = button('查看配置')
    await entry.trigger('click')

    const region = wrapper.get<HTMLSelectElement>('select')
    expect(region.element.value).toBe(simulanka)
    expect(wrapper.text()).toContain('4068, 4075')
    expect(wrapper.text()).toContain('tiles["共用模板"].center')

    await chooseView('叠层与插件')
    await button('城堡中部').trigger('click')
    expect(wrapper.text()).toContain('点位坐标边界')
    expect(wrapper.text()).toContain('3588, 6316')

    await region.setValue(mondstadt)
    expect(wrapper.text()).toContain('未启用叠层')
    expect(wrapper.text()).toContain('地下层级')

    await button('返回地图设置').trigger('click')
    await flushPromises()
    expect(wrapper.find('select').exists()).toBe(false)
    expect(document.activeElement).toBe(entry.element)
    expect(state.preference).toEqual(initialPrefs)
  })

  it('降权时关闭展开的 Beta 片段，重新加载后可浏览全局资源', async () => {
    state.hasBeta = true
    state.preference.areaCode = 'A:NA:MISSING'
    await button('查看配置').trigger('click')

    const region = wrapper.get<HTMLSelectElement>('select')
    expect(region.element.value).toBe(mondstadt)
    expect(region.findAll('option').map(option => option.element.value)).toContain(betaArea)
    await region.setValue(simulanka)
    await chooseView('配置原文')

    const betaRaw = await openDetails('details.config-fragment', 'tilesBeta[')
    expect(betaRaw.text()).toContain('beta-map')
    expect(wrapper.text()).toContain('测试版本')

    state.hasBeta = false
    await flushPromises()
    expect(wrapper.html()).not.toContain('tilesBeta[')
    expect(wrapper.html()).not.toContain('pluginsBeta[')
    expect(wrapper.text()).not.toContain('测试版本')
    const visibleModel = JSON.stringify(wrapper.getComponent(MapConfigViewer).props('model'))
    expect(visibleModel).not.toMatch(/beta-map|beta-only|beta-glyph/)
    expect(region.findAll('option').map(option => option.element.value)).not.toContain(betaArea)
    expect(region.element.value).toBe(simulanka)
    expect(wrapper.find('details[open]').exists()).toBe(false)
    await chooseView('底图与坐标')
    expect(wrapper.text()).toContain('map1')
    expect(wrapper.text()).not.toContain('beta-map')

    await chooseView('全局资源')
    const avatars = await openDetails('details.resource-category', '头像')
    expect(avatars.get('summary').text()).toContain('2 项')
    const avatar = await openDetails('details.config-fragment', '头像一')
    await avatar.get('img').trigger('error')
    expect(avatar.text()).toContain('图片加载失败')
    expect(avatar.text()).toContain('/missing.png')
    const cards = await openDetails('details.resource-category', '名片')
    expect(cards.text()).toContain('当前类别没有条目')

    state.raw = { editor: { bannerText: '本地测试配置' } }
    state.digest = 'second-digest'
    await flushPromises()
    expect(wrapper.text()).toContain('second-digest')
    expect(wrapper.text()).not.toContain('头像一')
    await openDetails('details.resource-category', '公告文本')
    const announcement = await openDetails('details.config-fragment', 'editor.bannerText')
    expect(announcement.text()).toContain('本地测试配置')
  })
})
