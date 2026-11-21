<script setup lang="ts">
import { ArrowDown, CircleCheck, CirclePlus, Search, Sort } from '@element-plus/icons-vue'

defineProps<{
  categoryName: string
}>()

const emits = defineEmits<{
  createIcon: []
}>()

const queryName = defineModel<string>('queryName', {
  required: true,
})

const sortKey = defineModel<string>('sortKey', {
  required: true,
})

const sortType = defineModel<string>('sortType', {
  required: true,
})

const sortOptions: { role: 'key' | 'type'; value: string; name: string; divided?: boolean }[] = [
  { role: 'key', value: 'tag', name: '名称' },
  { role: 'key', value: 'id', name: '图片 id' },
  { role: 'key', value: 'createTime', name: '创建时间' },
  { role: 'key', value: 'updateTime', name: '修改时间' },
  { role: 'type', value: '+', name: '正序', divided: true },
  { role: 'type', value: '-', name: '倒序' },
]

const handleSortCommand = (command: string) => {
  const [role, value] = command.split(':')
  if (role === 'key') sortKey.value = value
  else sortType.value = value
}
</script>

<template>
  <div class="icon-explorer-tools">
    <!-- 搜索输入框 -->
    <el-input
      v-model="queryName"
      class="icon-search"
      :placeholder="`在 ${categoryName} 中搜索`"
      aria-label="搜索图标"
      clearable
    >
      <template #prefix>
        <el-icon>
          <Search />
        </el-icon>
      </template>
    </el-input>

    <!-- 排序选择器 -->
    <el-dropdown :hide-on-click="false" @command="handleSortCommand">
      <el-button class="toolbar-action" text :icon="Sort" aria-label="排序">
        <span class="toolbar-label">排序</span>
        <el-icon class="el-icon--right toolbar-label" :size="12">
          <ArrowDown />
        </el-icon>
      </el-button>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="option in sortOptions"
            :key="option.value"
            :command="`${option.role}:${option.value}`"
            :divided="option.divided"
          >
            <div class="flex items-center gap-2">
              <el-icon
                class="transition-all"
                :class="{
                  'opacity-0': (option.role === 'key' ? sortKey : sortType) !== option.value,
                }"
                :size="12"
              >
                <CircleCheck />
              </el-icon>
              <div>{{ option.name }}</div>
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 操作栏 -->
    <el-button
      class="toolbar-action"
      text
      :icon="CirclePlus"
      aria-label="新建图标"
      @click="emits('createIcon')"
    >
      <span class="toolbar-label">新建</span>
    </el-button>
  </div>
</template>

<style scoped>
.icon-explorer-tools {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.icon-search {
  min-width: 0;
  max-width: 300px;
}

.toolbar-action {
  flex: none;
  padding-inline: 8px;
}

@container (width < 520px) {
  .toolbar-label {
    display: none;
  }

  .toolbar-action :deep(.el-icon + span) {
    margin-left: 0;
  }
}
</style>
