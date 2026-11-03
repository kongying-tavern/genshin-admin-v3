import type { TypeManager } from '../config'
import { IconTypeManager } from './iconType'
import { ItemTypeManager } from './itemType'

export { IconTypeManager, ItemTypeManager }

export const TYPE_MANAGER_KEY_MAP = {
  itemType: new ItemTypeManager(),
  iconType: new IconTypeManager(),
} as Record<string, TypeManager>

export type TypeManagerMap = typeof TYPE_MANAGER_KEY_MAP

export type TypeManagerKeys = keyof TypeManagerMap

export const TYPE_MANAGER_OPTIONS: { label: string; value: TypeManagerKeys }[] = Object.entries(
  TYPE_MANAGER_KEY_MAP,
).map(([typeKey, typeManager]) => ({
  label: typeManager.info.label,
  value: typeKey as TypeManagerKeys,
}))
