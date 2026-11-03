<script setup lang="ts">
import type { LinkActionEnum } from '@/shared'
import * as ElIcons from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useGlobalDialog } from '@/hooks'
import { GSLinkLayer } from '@/packages/map'
import { LINK_ACTION_NAME_MAP, LINK_CONFIG_MAP } from '@/shared'
import { useMapStateStore, useMarkerLinkStore } from '@/stores'
import { useLinkOperate } from '../AppStateBar'
import { MapAffix } from '../MapAffix'
import { LinkDeleteConfirm } from './components'

const markerLinkStore = useMarkerLinkStore()
const mapStateStore = useMapStateStore()

const { modifyLinks, extractLink } = useLinkOperate()

const { isEnable, isProcessing } = mapStateStore.subscribeMission('markerLink', () => [])

const focusedMeta = computed(() => {
  const focusedIds = mapStateStore.interaction.focusElements.get(GSLinkLayer.layerName) as
    | Set<string>
    | undefined
  if (!focusedIds?.size || focusedIds.size > 1) return
  const first = markerLinkStore.idMap.get(Number([...focusedIds][0]))
  if (!first) return
  const { fromId = -1, toId = -1, linkAction } = first
  const linkKey = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}-${linkAction!}`
  return {
    link: first,
    linkKey,
    isReverse: fromId > toId,
  }
})

const isEditing = computed(() => {
  if (!focusedMeta.value) return false
  const { linkKey, isReverse } = focusedMeta.value
  const editingInfo = modifyLinks.value.get(linkKey)
  if (!editingInfo) return false
  return isReverse === editingInfo.isReverse
})

const isEditDisabled = computed(() => {
  return !isEnable.value || isEditing.value
})

const isDeleteDisabled = computed(() => {
  return !isEnable || isProcessing.value
})

const color = computed(() => {
  if (!focusedMeta.value) return
  const { link } = focusedMeta.value
  const config = LINK_CONFIG_MAP.get(link.linkAction as LinkActionEnum)
  if (!config) return
  return `rgba(${config.lineColor.join(',')})`
})

const actionName = computed(() => {
  if (!focusedMeta.value) return
  const { link } = focusedMeta.value
  return LINK_ACTION_NAME_MAP.get(link.linkAction as LinkActionEnum)
})

const position = computed(() => {
  if (!focusedMeta.value) return
  const { fromId, toId } = focusedMeta.value.link
  const fromMarker = mapStateStore.currentMarkerIdMap.get(fromId!)
  if (!fromMarker) return
  const toMarker = mapStateStore.currentMarkerIdMap.get(toId!)
  if (!toMarker) return
  const [fromX, fromY] = fromMarker.render.position
  const [toX, toY] = toMarker.render.position
  return [(fromX + toX) / 2, (fromY + toY) / 2] as [number, number]
})

const copyGroupId = async () => {
  if (!focusedMeta.value?.link.groupId) return
  await navigator.clipboard.writeText(focusedMeta.value.link.groupId)
  ElMessage.success(`GID "${focusedMeta.value.link.groupId}" 已复制到剪贴板`)
}

const editLink = () => {
  if (!focusedMeta.value || isEditDisabled.value) return
  const { link, linkKey, isReverse } = focusedMeta.value
  extractLink(linkKey, {
    id: `${link.id}`,
    isDelete: false,
    isMerge: false,
    isReverse,
    raw: link,
  })
}

const { DialogService } = useGlobalDialog()

const confirmDelete = async () => {
  if (!focusedMeta.value || isDeleteDisabled.value) return
  await DialogService.config({
    width: 'fit-content',
    alignCenter: true,
    closeOnClickModal: false,
    closeOnPressEscape: false,
  })
    .props({
      link: focusedMeta.value.link,
    })
    .open(LinkDeleteConfirm)
    .afterClosed<boolean>()
}
</script>

<template>
  <MapAffix :pos="position" no-covert-coord integer>
    <template v-if="focusedMeta">
      <div class="genshin-link-popover font-[HYWenHei-85W] text-sm">
        <div
          class="bg-[#B6B3AF] p-1 rounded font-[HYWenHei-55S] flex items-center gap-1"
          @click="copyGroupId"
        >
          <span
            class="shrink-0 w-[32px] h-5 rounded-sm bg-[#FAF5ED] text-[#4A5366] px-1 text-xs grid place-content-center"
          >
            分组
          </span>
          <span class="text-[white] overflow-hidden text-ellipsis whitespace-nowrap">
            {{ focusedMeta.link.groupId?.slice(-8).toUpperCase() }}
          </span>
        </div>
        <div class="bg-[#B6B3AF] p-1 rounded font-[HYWenHei-55S] flex items-center gap-1">
          <span
            class="shrink-0 w-[32px] h-5 rounded-sm bg-[#FAF5ED] text-[#4A5366] px-1 text-xs grid place-content-center"
          >
            连线
          </span>
          <span class="text-[white]">
            {{ focusedMeta.link.id }}
          </span>
        </div>
        <div class="bg-[#B6B3AF] p-1 rounded font-[HYWenHei-55S] flex items-center gap-1">
          <span
            class="shrink-0 w-[32px] h-5 rounded-sm bg-[#FAF5ED] text-[#4A5366] px-1 text-xs grid place-content-center"
          >
            类型
          </span>
          <span class="inline-block w-1 h-4 bg-[var(--color)]" :style="{ '--color': color }" />
          <span class="text-[white]">
            {{ actionName }}
          </span>
        </div>
        <div class="bg-[#B6B3AF] p-1 rounded font-[HYWenHei-55S] flex items-center gap-1">
          <span
            class="shrink-0 w-[32px] h-5 rounded-sm bg-[#FAF5ED] text-[#4A5366] px-1 text-xs grid place-content-center"
          >
            起始
          </span>
          <span class="text-[white]">
            {{ focusedMeta.link.fromId }}
          </span>
        </div>
        <div class="bg-[#B6B3AF] p-1 rounded font-[HYWenHei-55S] flex items-center gap-1">
          <span
            class="shrink-0 w-[32px] h-5 rounded-sm bg-[#FAF5ED] text-[#4A5366] px-1 text-xs grid place-content-center"
          >
            终止
          </span>
          <span class="text-[white]">
            {{ focusedMeta.link.toId }}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <div
            class="link-button"
            :class="{ 'is-disabled': !isEnable || isEditing }"
            :title="isEditing ? '原始关联正在复合关联编辑中' : ''"
            @click="editLink"
          >
            <el-icon :size="20" color="#DEA93D" class="rounded-sm p-[3px] bg-[#313131]">
              <ElIcons.Edit />
            </el-icon>
            编辑
          </div>
          <div
            class="link-button"
            :class="{ 'is-disabled': !isEnable || isProcessing }"
            :title="isProcessing ? '不能在复合关联编辑中进行单独删除' : ''"
            @click="confirmDelete"
          >
            <el-icon :size="20" color="#CF5945" class="rounded-sm p-[3px] bg-[#313131]">
              <ElIcons.Delete />
            </el-icon>
            删除
          </div>
        </div>
      </div>
    </template>
  </MapAffix>
</template>

<style scoped>
.genshin-link-popover {
  --arrow-size: 16px;
  --card-bg-color: #d9d3c8;
  --card-radius: 8px;

  padding: 4px;
  width: 140px;
  position: relative;
  transform: translate(-50%, calc(-100% - var(--arrow-size)));
  border-radius: 8px;
  background-color: var(--card-bg-color);
  pointer-events: auto;
  filter: drop-shadow(0 0 4px #333333);
  color: #676d7a;
  display: flex;
  flex-direction: column;
  gap: 4px;

  /* 底部的指示三角形 */
  &::before {
    content: '';
    pointer-events: none;
    position: absolute;
    left: 50%;
    bottom: 0;
    transform-origin: 0 0;
    rotate: 45deg;
    translate: 0 calc(0.3 * var(--arrow-size) - 0.25px);
    width: var(--arrow-size);
    height: var(--arrow-size);
    background-color: var(--card-bg-color);
    filter: drop-shadow(0 0 4px #333333);
    clip-path: polygon(150% -50%, 150% 150%, -50% 150%);
  }
}

.link-button {
  font-size: 14px;
  padding: 4px 8px 4px 4px;
  background-color: #4a5366;
  color: #d9d3c8;
  border-radius: 6px;
  display: flex;
  gap: 4px;
  align-items: center;
  user-select: none;
  transition: all ease 100ms;
  &:not(.is-disabled) {
    cursor: pointer;
  }
  &:not(.is-disabled):hover {
    outline: 2px solid #ffe6b2;
    outline-offset: -1px;
  }
  &:not(.is-disabled):active {
    outline-color: #5b6272;
    background-color: #fff3d1;
    color: #4a5366;
  }
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
