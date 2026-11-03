<script lang="ts" setup>
import { ArrowDown, CircleCheck, Search, Sort } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const emits = defineEmits<{
  change: []
}>()

const userStore = useUserStore()

const filterValue = defineModel<string>('modelValue', {
  required: true,
})

const filterKey = defineModel<string>('filterKey', {
  required: true,
})

const filterRoleIds = defineModel<number[]>('filterRoleIds')

const sortInfo = defineModel<Record<string, string>>('sortInfo', {
  required: true,
})

const sortOptions: { role: 'key' | 'type'; value: string; name: string; divided?: boolean }[] = [
  { role: 'key', value: 'id', name: 'id' },
  { role: 'key', value: 'nickname', name: '昵称' },
  { role: 'key', value: 'createTime', name: '创建时间' },
  { role: 'type', value: '+', name: '正序', divided: true },
  { role: 'type', value: '-', name: '倒序' },
]

const handleSortCommand = (command: string) => {
  const [key, value] = command.split(':')
  sortInfo.value[key] = value
  emits('change')
}
</script>

<template>
  <div
    class="col-span-3 flex justify-end items-center p-2 border-b-[1px] border-[var(--el-border-color-lighter)]"
  >
    <div class="flex gap-1">
      <el-select
        v-model="filterRoleIds"
        multiple
        clearable
        collapse-tags
        placeholder="角色"
        style="width: 320px"
        @change="() => $emit('change')"
      >
        <el-option
          v-for="role in userStore.roleList"
          :key="role.id!"
          :label="role.name"
          :value="role.id!"
        />
      </el-select>

      <el-select v-model="filterKey" style="width: 130px" @change="() => $emit('change')">
        <el-option label="昵称" value="nickname" />
        <el-option label="用户名" value="username" />
      </el-select>

      <el-input
        v-model="filterValue"
        placeholder="搜索..."
        clearable
        @change="() => $emit('change')"
      >
        <template #prefix>
          <el-icon>
            <Search />
          </el-icon>
        </template>
      </el-input>
    </div>

    <el-divider direction="vertical" />

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
                :class="{ 'opacity-0': sortInfo[option.role] !== option.value }"
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

    <slot name="footer" />
  </div>
</template>
