import type { ScoreGeneratedCache } from 'types/database'
import { Dexie } from 'dexie'

/** 本地缓存数据库 */
export class CacheDexie extends Dexie {
  /** 下发配置 */
  declare systemConfig: Dexie.Table<DBType.DadianJSON, string>

  /** 用户评分 */
  declare userScore: Dexie.Table<ScoreGeneratedCache, string>

  /** 图标预渲染纹理 */
  declare iconSprite: Dexie.Table<DBType.IconSprite, string>

  /** 点位预渲染纹理 */
  declare markerSprite: Dexie.Table<DBType.MarkerSprite, string>

  /** 二进制文件， key 表示文件名 */
  declare file: Dexie.Table<DBType.FileCache, string>

  /** 结构版本 */
  readonly VERSION = 4

  /** 表结构 */
  readonly STORES = {
    systemConfig: '&digest',
    iconSprite: '&digest',
    markerSprite: '&digest',
    userScore: '&id',
    file: '&name',
  }

  constructor() {
    super('AppCache')
    this.version(this.VERSION).stores(this.STORES)
  }
}
