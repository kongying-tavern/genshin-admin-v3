<script setup lang="ts">
import type { LoadFunction, TreeInstance } from 'element-plus'
import type { IconTypeVo } from '@/api/alova/globals'
import type { Component } from 'vue'
import {
  Delete,
  Edit,
  Folder,
  FolderAdd,
  FolderOpened,
  Grid,
  Loading,
  More,
  Rank,
} from '@element-plus/icons-vue'
import { ElMessage, ElTree } from 'element-plus'
import { useGlobalDialog } from '@/hooks/useGlobalDialog'
import { getIconTypeList, iconTypeRevision, ROOT_ICON_TYPE_ID } from '@/hooks/useIconType'
import { TypeCreator, TypeDeleteConfirm, TypeEditor } from '@/pages/pageTypeManager/components'
import { IconTypeManager } from '@/pages/pageTypeManager/definitions/iconType'
import { ICON_DRAG_TYPE } from '../types'

const props = defineProps<{
  canManage: boolean
  canAssign: boolean
  counts: ReadonlyMap<number, number>
  total: number
  draggingIconId: number | undefined
}>()

const selected = defineModel<IconTypeVo | undefined>({ required: true })

const emit = defineEmits<{
  select: []
  assign: [iconId: number, category: IconTypeVo]
}>()

const categories = new IconTypeManager()
const { DialogService } = useGlobalDialog()
const tree = useTemplateRef<TreeInstance>('tree')
const treeKey = ref(0)
const rootState = ref<'loading' | 'ready' | 'failed'>('loading')
const expandedIds = new Set<number>()
const defaultExpandedIds = shallowRef<number[]>([])
const selectedPath = new Map<number, number>()

const treeProps = { label: 'name', isLeaf: 'isFinal' }
type CategoryTreeNode = Parameters<LoadFunction>[0]

const select = (category?: IconTypeVo) => {
  selectedPath.clear()
  let parentId = ROOT_ICON_TYPE_ID
  if (category && category.id !== undefined) {
    const path = tree.value?.getNodePath(category.id) as IconTypeVo[] | undefined
    for (const { id } of path ?? []) {
      if (id === undefined) continue
      selectedPath.set(parentId, id)
      parentId = id
    }
  }
  selected.value = category
  emit('select')
}

const load: LoadFunction = async (node, resolve, reject) => {
  const isRoot = node.level === 0
  const parentId = isRoot ? ROOT_ICON_TYPE_ID : (node.data as IconTypeVo).id
  if (parentId === undefined) return resolve([])

  const key = treeKey.value
  try {
    const types = (await getIconTypeList(parentId)).filter(
      type => type.id !== undefined && type.id !== ROOT_ICON_TYPE_ID,
    )
    if (key !== treeKey.value) return
    const selectedChildId = selectedPath.get(parentId)
    if (selectedChildId !== undefined) {
      const child = types.find(type => type.id === selectedChildId)
      if (!child) {
        selectedPath.clear()
        selected.value = undefined
      } else if (selected.value?.id === child.id) {
        selected.value = child
      }
    }
    if (isRoot) rootState.value = 'ready'
    resolve(types)
  } catch {
    if (key !== treeKey.value) return
    reject()
    if (isRoot) rootState.value = 'failed'
    else ElMessage.error('加载子分类失败，请重试')
  }
}

const reloadTree = () => {
  defaultExpandedIds.value = [...expandedIds]
  rootState.value = 'loading'
  treeKey.value++
}

watch(iconTypeRevision, reloadTree)

const onExpand = ({ id }: IconTypeVo) => {
  if (id !== undefined) expandedIds.add(id)
}

const onCollapse = ({ id }: IconTypeVo) => {
  if (id !== undefined) expandedIds.delete(id)
}

const openCategoryDialog = (component: Component, data?: IconTypeVo, parent?: IconTypeVo) => {
  if (!props.canManage) return
  DialogService.props({ data, parent, manager: categories })
    .listeners({
      success: () => {
        if (component !== TypeCreator || parent?.id === undefined) return
        onExpand(parent)
        defaultExpandedIds.value = [...expandedIds]
      },
    })
    .open(component)
}

const categoryActions = [
  { label: '新增子分类', icon: FolderAdd, dialog: TypeCreator },
  { label: '重命名', icon: Edit, dialog: TypeEditor },
  { label: '删除分类', icon: Delete, dialog: TypeDeleteConfirm },
] as const

const handleCategoryAction = (dialog: Component, category: IconTypeVo) => {
  if (dialog === TypeCreator) {
    openCategoryDialog(dialog, undefined, category)
    return
  }
  const path = category.id === undefined ? [] : tree.value?.getNodePath(category.id)
  openCategoryDialog(dialog, category, path?.at(-2) as IconTypeVo | undefined)
}

const dropTargetId = ref<number>()
let expandTimer: ReturnType<typeof setTimeout> | undefined

const clearDropTarget = () => {
  dropTargetId.value = undefined
  clearTimeout(expandTimer)
}

const isIconDrag = (event: DragEvent) =>
  props.canAssign
  && props.draggingIconId !== undefined
  && event.dataTransfer?.types.includes(ICON_DRAG_TYPE)

const dragOverCategory = (event: DragEvent, category: IconTypeVo, node: CategoryTreeNode) => {
  if (!isIconDrag(event) || category.id === undefined) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'

  if (dropTargetId.value === category.id) return
  clearDropTarget()
  dropTargetId.value = category.id
  if (!node.isLeaf && !node.expanded) {
    expandTimer = setTimeout(() => node.expand(() => onExpand(category)), 650)
  }
}

const leaveCategory = (event: DragEvent, category: IconTypeVo) => {
  if (dropTargetId.value !== category.id) return
  const { currentTarget, relatedTarget } = event
  if (
    currentTarget instanceof Element
    && relatedTarget instanceof Node
    && currentTarget.contains(relatedTarget)
  )
    return
  clearDropTarget()
}

const dropOnCategory = (event: DragEvent, category: IconTypeVo) => {
  const iconId = props.draggingIconId
  if (!isIconDrag(event) || iconId === undefined || category.id === undefined) return
  event.preventDefault()
  clearDropTarget()
  if (event.dataTransfer?.getData(ICON_DRAG_TYPE) === String(iconId)) {
    emit('assign', iconId, category)
  }
}

watch(() => props.draggingIconId, clearDropTarget)
onBeforeUnmount(clearDropTarget)
</script>

<template>
  <aside class="category-sidebar" aria-label="图标分类">
    <header class="category-header">
      <h2>图标分类</h2>
      <el-button
        v-if="canManage"
        size="small"
        type="primary"
        text
        :icon="FolderAdd"
        @click="openCategoryDialog(TypeCreator)"
      >
        新增分类
      </el-button>
    </header>

    <button
      type="button"
      class="category-row category-pick category-all"
      :class="{ 'is-selected': !selected }"
      :aria-pressed="!selected"
      @click="select()"
    >
      <el-icon :size="16"><Grid /></el-icon>
      <span class="category-name">全部分类</span>
      <span class="category-count">{{ total }}</span>
    </button>

    <div class="category-scroll">
      <ElTree
        :key="treeKey"
        ref="tree"
        lazy
        node-key="id"
        class="category-tree"
        :aria-busy="rootState === 'loading'"
        :expand-on-click-node="false"
        :auto-expand-parent="false"
        :current-node-key="selected?.id"
        :default-expanded-keys="defaultExpandedIds"
        :indent="14"
        :props="treeProps"
        :load="load"
        @node-expand="onExpand"
        @node-collapse="onCollapse"
        @node-click="select"
      >
        <template #empty>
          <div class="category-empty" role="status">
            <template v-if="rootState === 'loading'">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在加载分类…
            </template>
            <template v-else-if="rootState === 'failed'">
              加载分类失败
              <el-button size="small" link type="primary" @click="reloadTree">重试</el-button>
            </template>
            <template v-else>暂无分类</template>
          </div>
        </template>

        <template #default="{ data, node }">
          <div
            class="category-row"
            :class="{
              'is-selected': selected?.id === data.id,
              'is-drop-target': dropTargetId === data.id,
            }"
            @dragover="dragOverCategory($event, data, node)"
            @dragleave="leaveCategory($event, data)"
            @drop="dropOnCategory($event, data)"
          >
            <button
              type="button"
              class="category-pick"
              :aria-pressed="selected?.id === data.id"
              :title="categories.getName(data)"
              @click.stop="select(data)"
            >
              <el-icon :size="15"><FolderOpened v-if="node.expanded" /><Folder v-else /></el-icon>
              <span class="category-name">{{ categories.getName(data) }}</span>
              <span class="category-count">{{ counts.get(data.id) ?? 0 }}</span>
            </button>
            <el-dropdown
              v-if="canManage"
              trigger="click"
              placement="bottom-end"
              @command="dialog => handleCategoryAction(dialog, data)"
            >
              <button
                type="button"
                class="category-action"
                :aria-label="`管理分类 ${categories.getName(data)}`"
                @click.stop
              >
                <el-icon :size="15"><More /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="action in categoryActions"
                    :key="action.label"
                    :command="action.dialog"
                    :icon="action.icon"
                    :divided="action.dialog === TypeDeleteConfirm"
                  >
                    {{ action.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </ElTree>
    </div>

    <div v-if="canAssign" class="category-hint">
      <el-icon :size="14"><Rank /></el-icon>
      {{ dropTargetId === undefined ? '拖动图标到分类' : '松开以添加到分类' }}
    </div>
  </aside>
</template>

<style scoped>
.category-sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  user-select: none;
  background: var(--el-bg-color);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 10px 0 14px;
}

.category-header h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.category-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 8px;
}

.category-tree {
  --el-tree-node-hover-bg-color: transparent;

  background: transparent;
}

.category-tree :deep(.el-tree-node__content) {
  height: 36px;
}

.category-tree :deep(.el-tree-node__expand-icon) {
  padding: 5px;
}

.category-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding-inline-end: 3px;
  color: var(--el-text-color-regular);
  border-radius: 6px;
}

.category-row:hover,
.category-row:focus-within {
  background: var(--el-fill-color-light);
}

.category-row.is-selected {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  box-shadow: inset 2px 0 var(--el-color-primary);
}

.category-row.is-drop-target {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
  outline: 1px dashed var(--el-color-primary);
  outline-offset: -1px;
}

.category-pick,
.category-action {
  display: flex;
  align-items: center;
  border: 0;
  border-radius: 6px;
  color: inherit;
  font: inherit;
  background: transparent;
  cursor: pointer;
}

.category-pick {
  flex: 1;
  min-width: 0;
  min-height: 32px;
  gap: 7px;
  padding: 0 5px 0 7px;
  text-align: left;
}

.category-pick:focus-visible,
.category-action:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}

.category-all {
  flex: none;
  width: auto;
  min-height: 36px;
  margin: 0 8px 4px;
  padding: 0 10px;
  font-weight: 600;
}

.category-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-count {
  flex: none;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 5px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.is-selected .category-count {
  color: inherit;
  background: var(--el-color-primary-light-8);
}

.category-action {
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--el-text-color-secondary);
}

.category-action:hover,
.category-action[aria-expanded='true'] {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.category-empty,
.category-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
}

.category-empty {
  justify-content: center;
  min-height: 48px;
}

.category-hint {
  padding: 9px 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
