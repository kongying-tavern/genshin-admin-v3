<script lang="ts" setup>
import type { GSMarkerInfo } from '@/packages/map'
import { Check, CirclePlus, DeleteFilled, Edit, Rank, VideoCamera } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import { registerCapability } from '@/ai/bindings'
import { MapAiError } from '@/ai/errors'
import { AppBilibiliVideoPlayer, AppIconTagRenderer, GSButton } from '@/components'
import { CloseFilled } from '@/components/GenshinUI/GSIcon'
import { openMarkerEditorDialog } from '@/components/MarkerModifyer/actions'
import { useGlobalDialog, useMarkerControl } from '@/hooks'
import {
  useAccessStore,
  useIconStore,
  useMapStateStore,
  useMarkerStore,
  usePreferenceStore,
} from '@/stores'
import { useMapEntitySync } from '@/stores/mapEntitySync'
import Apis from '@/api/alova'
import { MapAffix } from '../MapAffix'
import { MarkerPanel } from './components'
import { useMarkerDelete, useMarkerExtra, useMarkerFinished, useMarkerMove } from './hooks'

const accessStore = useAccessStore()
const mapStateStore = useMapStateStore()
const markerStore = useMarkerStore()
const preferenceStore = usePreferenceStore()
const sync = useMapEntitySync()

const { iconTextureUrl: tagSpriteUrl, iconCoordMap } = storeToRefs(useIconStore())

const {
  cachedMarkerVo,
  isSnapshot,
  isPopoverActived,
  focus,
  focusedIds,
  selectedMarker,
  blur,
  focusMarker,
} = useMarkerControl()

type DetailStatus = 'checking' | 'ready' | 'offline' | 'unavailable' | 'error'

const requestedId = computed(() => {
  if (!preferenceStore.verifyMarkersOnline) return
  const marker = focus.value ?? selectedMarker.value
  if (marker?.__gs_isSnapshot) return
  return marker?.id
})
const localMarker = computed(() => {
  const id = focus.value?.id
  return id === undefined ? undefined : markerStore.getVisibleMarker(id)
})
const pending = computed(() => {
  const id = requestedId.value
  return id !== undefined && sync.projection.pending.marker.has(id)
})
const detail = shallowRef<{ id: number; scope: string; status: DetailStatus }>()
const refreshCount = ref(0)
const retry = () => refreshCount.value++

const detailStatus = computed<DetailStatus>(() => {
  if (isSnapshot.value) return 'ready'
  if (!preferenceStore.verifyMarkersOnline) return localMarker.value ? 'ready' : 'unavailable'
  if (!sync.online) return 'offline'
  if (!detail.value || detail.value.id !== requestedId.value || detail.value.scope !== sync.scope)
    return 'checking'
  return detail.value.status === 'ready' && pending.value ? 'checking' : detail.value.status
})

const markerDetails = computed<GSMarkerInfo | null>(() => {
  const anchor = focus.value
  if (!anchor || detailStatus.value !== 'ready') return null
  if (isSnapshot.value) return anchor
  const marker = localMarker.value
  return marker ? { ...marker, render: anchor.render } : null
})

// 再次点击列表中的同一点位时，焦点集合会更换，触发重新核对。
watch(
  [requestedId, focusedIds, () => sync.scope, () => sync.online, refreshCount],
  ([id, , scope, online], _, onCleanup) => {
    detail.value = undefined
    if (id === undefined || !scope || !online) return
    const controller = new AbortController()
    const { signal } = controller
    const check = async () => {
      try {
        const markers = await markerStore.verifyMarkers([id], signal)
        if (signal.aborted) return
        if (markerStore.deletedIds.has(id)) {
          blur(id)
          return
        }
        detail.value = { id, scope, status: markers.has(id) ? 'ready' : 'unavailable' }
      } catch {
        if (!signal.aborted) detail.value = { id, scope, status: 'error' }
      }
    }
    // 悬停经过多个点位时，只核对停留的点位。
    const timeout = window.setTimeout(
      () => void check(),
      mapStateStore.interaction.isPopoverOnHover ? 120 : 0,
    )
    onCleanup(() => {
      window.clearTimeout(timeout)
      controller.abort()
    })
  },
  { immediate: true },
)

watch(pending, value => {
  if (value && focus.value) retry()
})
watch(useDocumentVisibility(), visibility => {
  if (visibility === 'visible' && focus.value && requestedId.value !== undefined) retry()
})

const { isFinished, toggle: toggleFinished } = useMarkerFinished(markerDetails)

const { isMoving, isEnable, position } = useMarkerMove(
  computed(() => markerDetails.value ?? cachedMarkerVo.value),
)

const { hiddenFlagType, refreshTimeText } = useMarkerExtra(markerDetails)

const copyId = async () => {
  if (markerDetails.value?.id === undefined) return
  const idStr = `${markerDetails.value.id}`
  await navigator.clipboard.writeText(idStr)
  ElMessage.success({
    message: `ID "${idStr}" 已复制到剪贴板`,
  })
}

// ==================== 编辑点位 ====================
const openingEditor = ref(false)

const editMarker = async () => {
  const id = markerDetails.value?.id
  if (id === undefined || openingEditor.value) return
  const scope = sync.scope
  try {
    let marker = localMarker.value
    if (!preferenceStore.verifyMarkersOnline) {
      openingEditor.value = true
      const { data } = await Apis.marker.listMarkerById({
        data: { markerIdList: [id] },
        shareRequest: false,
      })
      if (sync.scope !== scope || focus.value?.id !== id) return
      marker = data?.find(row => row.id === id && accessStore.checkHiddenFlag(row.hiddenFlag))
    }
    if (!marker) throw new Error('点位当前不可用')
    openMarkerEditorDialog(marker)
  } catch (error) {
    if (sync.scope !== scope || focus.value?.id !== id) return
    ElMessage.error({
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    openingEditor.value = false
  }
}

// ==================== AI 页面句柄 ====================
const unbindSurface = registerCapability({
  id: 'markerPopover',
  kind: 'popover',
  title: '点位弹窗',
  description: '按 markerId 打开点位详情，开启高新鲜度模式时异步核对，或关闭当前弹层',
  open: params => {
    const record = (params ?? {}) as { markerId?: unknown }
    const markerId = Number(record.markerId)
    if (!Number.isInteger(markerId) || markerId <= 0) {
      throw new MapAiError('E_INVALID_PARAMS', 'markerId 必须是正整数')
    }
    const marker = markerStore.getVisibleMarker(markerId)
    if (!marker) throw new MapAiError('E_NOT_FOUND', `点位不存在：${markerId}`)
    focusMarker(marker)
    return { markerId }
  },
  close: () => {
    blur()
  },
  getState: () => ({
    open: Boolean(focus.value),
    markerId: focus.value?.id,
    title: markerDetails.value?.markerTitle,
    loading: Boolean(focus.value) && detailStatus.value === 'checking',
    isSnapshot: isSnapshot.value,
    isMoving: isMoving.value,
  }),
})

onUnmounted(() => {
  unbindSurface()
})

// ==================== 删除点位 ====================
const { confirmDeleteMarker } = useMarkerDelete()

const { DialogService } = useGlobalDialog()

// 预览点位视频
const playBilibiliVideo = (url: string) => {
  DialogService.props({
    url,
    width: 640,
    height: 360,
  }).open(AppBilibiliVideoPlayer)
}

/** 当前是否存在地图任务 */
const hasMapMission = computed(() => Boolean(mapStateStore.mission))
</script>

<template>
  <Transition name="marker-popover" @before-leave="element => element.setAttribute('inert', '')">
    <MapAffix
      v-if="isPopoverActived"
      v-slot="{ zoom }"
      :pos="position"
      pickable
      no-covert-coord
      integer
    >
      <MarkerPanel :zoom="zoom" :aria-busy="detailStatus === 'checking'">
        <template #header>
          <template v-if="markerDetails">
            <AppIconTagRenderer
              class="w-7 h-7 flex-shrink-0"
              :src="tagSpriteUrl"
              :mapping="iconCoordMap.get(markerDetails.render.mainIconId)"
            />

            <div
              class="flex-1 px-1 whitespace-nowrap overflow-hidden text-ellipsis"
              :title="markerDetails.markerTitle"
            >
              {{ markerDetails.markerTitle }}
            </div>
          </template>
          <div v-else class="flex-1 text-sm px-2">点位详情</div>

          <button
            type="button"
            aria-label="关闭点位详情"
            class="flex-shrink-0 hover:brightness-90 active:brightness-50 cursor-pointer p-1"
            @click="blur()"
          >
            <el-icon :size="20" color="#ECE5D8">
              <CloseFilled />
            </el-icon>
          </button>
        </template>

        <template v-if="markerDetails" #picture>
          <div v-if="markerDetails.picture" class="w-[256px] h-[256px] overflow-hidden p-2">
            <el-image
              :src="markerDetails.picture"
              :preview-src-list="[markerDetails.picture]"
              preview-teleported
              fit="contain"
              style="width: 100%; height: 100%; border-radius: 4px"
            >
              <template #placeholder>
                <el-skeleton style="width: 256px; height: 256px" loading animated>
                  <template #template>
                    <el-skeleton-item variant="image" style="width: 100%; height: 100%" />
                  </template>
                </el-skeleton>
              </template>
            </el-image>
          </div>
        </template>

        <template v-if="markerDetails" #append>
          <div class="p-1 flex flex-wrap gap-1 text-xs mx-1 rounded bg-[#4A526540] text-[#676D7A]">
            <div
              class="info-tag is-interactive decoration-dashed underline-offset-2 hover:underline active:decoration-solid"
              @click="copyId"
            >
              ID {{ markerDetails.id }}
            </div>
            <div v-if="hiddenFlagType !== undefined" class="info-tag">
              {{ hiddenFlagType }}
            </div>
            <div class="info-tag">
              {{ refreshTimeText || '不刷新' }}
            </div>
            <div
              v-if="markerDetails.videoPath"
              class="info-tag is-interactive"
              title="预览视频"
              @click="() => playBilibiliVideo(markerDetails!.videoPath!)"
            >
              <el-icon :size="20">
                <VideoCamera />
              </el-icon>
            </div>
          </div>
        </template>

        <template #content>
          <textarea
            v-if="markerDetails"
            :value="markerDetails.content"
            readonly
            :rows="markerDetails.picture ? 8 : 16"
            class="custom-scrollbar block p-1 text-sm outline-none resize-none bg-[var(--card-bg-color)]"
            autocomplete="off"
          />
          <div v-else-if="detailStatus === 'checking'" class="px-3 pt-3 pb-4" role="status">
            <span class="sr-only">正在核对点位详情</span>
            <el-skeleton class="detail-skeleton" loading animated>
              <template #template>
                <div class="flex flex-col gap-3" aria-hidden="true">
                  <el-skeleton-item variant="text" class="w-3/4" />
                  <el-skeleton-item v-for="row in 4" :key="row" variant="text" />
                  <el-skeleton-item variant="text" class="w-1/2" />
                  <el-skeleton-item variant="button" class="mt-1" />
                </div>
              </template>
            </el-skeleton>
          </div>
          <div
            v-else
            class="min-h-28 p-3 grid place-content-center gap-3 text-sm text-center"
            role="status"
          >
            <div v-if="detailStatus === 'offline'">联网后自动核对点位</div>
            <div v-else-if="detailStatus === 'unavailable'">点位当前不可用</div>
            <template v-else>
              <div>暂时无法核对点位详情</div>
              <GSButton size="small" @click="retry">重试</GSButton>
            </template>
          </div>
        </template>

        <template v-if="markerDetails" #footer>
          <template v-if="isSnapshot">
            <div class="w-full h-[40px] text-sm grid place-content-center">点位快照</div>
          </template>

          <template v-else>
            <div class="flex justify-between p-1 gap-1">
              <GSButton
                v-if="accessStore.get('MARKER_EDIT')"
                size="small"
                theme="dark"
                :loading="openingEditor"
                :disabled="hasMapMission"
                @click="editMarker"
              >
                <template #icon>
                  <el-icon color="#F7BA3F">
                    <Edit />
                  </el-icon>
                </template>
                编辑
              </GSButton>

              <GSButton
                :theme="isFinished ? undefined : 'dark'"
                class="flex-1"
                size="small"
                @click="toggleFinished"
              >
                <template #icon>
                  <el-icon :color="isFinished ? 'var(--el-color-success)' : 'var(--el-color-info)'">
                    <component :is="isFinished ? Check : CirclePlus" />
                  </el-icon>
                </template>
                {{ isFinished ? '已完成' : '完成' }}
              </GSButton>

              <GSButton
                v-if="accessStore.get('MARKER_EDIT')"
                :theme="isMoving ? undefined : 'dark'"
                size="small"
                :disabled="!isEnable"
                title="移动点位"
                @click="isMoving = !isMoving"
              >
                <template #icon>
                  <el-icon color="#F7BA3F">
                    <Rank />
                  </el-icon>
                </template>
              </GSButton>

              <GSButton
                v-if="accessStore.get('MARKER_DELETE')"
                size="small"
                theme="dark"
                title="删除点位"
                :disabled="hasMapMission"
                @click="() => confirmDeleteMarker(markerDetails)"
              >
                <template #icon>
                  <el-icon color="#CF5945">
                    <DeleteFilled />
                  </el-icon>
                </template>
              </GSButton>
            </div>
          </template>
        </template>
      </MarkerPanel>
    </MapAffix>
  </Transition>
</template>

<style scoped>
.marker-popover-enter-active,
.marker-popover-leave-active {
  transition: opacity 150ms ease;
}

.marker-popover-enter-from,
.marker-popover-leave-to {
  opacity: 0;
}

.detail-skeleton {
  --el-skeleton-color: #bfb7aa;
  --el-skeleton-to-color: #e8e0d4;
}

.info-tag {
  @apply h-6 px-1 rounded-sm
    grid place-content-center
    text-xs
    bg-[#faf5ed];

  &.is-interactive {
    @apply cursor-pointer;
    &:hover {
      @apply bg-[#ece5d8];
    }
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
    background-color: var(--card-bg-color);
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 5px;
    border: 2px solid var(--card-bg-color);
    cursor: default;
    background-color: #bfbbb5;
    transition: all ease 150ms;
    &:hover {
      background-color: #ffffff;
    }
  }
}
</style>
