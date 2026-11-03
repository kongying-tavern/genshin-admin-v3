<script setup lang="ts">
import type { ModifyLinkOptions } from './MarkerLink'
import type { GSMarkerInfo, MarkerLinkMission } from '@/packages/map'
import { useSubscription } from '@vueuse/rxjs'
import { ElMessage } from 'element-plus'
import { animate } from 'popmotion'
import { filter, finalize, map, race, repeat, switchMap, takeUntil, tap } from 'rxjs'
import { AppWindowTeleporter } from '@/components'
import { GSLinkLayer, GSMarkerLayer } from '@/packages/map'
import {
  LINK_CONFIG_MAP,
  LinkActionEnum,
  mapContainerKey,
  MapSubject,
  TempLayerIndex,
} from '@/shared'
import { useMapStateStore, useMarkerLinkStore, useMarkerStore } from '@/stores'
import { useLinkOperate } from '../hooks'
import BarItem from './BarItem.vue'
import {
  IconMarkerLink,
  LinkIndicator,
  LinkWindow,
  MarkerIndicatorLayer,
  useLinkCreate,
  useLinkWindow,
} from './MarkerLink'

const mapStateStore = useMapStateStore()
const markerStore = useMarkerStore()
const markerLinkStore = useMarkerLinkStore()

const containerRef = inject(mapContainerKey, ref())

// ==================== 任务管理 ====================

const {
  start$,
  end$,
  isEnable,
  isProcessing,
  clear: clearMission,
  update,
  data: linkMission,
} = mapStateStore.subscribeMission('markerLink', () => [])

const { loading, refresh: submit, onSuccess } = useLinkCreate()

const { info, close$, close, open } = useLinkWindow({ loading })
onSuccess(() => close())

const { modifyLinks, deleteLink, extractLink, revestLink } = useLinkOperate()

useSubscription(
  start$.subscribe(() => {
    open()
    mapStateStore.interaction.clearFocus()
    mapStateStore.interaction.setIsPopoverOnHover(true)
    mapStateStore.interaction.pauseFocus(GSMarkerLayer.layerName)
  }),
)

useSubscription(
  end$.subscribe(() => {
    // 注意：此处不再调用 close()，避免与 close$ 形成循环调用
    // 窗口关闭由用户操作触发（关闭按钮 / 取消 / 提交成功）
    // close$ 订阅中会负责清除任务
    mapStateStore.interaction.resumeFocus(GSMarkerLayer.layerName)
    mapStateStore.interaction.setIsPopoverOnHover(false)
    modifyLinks.value.clear()
    triggerRef(modifyLinks)
  }),
)

useSubscription(
  close$.subscribe(() => {
    // 窗口关闭时统一清除任务，避免 end$ → close() → close$ → clearMission() 的循环竞态
    if (isProcessing.value) clearMission()
  }),
)

// ==================== 表单状态 ====================

/** 关联类型 */
const linkAction = ref(LinkActionEnum.TRIGGER)

/** 关联设置 */
const config = ref({
  /** 是否合并原关联组（如果有） */
  merge: true,
  /** 是否显示删除项 */
  showDelete: true,
})

// ==================== 内部状态 ====================

/** 关联类型对应的颜色 */
const actionColor = computed(() => {
  const config = LINK_CONFIG_MAP.get(linkAction.value)
  return config?.lineColor ?? ([0, 0, 0] as [number, number, number])
})

/** 点位指示器所在的坐标 */
const linkIndicatorPosition = ref<{ x: number; y: number }>()

/** 起始点 */
const prevMarker = shallowRef<GSMarkerInfo>()

/** 终止点 */
const nextMarker = shallowRef<GSMarkerInfo>()

/** hover 点 */
const hoverMarker = shallowRef<GSMarkerInfo>()

/** 用于结束关联连线的相关动画 */
const stopAnimation = ref<() => void>()

const hoverLinkKey = computed({
  get: () => {
    const set = mapStateStore.interaction.hoverElements.get(GSLinkLayer.layerName) as
      | Set<string>
      | undefined
    if (!set?.size || set.size > 1) return ''
    return `${[...set][0]}`
  },
  set: linkKey => {
    if (!linkKey) {
      mapStateStore.interaction.removeHover(GSLinkLayer.layerName)
      return
    }
    mapStateStore.interaction.setHover(GSLinkLayer.layerName, new Set([linkKey]))
  },
})

const focusLinkKey = computed({
  get: () => {
    const set = mapStateStore.interaction.focusElements.get(GSLinkLayer.layerName) as
      | Set<string>
      | undefined
    if (!set?.size || set.size > 1) return ''
    return `${[...set][0]}`
  },
  set: linkKey => {
    if (!linkKey) {
      mapStateStore.interaction.removeFocus(GSLinkLayer.layerName)
      return
    }
    mapStateStore.interaction.setFocus(GSLinkLayer.layerName, new Set([linkKey]))
  },
})

/**
 * 受影响关联组（已在编辑数据中）
 * @note 根据 正在编辑的关联项 计算
 */
const containLinkGroups = computed(() => {
  const groupIds = new Set<string>()

  modifyLinks.value.forEach(({ raw }) => {
    const fromMarker = markerStore.idMap.get(raw.fromId!)
    fromMarker?.linkageId && groupIds.add(fromMarker.linkageId)
    const toMarker = markerStore.idMap.get(raw.toId!)
    toMarker?.linkageId && groupIds.add(toMarker.linkageId)
  })

  const groups = new Map<string, Map<string, ModifyLinkOptions>>()

  groupIds.forEach(groupId => {
    const links = markerLinkStore.groupIdMap.get(groupId)
    if (!links?.length) return
    groups.set(
      groupId,
      links.reduce((map, link) => {
        const { id, fromId, toId, linkAction } = link
        const isReverse = fromId! > toId!
        return map.set(
          isReverse ? `${toId}-${fromId}-${linkAction}` : `${fromId}-${toId}-${linkAction}`,
          { isDelete: false, isMerge: true, isReverse, raw: link, id: `${id}` },
        )
      }, new Map<string, ModifyLinkOptions>()),
    )
  })

  return groups
})

/**
 * 受影响关联组（临时）
 * @note 根据当前选中点位计算
 */
const tempContainLinkGroups = computed(() => {
  const groups = new Map<string, Map<string, ModifyLinkOptions>>()
  void [prevMarker.value?.linkageId, nextMarker.value?.linkageId].forEach(groupId => {
    if (!groupId || containLinkGroups.value.has(groupId)) return
    const links = markerLinkStore.groupIdMap.get(groupId)
    if (!links?.length) return
    groups.set(
      groupId,
      links.reduce((map, link) => {
        const { id, fromId, toId, linkAction } = link
        const isReverse = fromId! > toId!
        return map.set(
          isReverse ? `${toId}-${fromId}-${linkAction}` : `${fromId}-${toId}-${linkAction}`,
          { isDelete: false, isMerge: true, isReverse, raw: link, id: `${id}` },
        )
      }, new Map<string, ModifyLinkOptions>()),
    )
  })
  return groups
})

/**
 * 预处理关联项
 * @note 提交之前的结果预览
 */
const previewLinkGroups = computed(() => {
  const result = new Map<string, ModifyLinkOptions>()
  const { merge, showDelete } = config.value
  modifyLinks.value.forEach((link, key) => {
    if (link.isDelete && !showDelete) return
    result.set(key, link)
  })
  if (merge) {
    containLinkGroups.value.forEach(group => {
      group.forEach((link, key) => {
        if (link.isDelete && !showDelete) return
        const isModifying = modifyLinks.value.get(key)
        if (isModifying && isModifying.isReverse === link.isReverse) return
        result.set(key, link)
      })
    })
  }
  return result
})

// ==================== 逻辑处理 ====================

/** 清除选择状态 */
const clearSelect = () => {
  mapStateStore.tempLayer.remove(TempLayerIndex.BeforeMarker)
  stopAnimation.value?.()
  mapStateStore.interaction.removeFocus(GSMarkerLayer.layerName)
  mapStateStore.setTempMarkers('markerLink', [])
  nextMarker.value = undefined
  prevMarker.value = undefined
}

/** 进行一次点位 focus 设置 */
const resumeOnceFocus = (data: number[]) => {
  mapStateStore.interaction.resumeFocus(GSMarkerLayer.layerName)
  mapStateStore.interaction.setFocus(GSMarkerLayer.layerName, new Set(data))
  mapStateStore.interaction.pauseFocus(GSMarkerLayer.layerName)
}

/** 切换任务状态 */
const toggleMission = () => {
  if (!isEnable.value) return
  if (isProcessing.value) {
    clearMission()
    close()
    return
  }
  update([])
}

/** 提交表单 */
const submitLink = () => {
  submit(linkMission.value, modifyLinks.value)
}

/** 自动更新任务 */
watch(
  previewLinkGroups,
  groups => {
    mapStateStore.interaction.removeFocus(GSLinkLayer.layerName)
    if (!isProcessing.value) return
    const result: MarkerLinkMission[] = []
    groups.forEach(({ isDelete, raw, id: key }) => {
      if (isDelete) return
      result.push({
        groupId: raw.groupId,
        meta: {
          key: raw.id ? `${raw.id}` : key,
        },
        toId: raw.toId,
        fromId: raw.fromId,
        linkAction: raw.linkAction,
      })
    })
    update(result)
  },
  { deep: true },
)

/** 悬浮指示器更新 */
useSubscription(
  start$
    .pipe(
      switchMap(() =>
        MapSubject.hover.pipe(
          tap(({ info }) => {
            linkIndicatorPosition.value = info.coordinate ? { x: info.x, y: info.y } : undefined
          }),
          takeUntil(race(end$, MapSubject.drag)),
          finalize(() => {
            linkIndicatorPosition.value = undefined
          }),
          repeat(),
        ),
      ),
    )
    .subscribe(),
)

/** hover 逻辑 */
useSubscription(
  start$
    .pipe(
      switchMap(() => {
        return MapSubject.hover.pipe(
          map(({ info }) => {
            if (!info.layer || !GSMarkerLayer.isInstance(info.layer) || !info.object) {
              return undefined
            }
            return info.object as GSMarkerInfo
          }),

          tap(markerInfo => {
            const prev = prevMarker.value
            if (prev && nextMarker.value) return
            if (!markerInfo) {
              hoverMarker.value = undefined
              stopAnimation.value?.()
              return
            }
            if (markerInfo.id === hoverMarker.value?.id) return
            hoverMarker.value = markerInfo
            if (!prev || prev.id === markerInfo.id || nextMarker.value !== undefined) {
              stopAnimation.value?.()
              return
            }
            const id = `temp-${crypto.randomUUID()}`
            stopAnimation.value?.()
            stopAnimation.value = animate<number>({
              from: 0,
              to: Math.PI,
              duration: 1000,
              repeat: Number.POSITIVE_INFINITY,
              onUpdate: v => {
                mapStateStore.tempLayer.set(
                  TempLayerIndex.BeforeMarker,
                  new GSLinkLayer({
                    id: 'indicator',
                    hoverIds: mapStateStore.interaction.hoverElements.get(GSLinkLayer.layerName) as
                      | Set<string>
                      | undefined,
                    outlineColor: [255, 255, 255, 255 - 255 * Math.sin(v)],
                    data: [
                      {
                        id,
                        from: prev.render.position,
                        to: markerInfo.render.position,
                        color: actionColor.value,
                      },
                    ],
                  }),
                )
              },
              onStop: () => {
                mapStateStore.tempLayer.remove(TempLayerIndex.BeforeMarker)
                stopAnimation.value = undefined
              },
            }).stop
          }),

          takeUntil(end$),

          finalize(() => {
            stopAnimation.value?.()
            mapStateStore.tempLayer.remove(TempLayerIndex.BeforeMarker)
          }),
        )
      }),
    )
    .subscribe(),
)

/**
 * click 逻辑
 * 1. 选择源点
 * 2. 选择目标点
 * 3. 再次选择目标点以确认
 */
useSubscription(
  start$
    .pipe(
      switchMap(() => {
        return MapSubject.click.pipe(
          filter(({ event }) => Boolean(event.leftButton)),

          map(({ info }) => {
            // 如果点击信息为空，取消
            if (
              !info.layer
              || !GSMarkerLayer.isInstance(info.layer)
              || !info.object
              || prevMarker.value?.id === (info.object as GSMarkerInfo).id
            ) {
              clearSelect()
            }

            // 选择起始点
            else if (!prevMarker.value) {
              const markerInfo = info.object as GSMarkerInfo
              resumeOnceFocus([markerInfo.id!])
              mapStateStore.tempLayer.set(
                TempLayerIndex.BeforeMarker,
                new MarkerIndicatorLayer({
                  id: 'marker-indicater',
                  data: [markerInfo],
                }),
              )
              mapStateStore.setTempMarkers('markerLink', [markerInfo])
              prevMarker.value = markerInfo
            }

            // 选择终止点
            else if (!nextMarker.value) {
              const markerInfo = info.object as GSMarkerInfo
              resumeOnceFocus([prevMarker.value.id!, markerInfo.id!])
              mapStateStore.tempLayer.set(
                TempLayerIndex.BeforeMarker,
                new MarkerIndicatorLayer({
                  id: 'marker-indicater',
                  data: [prevMarker.value, markerInfo],
                }),
              )
              mapStateStore.tempLayer.set(
                TempLayerIndex.BeforeMarker,
                new GSLinkLayer({
                  id: 'indicator',
                  data: [
                    {
                      id: `temp-${crypto.randomUUID()}`,
                      from: prevMarker.value.render.position,
                      to: markerInfo.render.position,
                      color: actionColor.value,
                    },
                  ],
                }),
              )
              mapStateStore.setTempMarkers('markerLink', [prevMarker.value, markerInfo])
              nextMarker.value = markerInfo
            }

            // 如果确认点击不为终止点，取消
            else if (nextMarker.value?.id !== (info.object as GSMarkerInfo).id) {
              clearSelect()
            }

            // 如果确认点击为终止点，发送结果
            else {
              return { prev: prevMarker.value!, next: nextMarker.value!, action: linkAction.value }
            }
          }),

          filter(result => result !== undefined),

          takeUntil(end$),

          finalize(() => {
            clearSelect()
          }),
        )
      }),
    )
    .subscribe(({ prev, next, action }) => {
      if (!prev.id || !next.id) return ElMessage.error('所选点位 id 字段为空')

      const isReverse = prev.id > next.id
      const linkKey = isReverse
        ? `${next.id}-${prev.id}-${action}`
        : `${prev.id}-${next.id}-${action}`

      modifyLinks.value.set(linkKey, {
        id: `temp-${crypto.randomUUID()}`,
        isReverse,
        isDelete: false,
        isMerge: false,
        isTemp: true,
        raw: {
          fromId: prev.id,
          toId: next.id,
          linkAction: action,
        },
      })
      triggerRef(modifyLinks)

      clearSelect()
    }),
)

onBeforeUnmount(() => {
  if (isProcessing.value) {
    clearMission()
    close()
  }
})
</script>

<template>
  <BarItem
    label="点位关联"
    class="grid place-content-center place-items-center"
    divider
    :disabled="!isEnable"
    @click="toggleMission"
  >
    <ElIcon :size="20" :color="isProcessing ? '#00FF00' : 'currentColor'">
      <IconMarkerLink />
    </ElIcon>

    <Teleport v-if="isProcessing && containerRef && linkIndicatorPosition" :to="containerRef">
      <LinkIndicator
        :position="linkIndicatorPosition"
        :link-action="linkAction"
        :next-marker="nextMarker"
        :prev-marker="prevMarker"
      />
    </Teleport>

    <AppWindowTeleporter :info="info">
      <LinkWindow
        v-model:hover-link-key="hoverLinkKey"
        v-model:focus-link-key="focusLinkKey"
        v-model:link-action="linkAction"
        v-model:merge="config.merge"
        v-model:show-delete="config.showDelete"
        :loading
        :next-marker
        :prev-marker
        :contain-link-groups
        :temp-contain-link-groups
        :preview-link-groups
        @delete="deleteLink"
        @extract="extractLink"
        @revest="revestLink"
        @cancel="close"
        @submit="submitLink"
      />
    </AppWindowTeleporter>
  </BarItem>
</template>
