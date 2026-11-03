/* oxlint-disable unicorn/no-useless-spread */
// 清理时遍历的是 `[...集合]` 快照：删除过程涉及 await，先固定快照可保证
// 遍历期间即使有新增项也不会影响本轮清理范围。
import Apis from '@/api/alova'
import { loginAsTestAccount } from './auth'

/** 本次测试过程中创建的后端用户 id */
const createdUserIds = new Set<number>()

/** 本次测试过程中创建的后端地区 id */
const createdAreaIds = new Set<number>()

/** 本次测试过程中创建的后端物品分类 id */
const createdItemTypeIds = new Set<number>()

/** 本次测试过程中创建的后端物品 id */
const createdItemIds = new Set<number>()

/** 本次测试过程中创建的后端图标分类 id */
const createdIconTypeIds = new Set<number>()

/** 本次测试过程中创建的后端图标 id */
const createdIconIds = new Set<number>()

/** 本次测试过程中创建的后端点位 id */
const createdMarkerIds = new Set<number>()

/** 登记待清理的用户 */
export const registerUserForCleanup = (userId: number) => {
  createdUserIds.add(userId)
}

/** 登记待清理的地区 */
export const registerAreaForCleanup = (areaId: number) => {
  createdAreaIds.add(areaId)
}

/** 登记待清理的物品分类 */
export const registerItemTypeForCleanup = (itemTypeId: number) => {
  createdItemTypeIds.add(itemTypeId)
}

/** 登记待清理的物品 */
export const registerItemForCleanup = (itemId: number) => {
  createdItemIds.add(itemId)
}

/** 登记待清理的图标分类 */
export const registerIconTypeForCleanup = (iconTypeId: number) => {
  createdIconTypeIds.add(iconTypeId)
}

/** 登记待清理的图标 */
export const registerIconForCleanup = (iconId: number) => {
  createdIconIds.add(iconId)
}

/** 登记待清理的点位 */
export const registerMarkerForCleanup = (markerId: number) => {
  createdMarkerIds.add(markerId)
}

/**
 * 删除本次测试创建的全部用户。
 *
 * 删除用户需要 ADMIN 权限，而用例中途可能已切换为低权限账号，
 * 或被 401/403 响应清空了登录态，因此清理前先以测试主账号重新登录。
 * 单个删除失败不中断整体清理（例如用例自身已覆盖删除行为）。
 */
export const cleanupCreatedUsers = async () => {
  if (!createdUserIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const userId of [...createdUserIds])
    await Apis.user.deleteUser({ pathParams: { workId: userId } }).catch(() => {})

  createdUserIds.clear()
}

/**
 * 删除本次测试创建的全部地区。
 *
 * 删除地区会级联移除整棵子树，因此父级被删除后其子级再删除会返回 500；
 * 单个删除失败不中断整体清理，也不视为错误（用例自身可能已经删过）。
 * 孤立地区（parentId 指向不存在的父级）不会被列表接口检索到，
 * 只能依赖此处登记 id 精确回收。
 */
export const cleanupCreatedAreas = async () => {
  if (!createdAreaIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const areaId of [...createdAreaIds])
    await Apis.area.deleteArea({ pathParams: { areaId } }).catch(() => {})

  createdAreaIds.clear()
}

/** 删除本次测试创建的全部点位；点位可能已被用例删除或随地区级联删除 */
export const cleanupCreatedMarkers = async () => {
  if (!createdMarkerIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const markerId of [...createdMarkerIds])
    await Apis.marker.deleteMarker({ pathParams: { markerId } }).catch(() => {})

  createdMarkerIds.clear()
}

/** 删除本次测试创建的全部物品；删除物品会同时清理其分类与点位关联 */
export const cleanupCreatedItems = async () => {
  if (!createdItemIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const itemId of [...createdItemIds])
    await Apis.item.deleteItem({ pathParams: { itemId } }).catch(() => {})

  createdItemIds.clear()
}

/** 删除本次测试创建的全部物品分类（会递归删除子分类与分类关联） */
export const cleanupCreatedItemTypes = async () => {
  if (!createdItemTypeIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const itemTypeId of [...createdItemTypeIds])
    await Apis.item_type.deleteItemType({ pathParams: { itemTypeId } }).catch(() => {})

  createdItemTypeIds.clear()
}

/** 删除本次测试创建的全部图标 */
export const cleanupCreatedIcons = async () => {
  if (!createdIconIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const iconId of [...createdIconIds])
    await Apis.icon.deleteIcon({ pathParams: { iconId } }).catch(() => {})

  createdIconIds.clear()
}

/** 删除本次测试创建的全部图标分类（会递归删除子分类与分类关联） */
export const cleanupCreatedIconTypes = async () => {
  if (!createdIconTypeIds.size) return

  await loginAsTestAccount().catch(() => {})

  for (const iconTypeId of [...createdIconTypeIds])
    await Apis.icon_type.deleteIconType({ pathParams: { typeId: iconTypeId } }).catch(() => {})

  createdIconTypeIds.clear()
}

/**
 * 统一回收本次测试创建的全部数据。
 *
 * 顺序按引用关系从叶子到根：点位 → 物品 → 图标 → 物品分类 → 图标分类 → 地区 → 用户。
 * 地区删除虽然会尝试级联处理点位与物品，但后端实现存在缺陷（详见跨实体用例），
 * 因此不能依赖地区回收来代替显式删除。
 */
export const cleanupCreatedTestData = async () => {
  await cleanupCreatedMarkers()
  await cleanupCreatedItems()
  await cleanupCreatedIcons()
  await cleanupCreatedItemTypes()
  await cleanupCreatedIconTypes()
  await cleanupCreatedAreas()
  await cleanupCreatedUsers()
}
