<script setup lang="ts">
import type { SysUserDeviceVo, SysUserVo } from '@/api/alova/globals'
import dayjs from 'dayjs'
import { UAParser } from 'ua-parser-js'
import { PgUnit, usePagination } from '@/hooks'
import { DeviceStatus } from '@/shared'
import { useUserDevice, useUserDeviceEdit } from '../hooks'
import { isUnknown } from '../utils'
import DeviceCard from './DeviceCard.vue'

const props = defineProps<{
  data: SysUserVo
}>()

const panelLoading = defineModel<boolean>('loading', {
  required: true,
})

const { pagination, layout } = usePagination({
  units: [PgUnit.TOTAL, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  init: {
    current: 1,
    pageSize: 6,
    total: 0,
  },
})

const {
  deviceList,
  loading,
  refresh,
  onSuccess: onListFetchSuccess,
} = useUserDevice(
  computed(() => props.data),
  {
    pagination,
  },
)

const selectedDeviceData = ref<SysUserDeviceVo>()

onListFetchSuccess(({ record: [first] = [] }) => {
  if (selectedDeviceData.value || !first) return
  selectedDeviceData.value = first
})

const {
  submit,
  loading: editLoading,
  onSuccess: onEditSuccess,
} = useUserDeviceEdit(selectedDeviceData, {
  loading: panelLoading,
})

onEditSuccess(() => {
  refresh()
})

const handleSelectDevice = (data: SysUserDeviceVo) => {
  if (editLoading.value) return
  selectedDeviceData.value = data
}

const address = computed(() => {
  if (!selectedDeviceData.value?.ipRegion) return ''
  const { isUnknown, country, province, city, region, isp } = selectedDeviceData.value.ipRegion
  if (isUnknown) return ''
  return `${country} ${province} ${city} ${region} ${isp}`
})

const ua = computed(() => {
  if (!selectedDeviceData.value) return UAParser('')
  return UAParser(selectedDeviceData.value.deviceId)
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div
      v-if="!selectedDeviceData"
      class="h-44 grid place-items-center text-[var(--el-text-color-secondary)]"
    >
      请选择设备
    </div>

    <div
      v-else
      v-loading="editLoading"
      element-loading-text="操作中..."
      class="h-44 p-4 flex gap-2"
    >
      <div
        class="flex-1 grid grid-cols-[48px_1fr_30px_1fr] grid-rows-[repeat(5,28px)] text-xs gap-x-[6px]"
      >
        <div class="info-label">ID</div>
        <div class="info-content">
          {{ selectedDeviceData.id }}
        </div>

        <div
          class="row-span-2 col-span-2 mb-2 border border-[var(--el-border-color)] rounded grid place-items-center content-center"
          :title="ua.ua"
        >
          <div>{{ isUnknown(ua.os) ? '未知' : `${ua.os.name} ${ua.os.version}` }}</div>
          <div>{{ ua.cpu.architecture ?? '未知' }}</div>
        </div>

        <div class="info-label">平台</div>
        <div class="info-content" :title="`${ua.browser.name} ${ua.browser.version}`">
          {{ isUnknown(ua.browser) ? '未知' : `${ua.browser.name} ${ua.browser.version}` }}
        </div>

        <div class="info-label">登录IP</div>
        <div class="info-content col-span-3">{{ selectedDeviceData.ipv4 }} ({{ address }})</div>

        <div class="info-label">登录时间</div>
        <div class="info-content col-span-3">
          {{ dayjs(selectedDeviceData.createTime).format('YYYY-MM-DD HH:mm:ss') }}
        </div>

        <div class="info-label">设备状态</div>
        <div class="info-content col-span-3">
          <el-radio-group
            :model-value="selectedDeviceData.status"
            size="small"
            @update:model-value="v => submit(v as SysUserDeviceVo['status'])"
          >
            <el-radio-button :value="DeviceStatus.UNKNOWN"> 默认 </el-radio-button>
            <el-radio-button :value="DeviceStatus.VALID"> 允许 </el-radio-button>
            <el-radio-button :value="DeviceStatus.BLOCKED"> 禁用 </el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <el-divider style="margin: 0; padding: 0 0 16px" />

    <div v-loading="loading" element-loading-text="加载中..." class="flex-1 overflow-hidden">
      <div
        v-if="!deviceList.length"
        class="h-full grid place-items-center text-[var(--el-text-color-secondary)]"
      >
        暂无登录记录
      </div>
      <el-scrollbar v-else>
        <DeviceCard
          v-for="device in deviceList"
          :key="device.id"
          :data="device"
          :is-selected="device.id === selectedDeviceData?.id"
          @select-device="handleSelectDevice"
        />
      </el-scrollbar>
    </div>

    <el-pagination
      v-model:current-page="pagination.current"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :layout="layout"
      :page-sizes="[10]"
      :pager-count="5"
      :disabled="loading"
      size="small"
      class="flex-shrink-0 flex justify-end items-center p-4"
      background
      @current-change="refresh"
    />
  </div>
</template>

<style scoped>
.info-label {
  font-weight: bolder;
}

.info-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
