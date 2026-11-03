import type { ScoreGeneratedCache, UserArchiveBody } from 'types/database'
import type {
  AreaVo,
  IconVo,
  ItemTypeVo,
  ItemVo,
  MarkerLinkageVo,
  MarkerVo,
} from '@/api/alova/globals'
import { Dexie } from 'dexie'

/** 本地通用数据库 */
export class AppDexie extends Dexie {
  /** 地区 @全量接口 */
  declare area: Dexie.Table<AreaVo, number>

  /** 图标 @全量接口 */
  declare icon: Dexie.Table<IconVo, string>

  /** 物品 @全量接口 */
  declare item: Dexie.Table<ItemVo, number>

  /** 物品类型 @分页接口 */
  declare itemType: Dexie.Table<ItemTypeVo, number>

  /** 点位 @全量接口 */
  declare marker: Dexie.Table<MarkerVo, number>

  /** 点位关联 @全量接口 */
  declare markerLink: Dexie.Table<MarkerLinkageVo, number>

  /** 用户存档 @仅限本地 */
  declare userArchive: Dexie.Table<UserArchiveBody, number>

  /** 通用缓存 @仅限本地 */
  declare cache: Dexie.Table<DBType.InstancedCache, string>

  /** WebSocket 事件 @仅限本地 */
  declare websocketEvents: Dexie.Table<Socket.DataEventRecord, string>

  /** 评分生成缓存月份 @仅限本地 */
  declare scoreCache: Dexie.Table<ScoreGeneratedCache, string>

  /** 数据库结构版本 */
  readonly VERSION = 2

  readonly STORES = {
    area: '&id',
    icon: '&id',
    item: '&id',
    itemType: '&id',
    marker: '&id',
    markerLink: '&id, groupId',
    userArchive: '&id',
    websocketEvents: '&key, time',
    scoreCache: '&id',
  }

  constructor() {
    super('AppData')
    this.version(this.VERSION).stores(this.STORES)
  }
}
