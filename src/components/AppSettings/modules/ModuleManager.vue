<script setup lang="ts">
import { ManagerModule } from '@/shared'
import { usePreferenceStore } from '@/stores'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const preferenceStore = usePreferenceStore()

const pageSizeMap = computed(() => new Map(preferenceStore.pageSize))

const usePageSize = (module: ManagerModule) =>
  computed({
    get: () => pageSizeMap.value.get(module) ?? 10,
    set: size => {
      const result = new Map(pageSizeMap.value).set(module, size).entries()
      preferenceStore.pageSize = [...result]
    },
  })

const itemPageSize = usePageSize(ManagerModule.Item)
const markerPageSize = usePageSize(ManagerModule.Marker)
const typePageSize = usePageSize(ManagerModule.Type)
const userPageSize = usePageSize(ManagerModule.User)
const invitationPageSize = usePageSize(ManagerModule.Invitation)
const noticePageSize = usePageSize(ManagerModule.Notice)
const historyPageSize = usePageSize(ManagerModule.History)
</script>

<template>
  <SettingPanel>
    <SettingGroup name="点位编辑">
      <SettingBar label="可同时移动的点位数量" note="未填或为 0 时表示不限制">
        <template #setting>
          <el-input-number
            v-model="preferenceStore.markerDraggingCount"
            :min="0"
            :max="10000"
            :step="1"
          />
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="列表组件的分页数量">
      <SettingBar label="物品管理">
        <template #setting>
          <el-input-number v-model="itemPageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="点位管理">
        <template #setting>
          <el-input-number v-model="markerPageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="图标管理">
        <template #setting>
          <el-input-number v-model="typePageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="用户管理">
        <template #setting>
          <el-input-number v-model="userPageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="用户邀请">
        <template #setting>
          <el-input-number v-model="invitationPageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="公告管理">
        <template #setting>
          <el-input-number v-model="noticePageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
      <SettingBar label="历史记录">
        <template #setting>
          <el-input-number v-model="historyPageSize" :min="10" :max="100" :step="1" />
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
