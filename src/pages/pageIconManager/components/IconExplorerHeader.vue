<script setup lang="ts">
import type { IconTypeVo } from '@/api/alova/globals'
import { ArrowDown, CircleCheck, CirclePlus, Sort } from '@element-plus/icons-vue'

const emits = defineEmits<{
  createIcon: []
}>()

const queryName = defineModel<string>('queryName', {
  required: true,
})

const queryType = defineModel<IconTypeVo>('queryType', {
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
  <div
    class="col-span-3 flex justify-end items-center p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
  >
    <!-- 搜索输入框 -->
    <el-input
      v-model="queryName"
      style="max-width: 300px"
      :placeholder="`在 ${queryType.name} 中搜索`"
      clearable
    >
      <template #prefix>
        <el-icon>
          <Search />
        </el-icon>
      </template>
    </el-input>

    <el-divider direction="vertical" />

    <!-- 排序选择器 -->
    <el-dropdown :hide-on-click="false" @command="handleSortCommand">
      <el-button text :icon="Sort">
        排序
        <el-icon class="el-icon--right" :size="12">
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

    <el-divider direction="vertical" />

    <!-- 操作栏 -->
    <el-button text :icon="CirclePlus" @click="() => emits('createIcon')"> 新建 </el-button>
  </div>
</template>
