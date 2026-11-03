<script lang="ts" setup>
import type { IconTypeVo, IconVo } from '@/api/alova/globals'
import { Expand, Fold } from '@element-plus/icons-vue'
import { ElTree } from 'element-plus'
import { useGlobalDialog, useIconType } from '@/hooks'
import { useIconStore } from '@/stores'
import { IconExplorer, IconExplorerHeader, IconPreviewer } from './components'
import IconCreator from './components/IconCreator.vue'

const iconStore = useIconStore()

const previewIconId = shallowRef<number>()
const previewIcon = computed(() => {
  if (!previewIconId.value) return
  return iconStore.idMap.get(previewIconId.value)
})

const sidebarCollapsed = ref(false)

const queryIconName = ref('')
const queryIconType = ref<IconTypeVo>({
  id: -1,
  name: '全部类型',
})

const sortKey = ref('id')
const sortType = ref('-')

const filteredIconList = computed(() => {
  let result = iconStore.iconList

  const { id: typeId = -1 } = queryIconType.value
  if (typeId > -1) {
    result = iconStore.iconList.filter(({ typeIdList = [] }) => {
      return typeIdList.includes(typeId)
    })
  }

  const queryName = queryIconName.value.trim()
  if (queryName.length > 0) {
    result = iconStore.iconList.filter(({ tag = '' }) => {
      return tag.includes(queryName)
    })
  }

  const localSortKey = sortKey.value as keyof IconVo
  const isAscending = sortType.value === '+'

  return result.toSorted((pre, next) => {
    const valueA = pre[localSortKey]
    const valueB = next[localSortKey]

    if (valueA === undefined) return 0

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

const handleCurrentChange = (iconType: IconTypeVo) => {
  queryIconType.value = iconType
  previewIconId.value = undefined
}

const { load: loadIconType } = useIconType(true)

const { DialogService } = useGlobalDialog()
const openIconCreator = () => {
  DialogService.open(IconCreator)
}
</script>

<template>
  <div
    class="icon-manager grid grid-rows-[auto_1fr_auto] h-full overflow-hidden text-xs"
    :class="sidebarCollapsed ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[200px_1fr_auto]'"
  >
    <IconExplorerHeader
      v-model:query-name="queryIconName"
      v-model:query-type="queryIconType"
      v-model:sort-key="sortKey"
      v-model:sort-type="sortType"
      @create-icon="openIconCreator"
    />

    <div class="h-full border-r-[1px] border-[var(--el-border-color-lighter)] flex flex-col">
      <div
        class="flex items-center justify-between p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
      >
        <span v-show="!sidebarCollapsed" class="font-medium">图标分类</span>
        <el-button
          :icon="sidebarCollapsed ? Expand : Fold"
          size="small"
          text
          @click="sidebarCollapsed = !sidebarCollapsed"
        />
      </div>
      <ElTree
        v-show="!sidebarCollapsed"
        lazy
        accordion
        node-key="id"
        highlight-current
        class="flex-1 overflow-auto"
        :current-node-key="-1"
        :default-expanded-keys="[-1]"
        :expand-on-click-node="false"
        :props="{
          label: 'name',
          isLeaf: 'isFinal',
        }"
        :load="loadIconType"
        @current-change="handleCurrentChange"
      />
    </div>

    <IconExplorer v-model:actived-item="previewIconId" :data="filteredIconList" />

    <IconPreviewer
      v-model:icon-id="previewIconId"
      @refresh="() => iconStore.update({ isFull: true })"
    />

    <div class="border-t-[1px] border-[var(--el-border-color-lighter)] col-span-3 p-2 px-3">
      <el-text size="small">
        {{ filteredIconList.length }} 个项目
        <template v-if="previewIcon">
          <el-divider direction="vertical" />
          图标原始地址：
          <a
            :href="previewIcon.url"
            class="hover:underline underline-offset-4"
            target="_blank"
            rel="noopener"
          >
            {{ decodeURIComponent(previewIcon.url ?? '') }}
          </a>
        </template>
      </el-text>
    </div>
  </div>
</template>
