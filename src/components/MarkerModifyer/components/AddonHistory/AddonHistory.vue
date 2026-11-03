<script lang="ts" setup>
import type { MarkerVo } from '@/api/alova/globals'
import { Clock, CopyDocument } from '@element-plus/icons-vue'
import { useFetchHook } from '@/hooks'
import { AddonTeleporter } from '..'
import { useMarkerHistory } from '../../hooks'
import HistoryStatistic from './HistoryStatistic.vue'
import HistoryViewer from './HistoryViewer.vue'

defineProps<{
  loading?: boolean
}>()

defineEmits<{
  useHistory: [MarkerVo]
}>()

const addonId = defineModel<string | undefined>('addonId', {
  required: false,
})

const isAddonActived = computed({
  get: () => addonId.value === 'history',
  set: isActive => {
    addonId.value = isActive ? 'history' : ''
  },
})

const markerVo = defineModel<MarkerVo>('markerVo', {
  required: true,
})

const { data: creator } = useFetchHook({
  immediate: true,
  initialValue: {},
  onRequest: async () => {
    const { creatorId } = toValue(markerVo)
    if (creatorId === undefined) return {}
    const { data = {} } = await Apis.user.getUserInfo({
      pathParams: {
        userId: creatorId,
      },
    })
    return data
  },
})

const isAutoCollapse = ref(true)

const {
  users,
  record,
  oldDisabled,
  newDisabled,
  oldContent,
  oldHistory,
  newContent,
  toOldOne,
  toNewOne,
  loading: historyLoading,
  refresh,
} = useMarkerHistory(markerVo)

whenever(isAddonActived, refresh, { immediate: true })

const updaterId = computed(() => oldHistory.value?.creatorId ?? markerVo.value.creatorId)

const updater = computed(() => {
  const user = users.value.get(`${updaterId.value}`)
  if (user) return user
  if (!oldHistory.value) return creator.value
  return undefined
})

const statisticVisible = ref(false)
</script>

<template>
  <el-button
    :icon="Clock"
    :type="isAddonActived ? 'primary' : 'default'"
    circle
    style="margin-left: 0"
    @click="isAddonActived = !isAddonActived"
  />

  <HistoryStatistic v-model:visible="statisticVisible" :record="record" :users="users" />

  <AddonTeleporter :active="isAddonActived">
    <div class="h-full overflow-hidden flex flex-col">
      <div class="flex-shrink-0 flex items-center mb-1">
        <div class="flex-1 text-center">
          <div class="flex items-center gap-1">
            <el-tag
              class="flex-shrink-0"
              :type="oldHistory ? 'warning' : 'success'"
              disable-transitions
            >
              {{ oldHistory ? '编辑' : '创建' }}
            </el-tag>
            <div class="flex-1 px-1">
              <el-button
                text
                style="width: 100%; padding: 0 4px; font-size: 12px"
                @click="statisticVisible = true"
              >
                {{
                  oldHistory
                    ? new Date(oldHistory.createTime ?? '').toLocaleString()
                    : new Date(markerVo.createTime ?? '').toLocaleString()
                }}
              </el-button>
            </div>
          </div>
        </div>

        <el-button-group class="flex-shrink-0">
          <el-button style="padding: 0 4px" :disabled="oldDisabled" @click="toOldOne">
            <div class="flex flex-col items-center text-xs">
              <el-icon>
                <Back />
              </el-icon>
              <div class="scale-90">上一更改</div>
            </div>
          </el-button>
          <el-button style="padding: 0 4px" :disabled="newDisabled" @click="toNewOne">
            <div class="flex flex-col items-center text-xs">
              <el-icon>
                <Right />
              </el-icon>
              <div class="scale-90">下一更改</div>
            </div>
          </el-button>
        </el-button-group>
      </div>

      <div class="grid grid-cols-2 items-center mb-2">
        <div v-if="!updater" class="grid place-items-center">unknown</div>

        <div
          v-else
          class="flex gap-1 text-xs overflow-hidden"
          :title="`${updater.nickname} (${updater.username})`"
        >
          <el-avatar
            :size="32"
            shape="circle"
            :src="updater.logo"
            fit="cover"
            class="flex-shrink-0"
          >
            <el-icon :size="24">
              <Avatar />
            </el-icon>
          </el-avatar>
          <div class="flex-1 flex flex-col overflow-hidden">
            <div>UID: {{ updaterId }}</div>
            <div class="overflow-hidden whitespace-nowrap text-ellipsis">
              {{ `${updater.nickname} (${updater.username})` }}
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end">
          <el-checkbox v-model="isAutoCollapse" size="small" style="margin-right: 12px">
            自动折叠
          </el-checkbox>
        </div>
      </div>

      <el-divider style="margin: 0" />

      <div class="flex-1 overflow-hidden">
        <el-scrollbar height="100%">
          <HistoryViewer
            :loading="historyLoading"
            :diffs="oldHistory?.diffs"
            :new-content="newContent"
            :old-content="oldContent"
            :auto-collapse="isAutoCollapse"
          />
        </el-scrollbar>
      </div>

      <el-divider style="margin: 0 0 8px" />

      <el-button
        :disabled="historyLoading || loading"
        :icon="CopyDocument"
        title="将此记录填充至表单"
        type="primary"
        plain
        @click="() => $emit('useHistory', newContent)"
      >
        将此记录填充至表单
      </el-button>
    </div>
  </AddonTeleporter>
</template>
