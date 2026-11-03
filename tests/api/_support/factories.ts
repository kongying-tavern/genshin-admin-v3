import type { AreaVo, IconTypeVo, IconVo, ItemTypeVo, ItemVo, MarkerVo } from '@/api/alova/globals'
import Apis from '@/api/alova'
import {
  registerAreaForCleanup,
  registerIconForCleanup,
  registerIconTypeForCleanup,
  registerItemForCleanup,
  registerItemTypeForCleanup,
  registerMarkerForCleanup,
  registerUserForCleanup,
} from './cleanup'

/** 测试用户名统一前缀，便于人工识别与兜底清理 */
export const TEST_USER_PREFIX = '__apitest_'

/** 测试用户统一口令（需满足后端密码强度要求） */
export const TEST_USER_PASSWORD = 'apitest123456'

let seed = 0

/** 生成全局唯一用户名，避免与真实用户冲突 */
const uniqueUsername = () =>
  `${TEST_USER_PREFIX}${Date.now()}${(seed++).toString(36)}${Math.random().toString(36).slice(2, 7)}`

/**
 * 注册一个临时用户并登记清理。
 * 后端注册接口默认分配 MAP_USER 角色，因此该用户可用于权限阶梯用例。
 */
export const createTestUser = async () => {
  const username = uniqueUsername()
  const { data: userId } = await Apis.user.registerUser({
    data: { username, password: TEST_USER_PASSWORD },
  })
  if (!userId) throw new Error('测试用户注册失败：后端未返回用户 id')
  registerUserForCleanup(userId)
  return { username, password: TEST_USER_PASSWORD, userId }
}

/** 测试地区名称统一前缀，便于人工识别与兜底清理 */
export const TEST_AREA_NAME_PREFIX = '__apitest_'

let areaSeed = 0

/** 生成全局唯一地区代码标签（后端与前端约定代码仅允许 [A-Z0-9_-.]+） */
const uniqueAreaTag = () =>
  `${Date.now()}${(areaSeed++).toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

/** 生成带测试前缀的地区名称 */
export const testAreaName = (tag: string) => `${TEST_AREA_NAME_PREFIX}${tag}`

/**
 * 以任意载荷创建地区并登记清理，返回新地区 id。
 *
 * - `createArea` 只返回 id，不返回完整地区数据；
 * - 载荷完全透传，便于构造边界用例（例如指向不存在父级的孤立地区）。
 */
export const createTestArea = async (data: AreaVo) => {
  const { data: areaId } = await Apis.area.createArea({ data })
  if (typeof areaId !== 'number') throw new Error('测试地区创建失败：后端未返回地区 id')
  registerAreaForCleanup(areaId)
  return areaId
}

/** 创建一个测试根地区（parentId = -1），返回新地区 id */
export const createTestRootArea = async (overrides: AreaVo = {}) => {
  const tag = uniqueAreaTag()
  return await createTestArea({
    name: testAreaName(tag),
    code: `C:${tag}`,
    parentId: -1,
    sortIndex: 0,
    ...overrides,
  })
}

/** 在指定父级下创建测试子地区，返回新地区 id */
export const createTestChildArea = async (parent: AreaVo, overrides: AreaVo = {}) => {
  const tag = uniqueAreaTag()
  return await createTestArea({
    name: testAreaName(tag),
    code: `A:${parent.code!.split(':')[1]}:${tag}`,
    parentId: parent.id,
    sortIndex: 0,
    ...overrides,
  })
}

// ============================== 物品 / 分类 ==============================

/** 测试物品名称统一前缀 */
export const TEST_ITEM_NAME_PREFIX = '__apitest_item_'

/** 测试物品分类名称统一前缀 */
export const TEST_ITEM_TYPE_NAME_PREFIX = '__apitest_itemtype_'

let entitySeed = 0

/** 生成实体名称后缀：时间戳 + 自增序号 + 随机串，保证多次运行也不会重名 */
export const uniqueEntityTag = () =>
  `${Date.now().toString(36)}${(entitySeed++).toString(36)}${Math.random().toString(36).slice(2, 7)}`

/**
 * 创建测试物品分类（默认挂在根级 parentId=-1），返回新分类 id。
 *
 * 后端只做父级自环校验，不会校验父级是否存在，因此载荷完全透传。
 */
export const createTestItemType = async (overrides: ItemTypeVo = {}) => {
  const { data: itemTypeId } = await Apis.item_type.addItemType({
    data: {
      name: `${TEST_ITEM_TYPE_NAME_PREFIX}${uniqueEntityTag()}`,
      parentId: -1,
      sortIndex: 0,
      hiddenFlag: 0,
      ...overrides,
    },
  })
  if (typeof itemTypeId !== 'number') throw new Error('测试物品分类创建失败：后端未返回分类 id')
  registerItemTypeForCleanup(itemTypeId)
  return itemTypeId
}

/**
 * 在指定地区下创建测试物品，返回新物品 id。
 *
 * 后端不校验 `areaId` 是否存在、是否为末端地区，也不校验 `iconId` 是否存在，
 * 用例可以利用这一点构造边界数据。
 */
export const createTestItem = async (areaId: number, overrides: ItemVo = {}) => {
  const { data: itemId } = await Apis.item.createItem({
    data: {
      name: `${TEST_ITEM_NAME_PREFIX}${uniqueEntityTag()}`,
      areaId,
      defaultCount: 1,
      defaultRefreshTime: 0,
      defaultContent: '',
      iconStyleType: 0,
      hiddenFlag: 0,
      sortIndex: 0,
      specialFlag: 0,
      ...overrides,
    },
  })
  if (typeof itemId !== 'number') throw new Error('测试物品创建失败：后端未返回物品 id')
  registerItemForCleanup(itemId)
  return itemId
}

/** 读取单个物品；不存在时返回 undefined */
export const readTestItem = async (itemId: number) => {
  const { data = [] } = await Apis.item.listItemById({ data: [itemId] })
  return data[0]
}

// ============================== 图标 / 分类 ==============================

/** 测试图标标签统一前缀 */
export const TEST_ICON_TAG_PREFIX = '__apitest_icon_'

/** 测试图标分类名称统一前缀 */
export const TEST_ICON_TYPE_NAME_PREFIX = '__apitest_icontype_'

/** 创建测试图标分类（默认挂在根级 parentId=-1），返回新分类 id */
export const createTestIconType = async (overrides: IconTypeVo = {}) => {
  const { data: iconTypeId } = await Apis.icon_type.addIconType({
    data: {
      name: `${TEST_ICON_TYPE_NAME_PREFIX}${uniqueEntityTag()}`,
      parentId: -1,
      ...overrides,
    },
  })
  if (typeof iconTypeId !== 'number') throw new Error('测试图标分类创建失败：后端未返回分类 id')
  registerIconTypeForCleanup(iconTypeId)
  return iconTypeId
}

/** 创建测试图标，返回新图标 id */
export const createTestIcon = async (overrides: IconVo = {}) => {
  const { data: iconId } = await Apis.icon.createIcon({
    data: {
      tag: `${TEST_ICON_TAG_PREFIX}${uniqueEntityTag()}`,
      url: 'https://example.test/apitest/icon.png',
      description: 'apitest icon',
      typeIdList: [],
      ...overrides,
    },
  })
  if (typeof iconId !== 'number') throw new Error('测试图标创建失败：后端未返回图标 id')
  registerIconForCleanup(iconId)
  return iconId
}

/** 读取单个图标；不存在时返回 null */
export const readTestIcon = async (iconId: number) => {
  const { data } = await Apis.icon.getIcon({ pathParams: { iconId } })
  return data ?? null
}

// ============================== 点位 ==============================

/** 测试点位名称统一前缀 */
export const TEST_MARKER_TITLE_PREFIX = '__apitest_marker_'

/**
 * 创建测试点位，返回新点位 id。
 *
 * `markerCreatorId` 由后端按当前登录用户写入，载荷中的值会被覆盖；
 * `itemList` 中的物品 id 不做存在性校验。
 *
 * 默认写入 `extra: {}`：后端 `updateMarker` 会把新旧 extra 做合并，
 * 历史记录的 extra 为 null 时会在写字段阶段空指针，因而无法更新。
 */
export const createTestMarker = async (overrides: MarkerVo = {}) => {
  const { data: markerId } = await Apis.marker.createMarker({
    data: {
      markerTitle: `${TEST_MARKER_TITLE_PREFIX}${uniqueEntityTag()}`,
      position: '100.5,200.5',
      content: 'apitest marker',
      refreshTime: 0,
      hiddenFlag: 0,
      extra: {},
      itemList: [],
      ...overrides,
    },
  })
  if (typeof markerId !== 'number') throw new Error('测试点位创建失败：后端未返回点位 id')
  registerMarkerForCleanup(markerId)
  return markerId
}

/** 读取单个点位；不存在时返回 undefined */
export const readTestMarker = async (markerId: number) => {
  const { data = [] } = await Apis.marker.listMarkerById({ data: { markerIdList: [markerId] } })
  return data[0]
}
