<script setup lang="ts">
import { SOCKET_EVENT_LABELS } from '@/api/ws/events'
import { usePreferenceStore } from '@/stores'
import { SettingBar, SettingGroup, SettingPanel } from '../components'
import NetworkDiagnostics from './network/NetworkDiagnostics.vue'

const preferenceStore = usePreferenceStore()

const wsEvents: WebSocketAPI.WSEventType[] = [
  'ItemAdded',
  'ItemDeleted',
  'ItemUpdated',
  'ItemBinaryPurged',
  'MarkerAdded',
  'MarkerDeleted',
  'MarkerUpdated',
  'MarkerTweaked',
  'MarkerBinaryPurged',
  'MarkerLinked',
  'MarkerLinkageBinaryPurged',
  'IconBinaryPurged',
  'NoticeAdded',
  'NoticeDeleted',
  'NoticeUpdated',
]

const allowNum = computed(
  () => wsEvents.filter(event => preferenceStore.noticeEvents.includes(event)).length,
)
</script>

<template>
  <SettingPanel>
    <SettingGroup name="Web Socket">
      <NetworkDiagnostics />

      <SettingBar
        label="允许 socket 事件通知"
        :note="preferenceStore.enableNotice ? `已允许 ${allowNum} 个事件的通知` : '已关闭通知功能'"
        :detail-disabled="!preferenceStore.enableNotice"
      >
        <template #setting>
          <el-switch v-model="preferenceStore.enableNotice" aria-label="允许 Socket 事件通知" />
        </template>

        <template #detail>
          <el-checkbox-group v-model="preferenceStore.noticeEvents" class="network-notice-options">
            <el-checkbox
              v-for="event in wsEvents"
              :key="event"
              :label="SOCKET_EVENT_LABELS[event]"
              :value="event"
            />
          </el-checkbox-group>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>

<style scoped>
.network-notice-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 116px), 1fr));
  column-gap: 8px;
}

.network-notice-options :deep(.el-checkbox) {
  min-width: 0;
  height: auto;
  min-height: 34px;
  margin-right: 0;
  white-space: normal;
}
</style>
