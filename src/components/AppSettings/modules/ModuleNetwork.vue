<script setup lang="ts">
import type { WS } from '@/worker/webSocket/types'
import { useSubscription } from '@vueuse/rxjs'
import { liveQuery } from 'dexie'
import { WEBSOCKET_WORKER_CONFIG } from '@/configs'
import { wsdb } from '@/database'
import { useFetchHook } from '@/hooks'
import { usePreferenceStore, useSocketStore } from '@/stores'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const socketStore = useSocketStore()
const preferenceStore = usePreferenceStore()

const wsEvents: { label: string; value: WebSocketAPI.WSEventType; divider?: boolean }[] = [
  // 物品
  { label: '物品新增', value: 'ItemAdded' },
  { label: '物品删除', value: 'ItemDeleted' },
  { label: '物品更新', value: 'ItemUpdated' },
  { label: '物品数据库更新', value: 'ItemBinaryPurged' },
  // 点位
  { label: '点位新增', value: 'MarkerAdded' },
  { label: '点位删除', value: 'MarkerDeleted' },
  { label: '点位更新', value: 'MarkerUpdated' },
  { label: '点位批量更新', value: 'MarkerTweaked' },
  { label: '点位数据库更新', value: 'MarkerBinaryPurged' },
  // 点位关联
  { label: '关联新增', value: 'MarkerLinked' },
  { label: '关联数据库更新', value: 'MarkerLinkageBinaryPurged' },
  // 图标
  { label: '图标数据库更新', value: 'IconBinaryPurged' },
  // 公告
  { label: '公告新增', value: 'NoticeAdded' },
  { label: '公告删除', value: 'NoticeDeleted' },
  { label: '公告更新', value: 'NoticeUpdated' },
]

const allowNum = computed(() => {
  const allKeys = wsEvents.reduce((set, { value }) => set.add(value), new Set<string>())
  const archivedKeys = new Set(preferenceStore.noticeEvents)
  return allKeys.intersection(archivedKeys).size
})

const wsLogs = shallowRef({
  total: 0,
  list: [] as WS.Log[],
})

useSubscription(
  liveQuery(() => wsdb.logs.toArray()).subscribe(logs => {
    wsLogs.value = { total: logs.length, list: logs.slice(-10) }
  }),
)

const { refresh: exportLogs, loading: exportLoading } = useFetchHook({
  onRequest: async () => {
    const logs = await wsdb.logs.toArray()
    const encoder = new TextEncoder()
    const uarray = encoder.encode(JSON.stringify(logs))
    const blob = new Blob([uarray], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    const url = URL.createObjectURL(blob)
    a.href = url
    a.download = `${new Date().toLocaleString()}.json`
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
})

const { refresh: clearLogs, loading: clearLoading } = useFetchHook({
  onRequest: async () => {
    await wsdb.logs.clear()
  },
})
</script>

<template>
  <SettingPanel>
    <SettingGroup name="Web Socket">
      <SettingBar
        label="响应时延"
        :note="`检测间隔: ${WEBSOCKET_WORKER_CONFIG.HEARTBEAT.INTERVAL / 1000}s`"
      >
        <template #setting>
          {{ socketStore.context.status }}
        </template>
      </SettingBar>

      <SettingBar label="日志" :note="`latest 10 of ${wsLogs.total}`">
        <template #setting>
          <el-button :disabled="exportLoading" @click="exportLogs"> 导出日志 </el-button>
        </template>
        <template #detail>
          <div v-if="!wsLogs.total" class="text-[var(--el-text-color-secondary)]">无内容</div>
          <div v-for="log in wsLogs.list" :key="log.id" class="text-xs">
            <b>{{ `[${new Date(log.t).toLocaleString()}]` }}</b> {{ log.msg }}
          </div>
          <div class="mt-2">
            <el-button
              type="danger"
              plain
              size="small"
              :loading="clearLoading"
              :disabled="!wsLogs.total"
              @click="clearLogs"
            >
              清空日志
            </el-button>
          </div>
        </template>
      </SettingBar>

      <SettingBar
        label="允许 socket 事件通知"
        :note="preferenceStore.enableNotice ? `已允许 ${allowNum} 个事件的通知` : '已关闭通知功能'"
        :detail-disabled="!preferenceStore.enableNotice"
      >
        <template #setting>
          <el-switch v-model="preferenceStore.enableNotice" />
        </template>

        <template #detail>
          <el-checkbox-group v-model="preferenceStore.noticeEvents">
            <div class="grid grid-cols-2 sm:grid-cols-4">
              <el-checkbox
                v-for="event in wsEvents"
                :key="event.value"
                :label="event.label"
                :value="event.value"
              />
            </div>
          </el-checkbox-group>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
