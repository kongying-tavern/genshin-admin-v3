<script setup lang="ts">
import type { InvitationFilterOptions, InvitationSortOptions } from '../types'
import * as ElIcons from '@element-plus/icons-vue'

const props = defineProps<{
  loading?: boolean
}>()

const emits = defineEmits<{
  create: []
  change: []
}>()

const filter = defineModel<InvitationFilterOptions>('filter', {
  required: true,
})

const sorts = defineModel<InvitationSortOptions>('sorts', {
  required: true,
})

const sortOptions: { role: 'key' | 'type'; value: string; name: string; divided?: boolean }[] = [
  { role: 'key', value: 'id', name: 'ID' },
  { role: 'key', value: 'username', name: '用户名' },
  { role: 'key', value: 'createTime', name: '创建时间' },
  { role: 'type', value: '+', name: '正序', divided: true },
  { role: 'type', value: '-', name: '倒序' },
]

const handleSortCommand = (command: string) => {
  if (props.loading) return
  const [key, value] = command.split(':')
  sorts.value[key as keyof InvitationSortOptions] = value
  emits('change')
}

const filterKeys = [
  { label: '邀请码', value: 'code' },
  { label: '用户名', value: 'username' },
]

const filterKeyLabelMap = filterKeys.reduce((map, { label, value }) => {
  return map.set(value, label)
}, new Map<string, string>())
</script>

<template>
  <div
    class="flex flex-wrap justify-end items-center p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
  >
    <div class="flex gap-1">
      <el-input
        v-model="filter.value"
        :disabled="props.loading"
        :placeholder="`在 ${filterKeyLabelMap.get(filter.key)} 中搜索...`"
        clearable
        style="width: 340px"
        @change="() => emits('change')"
      >
        <template #prefix>
          <el-icon
            :class="props.loading ? '' : 'cursor-pointer hover:text-[var(--el-color-primary)]'"
            @click="() => !props.loading && emits('change')"
          >
            <ElIcons.Search />
          </el-icon>
        </template>
        <template #prepend>
          <el-select-v2 v-model="filter.key" :options="filterKeys" style="width: 100px" />
        </template>
      </el-input>
    </div>

    <el-divider direction="vertical" />

    <el-dropdown :hide-on-click="false" @command="handleSortCommand">
      <el-button text :icon="ElIcons.Sort">
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
                :class="{ 'opacity-0': sorts[option.role] !== option.value }"
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

    <el-button text :icon="ElIcons.CirclePlus" @click="() => emits('create')"> 新增 </el-button>
  </div>
</template>
