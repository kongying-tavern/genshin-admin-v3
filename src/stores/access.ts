import { acceptHMRUpdate, defineStore } from 'pinia'
import { RoleTypeEnum } from '@/shared/roleTypeEnum'
import { useUserStore } from '.'
import { isAccessible } from './utils'

/**
 * 角色对应 hiddenFlag 的可访问性掩码
 * 从低位到高位分别对应:
 * 0. 显示
 * 1. 隐藏
 * 2. 测试
 * 3. 彩蛋
 */
const HIDDEN_FLAG_BINARY_MASK: Record<string, number> = {
  [RoleTypeEnum.ADMIN]: 0b1111,
  [RoleTypeEnum.MAP_MANAGER]: 0b1011,
  [RoleTypeEnum.MAP_BETA]: 0b1111,
  [RoleTypeEnum.MAP_PUNCTUATE]: 0b1011,
  [RoleTypeEnum.MAP_USER]: 0b1001,
  [RoleTypeEnum.VISITOR]: 0b1001,
}

/**
 * 权限掩码，从高位到低位分别为：
 * | 系统管理员 | 地图管理员 | 测试打点员 | 地图打点员 | 地图用户 | 匿名用户
 */
export const ACCESS_BINARY_MASK = {
  /** 根管理员组件 */
  ADMIN_COMPONENT: 0b100000,

  /** 管理员组件 */
  MANAGER_COMPONENT: 0b110000,

  /** 打点员组件 */
  PUNCTUATE_COMPONENT: 0b101100,

  /** 普通用户组件 */
  NORMAL_COMPONENT: 0b111110,

  /** 点位关联 */
  MARKER_LINK: 0b110000,

  /** 点位新增 */
  MARKER_CREATE: 0b111100,

  /** 点位编辑 */
  MARKER_EDIT: 0b111100,

  /** 点位删除 */
  MARKER_DELETE: 0b110000,

  /** 点位批量编辑 */
  MARKER_BATCH_EDIT: 0b110000,

  /** 测试项目 */
  HIDDEN_FLAG_BETA: 0b101000,

  /** 隐藏项目 */
  HIDDEN_FLAG_HIDDEN: 0b111100,
}

/** 全局权限控制 */
export const useAccessStore = defineStore('global-access', () => {
  const userStore = useUserStore()

  const roleBinaryMask = computed(() => {
    if (!userStore.info?.role) return 0
    return userStore.info.role.mask
  })

  const userHiddenFlagMask = computed(() => {
    if (!userStore.info?.role?.code) return HIDDEN_FLAG_BINARY_MASK[RoleTypeEnum.VISITOR]
    return HIDDEN_FLAG_BINARY_MASK[userStore.info.role.code]
  })

  const checkHiddenFlag = (hiddenFlag?: number) => {
    return isAccessible(userHiddenFlagMask.value, hiddenFlag)
  }

  /** 获取某功能/资源权限 */
  const get = <K extends keyof typeof ACCESS_BINARY_MASK>(key: K): boolean => {
    return ((1 << roleBinaryMask.value) & ACCESS_BINARY_MASK[key]) > 0
  }

  const hasBeta = computed(() => get('HIDDEN_FLAG_BETA'))

  return {
    hasBeta,
    userHiddenFlagMask,
    get,
    checkHiddenFlag,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAccessStore, import.meta.hot))
}
