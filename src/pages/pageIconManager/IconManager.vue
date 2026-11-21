<script lang="ts" setup>
import type { IconTypeVo, IconVo } from '@/api/alova/globals'
import { Close, Expand, Fold } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useGlobalDialog } from '@/hooks/useGlobalDialog'
import { useAccessStore } from '@/stores/access'
import { useIconStore } from '@/stores/icon'
import { messageFrom } from '@/utils/messageFrom'
import IconCategorySidebar from './components/IconCategorySidebar.vue'
import IconCreator from './components/IconCreator.vue'
import IconExplorer from './components/IconExplorer.vue'
import IconExplorerHeader from './components/IconExplorerHeader.vue'
import IconPreviewer from './components/IconPreviewer.vue'

const iconStore = useIconStore()
const accessStore = useAccessStore()
const canManageCategories = computed(() => accessStore.get('ADMIN_COMPONENT'))
const canAssignIcons = computed(() => accessStore.get('MANAGER_COMPONENT'))

const previewIconId = shallowRef<number>()
const previewIcon = computed(() => {
  if (!previewIconId.value) return
  return iconStore.idMap.get(previewIconId.value)
})

const manager = useTemplateRef<HTMLDivElement>('manager')
const categoryToggle = useTemplateRef<HTMLButtonElement>('categoryToggle')
const { width } = useElementSize(manager)
const sidebarId = useId()

const categoriesFloating = computed(() => width.value > 0 && width.value < 960)
const previewFloating = computed(() => width.value > 0 && width.value < 640)
const dockedOpen = ref(true)
const floatingOpen = ref(false)
const categoriesDocked = computed(() => !categoriesFloating.value && dockedOpen.value)

const draggingIconId = ref<number>()
const assigningIcons = reactive(new Set<number>())
const categoriesVisible = computed(
  () =>
    categoriesDocked.value
    || (categoriesFloating.value && floatingOpen.value)
    || draggingIconId.value !== undefined,
)

const toggleCategories = () => {
  const open = categoriesFloating.value ? floatingOpen : dockedOpen
  open.value = !open.value
}

const closeFloatingCategories = () => {
  floatingOpen.value = false
}

const onCategorySelect = () => {
  if (!categoriesFloating.value || !floatingOpen.value) return
  closeFloatingCategories()
  categoryToggle.value?.focus()
}

const onEscape = () => {
  if (categoriesFloating.value && floatingOpen.value) {
    onCategorySelect()
  } else if (previewFloating.value) {
    previewIconId.value = undefined
  }
}

const endDrag = () => {
  draggingIconId.value = undefined
}

const assignCategory = async (iconId: number, category: IconTypeVo) => {
  endDrag()
  if (!canAssignIcons.value || category.id === undefined || assigningIcons.has(iconId)) return

  assigningIcons.add(iconId)
  const name = category.name ?? `#${category.id}`
  try {
    const { added, synced } = await iconStore.addIconToCategory(iconId, category.id)
    if (!synced) ElMessage.warning('分类已保存，图标列表同步失败')
    else if (added) ElMessage.success(`已添加到「${name}」`)
    else ElMessage.info(`图标已属于「${name}」`)
  } catch (error) {
    ElMessage.error(`添加到分类失败：${messageFrom(error)}`)
  } finally {
    assigningIcons.delete(iconId)
  }
}

const queryIconName = ref('')
const selectedCategory = shallowRef<IconTypeVo>()
const selectedTypeId = computed(() => selectedCategory.value?.id)

watch(selectedTypeId, () => {
  previewIconId.value = undefined
})

const iconCounts = computed(() => {
  const counts = new Map<number, number>()
  for (const icon of iconStore.iconList) {
    for (const id of new Set(icon.typeIdList)) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
})

const sortKey = ref('id')
const sortType = ref('-')

const filteredIconList = computed(() => {
  const typeId = selectedTypeId.value
  const queryName = queryIconName.value.trim()
  const result = iconStore.iconList.filter(
    ({ typeIdList, tag }) =>
      (typeId === undefined || typeIdList?.includes(typeId))
      && (!queryName || tag?.includes(queryName)),
  )

  const localSortKey = sortKey.value as keyof IconVo
  const isAscending = sortType.value === '+'

  return result.toSorted((pre, next) => {
    const valueA = pre[localSortKey]
    const valueB = next[localSortKey]

    if (valueA == null || valueB == null) return 0

    if (Array.isArray(valueA)) return 0

    if (typeof valueA === 'number')
      return isAscending ? valueA - (valueB as number) : (valueB as number) - valueA

    if (typeof valueA === 'string') {
      // 时间戳
      if (localSortKey.endsWith('Time')) {
        const timeA = new Date(valueA).getTime()
        const timeB = new Date(valueB as string).getTime()
        return isAscending ? timeA - timeB : timeB - timeA
      }
      return isAscending
        ? valueA.localeCompare(valueB as string, undefined, { numeric: true, sensitivity: 'base' })
        : (valueB as string).localeCompare(valueA, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
    }

    return 0
  })
})

const { DialogService } = useGlobalDialog()
const openIconCreator = () => {
  DialogService.open(IconCreator)
}
</script>

<template>
  <div ref="manager" class="icon-manager" @keydown.esc="onEscape">
    <header class="icon-toolbar">
      <button
        ref="categoryToggle"
        type="button"
        class="category-toggle"
        :aria-expanded="categoriesVisible"
        :aria-controls="sidebarId"
        :aria-label="categoriesVisible ? '收起分类' : '展开分类'"
        :title="categoriesVisible ? '收起分类' : '展开分类'"
        @click="toggleCategories"
      >
        <el-icon :size="16"><Fold v-if="categoriesVisible" /><Expand v-else /></el-icon>
        <span>分类</span>
      </button>
      <IconExplorerHeader
        v-model:query-name="queryIconName"
        v-model:sort-key="sortKey"
        v-model:sort-type="sortType"
        :category-name="
          selectedCategory?.name
          ?? (selectedTypeId === undefined ? '全部分类' : `#${selectedTypeId}`)
        "
        @create-icon="openIconCreator"
      />
    </header>

    <div
      class="icon-workspace"
      :class="{ 'is-docked': categoriesDocked, 'has-floating-preview': previewFloating }"
      @click="closeFloatingCategories"
    >
      <IconCategorySidebar
        :id="sidebarId"
        v-model="selectedCategory"
        class="icon-categories"
        :class="{
          'is-visible': categoriesVisible,
          'is-floating': !categoriesDocked && (categoriesFloating || draggingIconId !== undefined),
        }"
        :inert="!categoriesVisible"
        :can-manage="canManageCategories"
        :can-assign="canAssignIcons"
        :dragging-icon-id="draggingIconId"
        :counts="iconCounts"
        :total="iconStore.total"
        @click.stop
        @select="onCategorySelect"
        @assign="assignCategory"
      />

      <IconExplorer
        v-model:actived-item="previewIconId"
        class="icon-grid"
        :data="filteredIconList"
        :can-drag="canAssignIcons"
        :assigning-icons="assigningIcons"
        @drag-start="draggingIconId = $event"
        @drag-end="endDrag"
      />

      <aside v-if="!previewFloating || previewIcon" class="icon-preview" aria-label="图标预览">
        <div v-if="previewFloating" class="icon-preview-header">
          <span>图标预览</span>
          <el-button
            text
            size="small"
            :icon="Close"
            aria-label="关闭预览"
            @click="previewIconId = undefined"
          />
        </div>
        <IconPreviewer
          v-model:icon-id="previewIconId"
          class="icon-preview-content"
          @refresh="() => iconStore.update({ isFull: true })"
        />
      </aside>
    </div>

    <footer class="icon-status">
      <el-text size="small">{{ filteredIconList.length }} 个项目</el-text>
      <template v-if="previewIcon?.url">
        <el-divider direction="vertical" />
        <el-text size="small" truncated>
          图标原始地址：
          <a
            :href="previewIcon.url"
            target="_blank"
            rel="noopener"
            class="hover:underline underline-offset-4"
          >
            {{ decodeURIComponent(previewIcon.url) }}
          </a>
        </el-text>
      </template>
    </footer>
  </div>
</template>

<style scoped>
.icon-manager {
  --category-width: 232px;
  --preview-width: 256px;
  --category-transition: 220ms ease;

  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100%;
  overflow: hidden;
  font-size: 12px;
  container-type: inline-size;
}

.icon-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.category-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  cursor: pointer;
}

.category-toggle:hover,
.category-toggle[aria-expanded='true'] {
  border-color: var(--el-color-primary-light-7);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.category-toggle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 1px;
}

.icon-workspace {
  --sidebar-space: 0px;
  --preview-space: var(--preview-width);

  position: relative;
  display: grid;
  grid-template-columns: var(--sidebar-space) minmax(0, 1fr) var(--preview-space);
  grid-template-rows: minmax(0, 1fr);
  min-width: 0;
  overflow: hidden;
  transition: grid-template-columns var(--category-transition);
}

.icon-workspace.is-docked {
  --sidebar-space: var(--category-width);
}

.icon-workspace.has-floating-preview {
  --preview-space: 0px;
}

.icon-categories {
  position: absolute;
  z-index: 2;
  inset: 0 auto 0 0;
  width: var(--category-width);
  border-inline-end: 1px solid var(--el-border-color-lighter);
  opacity: 0;
  visibility: hidden;
  transform: translateX(-12px);
  transition:
    opacity var(--category-transition),
    transform var(--category-transition),
    visibility var(--category-transition);
}

.icon-categories.is-visible {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}

.icon-categories.is-floating {
  inset: 8px auto 8px 8px;
  width: min(var(--category-width), calc(100% - 16px));
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
}

.icon-grid {
  grid-column: 2;
  min-width: 0;
}

.icon-preview {
  grid-column: 3;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-inline-start: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.has-floating-preview .icon-preview {
  position: absolute;
  z-index: 1;
  inset: 8px 8px 8px auto;
  width: calc(var(--preview-width) + 2px);
  max-width: calc(100% - 16px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-light);
  overflow: hidden;
}

.icon-preview-header,
.icon-status {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 8px 12px;
}

.icon-preview-header {
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-weight: 600;
}

.icon-preview-content {
  flex: 1;
  min-height: 0;
}

.icon-status {
  border-top: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;
}

.icon-status > :not(:last-child) {
  flex: none;
}

@media (prefers-reduced-motion: reduce) {
  .icon-manager {
    --category-transition: 0s;
  }
}
</style>
