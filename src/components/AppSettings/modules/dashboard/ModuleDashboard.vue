<script setup lang="ts">
import type { StorageEstimateExpand, UsageItem } from './types'
import { Odometer, PictureRounded } from '@element-plus/icons-vue'
import * as ElIcons from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useFetchHook } from '@/hooks'
import { clearTileCache, listStorageCaches } from '@/packages/map/src/utils/tileCache'
import { useBroadcastStore, useUserStore } from '@/stores'
import { formatByteSize } from '@/utils'
import { SettingBar, SettingGroup, SettingPanel } from '../../components'
import { StorageChart } from './components'

const userStore = useUserStore()
const broadcastStore = useBroadcastStore()

const clients = computed(() => {
  return [...broadcastStore.state.clients.values()].sort(({ time: ta }, { time: tb }) => ta - tb)
})

const { execute: refreshStorageEstimate, state: storageEstimate } =
  useAsyncState<StorageEstimateExpand>(
    async () => (await navigator.storage?.estimate?.()) ?? {},
    {},
    { resetOnExecute: false },
  )

const {
  execute: refreshStorageCaches,
  state: storageCaches,
  isLoading: cacheListLoading,
} = useAsyncState(listStorageCaches, { tileCaches: [], cacheKeys: [] }, { resetOnExecute: false })

const cacheEntries = computed(() => [
  ...storageCaches.value.tileCaches.map(tile => {
    const source = tile.source ?? tile.sourceKey.slice(0, 8)
    const stores = [tile.opfs && 'OPFS', tile.legacy && '旧缓存'].filter(Boolean).join(' / ')
    return {
      id: `tile:${tile.sourceKey}:${tile.code}`,
      label: `底图瓦片 · ${tile.code} · ${source}（${stores}）`,
      clear: () => clearTileCache(tile),
    }
  }),
  ...storageCaches.value.cacheKeys.map(cacheKey => ({
    id: `cache:${cacheKey}`,
    label: cacheKey,
    clear: () => window.caches.delete(cacheKey),
  })),
])

const selectedCacheIds = ref<string[]>([])

const { refresh: deleteCache, loading: deletingLoading } = useFetchHook({
  onRequest: async () => {
    const selectedEntries = cacheEntries.value.filter(({ id }) =>
      selectedCacheIds.value.includes(id),
    )
    const results = await Promise.allSettled(selectedEntries.map(async ({ clear }) => clear()))
    await Promise.all([refreshStorageEstimate(), refreshStorageCaches()])
    selectedCacheIds.value = []
    if (results.some(result => result.status === 'rejected'))
      ElMessage.error('有缓存未能删除，请重试')
  },
})

const { state: glInfo } = useAsyncState<{ label: string; value: unknown }[]>(async () => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  if (!gl) return []
  return [
    'MAX_TEXTURE_SIZE',
    'DEPTH_BITS',
    'MAX_VIEWPORT_DIMS',
    'RENDERER',
    'VENDOR',
    'VERSION',
    'MAX_TEXTURE_IMAGE_UNITS',
    'SHADING_LANGUAGE_VERSION',
  ].map(key => ({
    label: key.replace(/_/g, ' ').toLowerCase(),
    value: gl.getParameter(gl[key as keyof WebGL2RenderingContext] as number),
  }))
}, [])

const storageDetails = computed<UsageItem[]>(() => {
  const { usage, usageDetails } = storageEstimate.value
  if (!usage || !usageDetails) return []
  const { caches, indexedDB, serviceWorkerRegistrations } = usageDetails
  return [
    { name: '缓存', value: caches ?? 0 },
    { name: '数据库', value: indexedDB ?? 0 },
    { name: '服务线程', value: serviceWorkerRegistrations ?? 0 },
  ]
    .filter(({ value }) => value > 0)
    .map(({ name, value }) => ({
      name,
      value,
      percentage: (100 * value) / usage,
      text: formatByteSize(value),
    }))
})

const userAgent = navigator.userAgent
</script>

<template>
  <SettingPanel>
    <div class="pb-4">
      <div class="flex items-center">
        <el-avatar class="flex-shrink-0" :src="userStore.info?.logo" :size="100" />
        <div class="flex-1 flex flex-col px-2">
          <span class="text-base">{{ userStore.info?.nickname }}</span>
          <span class="text-xs">UID: {{ userStore.info?.id }}</span>
          <span class="text-xs">{{ userStore.info?.role?.name ?? '未知角色' }}</span>
        </div>
        <pre
          class="flex-1 h-[100px] text-xs rounded bg-[var(--el-color-primary-light-9)] p-2 overflow-auto"
          >{{ userAgent.match(/\S+\/\S+/g)?.join('\n') }}</pre>
      </div>
    </div>

    <SettingGroup name="设备信息">
      <SettingBar label="WebGL" note="Make Web Great Again!" :icon="PictureRounded">
        <template #detail>
          <el-descriptions :border="true" :column="3" size="small" direction="vertical">
            <el-descriptions-item v-for="{ label, value } in glInfo" :key="label" :label="label">
              {{ value }}
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </SettingBar>

      <SettingBar label="本地存储" note="这包括本地数据库、缓存等" :icon="Odometer">
        <template #setting>
          <div class="grid place-items-center text-xs">
            目前占用 {{ formatByteSize(storageEstimate.usage ?? 0) }}
          </div>
        </template>

        <template #detail>
          <div class="w-full flex flex-wrap gap-2">
            <StorageChart v-if="storageDetails.length" :data="storageDetails" />
            <div
              v-loading="cacheListLoading"
              element-loading-text="正在加载缓存列表..."
              class="flex-1 h-[240px] text-xs flex flex-col gap-1 overflow-hidden"
            >
              <div class="shrink-0">缓存存储 ({{ cacheEntries.length }})</div>
              <el-checkbox-group
                v-model="selectedCacheIds"
                size="small"
                class="flex-1 flex flex-col overflow-auto"
                :disabled="deletingLoading"
              >
                <el-checkbox
                  v-for="entry in cacheEntries"
                  :key="entry.id"
                  :value="entry.id"
                  class="shrink-0"
                >
                  {{ entry.label }}
                </el-checkbox>
              </el-checkbox-group>
              <div class="shrink-0 flex justify-end">
                <el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="deletingLoading || !selectedCacheIds.length"
                  :icon="ElIcons.Delete"
                  @click="deleteCache"
                >
                  删除选中项
                </el-button>
              </div>
            </div>
          </div>
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="页面信息">
      <SettingBar label="页面实例" :note="`当前 ${clients.length} 个页面正在运作中`">
        <template #detail>
          <div class="text-xs">
            <div v-for="meta in clients" :key="meta.id" class="flex justify-between">
              <div
                :class="{ 'text-[var(--el-color-success)]': meta.id === broadcastStore.meta.id }"
              >
                {{ meta.id }} <span v-if="meta.id === broadcastStore.meta.id">[当前]</span>
              </div>
              <div>创建于 {{ new Date(meta.time).toLocaleString() }}</div>
            </div>
          </div>
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="账户信息">
      <SettingBar label="登录日志">
        <template #detail> 日志 </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
