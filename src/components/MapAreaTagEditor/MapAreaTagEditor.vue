<script setup lang="ts">
import type { AreaTagLevel, AreaTagTuple } from '@/configs/areaTags'
import type { GenshinMap } from '@/packages/map'
import { areaTags, groupAreaTags } from '@/configs/areaTags'
import { useTagLayer } from '@/hooks/useMapLayers/useTagLayer'
import { isAreaTagVisible } from '@/packages/map'
import { MapSubject, mapViewStateKey, TempLayerIndex } from '@/shared'
import { useAreaStore, useMapStateStore, usePreferenceStore, useTileStore } from '@/stores'

const props = defineProps<{
  origin: DTO.Coordinate2D
  deck: GenshinMap
  getMapCoordinate: (screenPoint: DTO.Coordinate2D) => DTO.Coordinate2D | undefined
  modalOpen: boolean
}>()
const emit = defineEmits<{ close: [] }>()

type Selection = {
  code: string
  index: number
  tags: AreaTagTuple[]
}

type Draft = {
  code: string
  text: string
  x: number | ''
  y: number | ''
  level: AreaTagLevel
}

const layerId = 'map-area-tag-editor'
const layerIndex = TempLayerIndex.AfterMarker
const tileStore = useTileStore()
const areaStore = useAreaStore()
const preferenceStore = usePreferenceStore()
const { tempLayer } = useMapStateStore()
const viewState = inject(mapViewStateKey)
const title = useTemplateRef<HTMLElement>('title')
const canvas = props.deck.getCanvas()

const areas = computed(() =>
  [...tileStore.visibleArea.codes].map(code => ({
    code,
    name: areaStore.areaCodeMap.get(code)?.name || code,
    tags: areaTags.value[code] ?? [],
  })),
)
const selection = shallowRef<Selection>()
const draft = ref<Draft>()
const saving = ref(false)
const confirmingDelete = ref(false)
const status = ref('')
const busy = computed(() => saving.value || confirmingDelete.value)

const tagKey = (code: string, index: number) => `${code}/${index}`
const selectedKey = computed(() =>
  selection.value ? tagKey(selection.value.code, selection.value.index) : '',
)
const originalTag = computed(() => selection.value?.tags[selection.value.index])
const dirty = computed(() => {
  if (!draft.value) return false
  const { text, x, y, level } = draft.value
  const tag = originalTag.value
  return !tag || text !== tag[0] || x !== tag[1][0] || y !== tag[1][1] || level !== (tag[2] ?? 0)
})
const draftTag = computed<AreaTagTuple | undefined>(() => {
  if (!draft.value) return
  const { text, x, y, level } = draft.value
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y))
    return
  const name = text.trim() || '新地区标签'
  return level === 0 ? [name, [x, y]] : [name, [x, y], level]
})
const canSave = computed(() => Boolean(dirty.value && draftTag.value && draft.value?.text.trim()))
const hiddenAfterSave = computed(() => {
  if (!draft.value || !viewState) return false
  return !preferenceStore.showZoneTag || !isAreaTagVisible(draft.value.level, viewState.value.zoom)
})

const tagGroups = computed(() => {
  const selected = selection.value
  return groupAreaTags(
    areas.value.flatMap(({ code, tags }) => {
      if (code !== selected?.code || JSON.stringify(tags) !== JSON.stringify(selected.tags))
        return tags
      return tags.filter((_, index) => index !== selected.index)
    }),
  )
})
const { tagLayer } = useTagLayer(() => ({
  id: layerId,
  visible: true,
  tagGroups: tagGroups.value,
  editor: { draft: draftTag.value },
}))
watchEffect(() => {
  if (tagLayer.value) tempLayer.set(layerIndex, tagLayer.value)
})

const canChangeSelection = () => {
  if (busy.value) return false
  if (!dirty.value) return true
  status.value = '请先保存或取消当前编辑'
  return false
}

const beginNew = (point: DTO.Coordinate2D) => {
  if (!canChangeSelection()) return
  const code = preferenceStore.areaCode
  if (!tileStore.visibleArea.codes.has(code)) return
  const [x, y] = tileStore.toMarkerCoordinate(point)
  selection.value = undefined
  draft.value = { code, text: '', x: Math.round(x), y: Math.round(y), level: 0 }
  status.value = ''
}
watch(() => props.origin, beginNew)
onMounted(() => title.value?.focus({ preventScroll: true }))

const selectTag = (code: string, index: number) => {
  if (selectedKey.value === tagKey(code, index)) return true
  if (!canChangeSelection()) return false
  const tags = areaTags.value[code]
  const tag = tags?.[index]
  if (!tag) return false
  const [text, [x, y], level = 0] = tag
  selection.value = { code, index, tags }
  draft.value = { code, text, x, y, level }
  status.value = ''
  return true
}

const locate = () => {
  if (!draftTag.value) return
  MapSubject.viewState.next({
    target: tileStore.toMapCoordinate(draftTag.value[1]),
    transitionDuration: 0,
  })
}

const selectFromList = (event: Event) => {
  const input = event.currentTarget as HTMLSelectElement
  const [code, index] = input.value.split('/')
  if (selectTag(code, Number(index))) locate()
  else input.value = selectedKey.value
}

const cancelDraft = () => {
  draft.value = undefined
  selection.value = undefined
  confirmingDelete.value = false
  status.value = ''
}

const close = () => {
  if (!canChangeSelection()) return
  emit('close')
  canvas?.focus({ preventScroll: true })
}

const save = async (remove = false) => {
  const endpoint = import.meta.env.AREA_TAG_EDITOR
  const selected = selection.value
  const code = draft.value?.code
  const tag = draftTag.value
  if (!endpoint || !code || saving.value || !tileStore.visibleArea.codes.has(code)) return
  if (remove ? !selected : !canSave.value || !tag) return
  const before = selected?.tags ?? areaTags.value[code] ?? []
  const tags = [...before]
  if (remove && selected) tags.splice(selected.index, 1)
  else if (tag && selected) tags[selected.index] = tag
  else if (tag) tags.push(tag)

  saving.value = true
  status.value = ''
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaCode: code, before, tags }),
    })
    if (!response.ok) throw new Error(await response.text())
    if (JSON.stringify(areaTags.value[code] ?? []) === JSON.stringify(before)) {
      areaTags.value = { ...areaTags.value, [code]: tags }
    }
    cancelDraft()
    status.value = remove ? '已删除并写入标签配置' : '已保存到标签配置'
  } catch (error) {
    status.value =
      error instanceof Error && !(error instanceof TypeError) && error.message
        ? error.message
        : '标签配置提交失败，请重试'
  } finally {
    saving.value = false
  }
}

let drag:
  | {
      id: number
      start: DTO.Coordinate2D
      offset: DTO.Coordinate2D
      position: DTO.Coordinate2D
      moved: boolean
    }
  | undefined

const canvasPoint = (event: PointerEvent): DTO.Coordinate2D => {
  const bounds = canvas!.getBoundingClientRect()
  return [event.clientX - bounds.left, event.clientY - bounds.top]
}

const startDrag = (event: PointerEvent) => {
  if (!canvas || drag || event.button !== 0 || !event.isPrimary || props.modalOpen || busy.value)
    return
  const viewport = props.deck.getViewports()[0]
  if (!viewport) return
  const start = canvasPoint(event)
  const [x, y] = start
  const picked = props.deck.pickObject({ x, y, layerIds: [layerId] })
  if (!picked?.object) return

  // 在 deck.gl 识别平移手势前接管标签区域内的按压。
  event.preventDefault()
  event.stopImmediatePropagation()
  const isDraft =
    picked.object === draftTag.value || picked.sourceLayer?.id.startsWith(`${layerId}-draft`)
  if (!isDraft) {
    const entry = areas.value.find(({ tags }) => tags.includes(picked.object))
    if (!entry || !selectTag(entry.code, entry.tags.indexOf(picked.object))) return
  }
  const position = draftTag.value?.[1]
  if (!position) return
  const [cx, cy] = viewport.project(tileStore.toMapCoordinate(position))
  canvas.setPointerCapture(event.pointerId)
  drag = {
    id: event.pointerId,
    start,
    offset: [cx + viewport.x - x, cy + viewport.y - y],
    position,
    moved: false,
  }
}

const moveDrag = (event: PointerEvent) => {
  if (drag?.id !== event.pointerId || !draft.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
  const [x, y] = canvasPoint(event)
  if (!drag.moved && Math.hypot(x - drag.start[0], y - drag.start[1]) < 2) return
  const point = props.getMapCoordinate([x + drag.offset[0], y + drag.offset[1]])
  if (!point) return
  const [tagX, tagY] = tileStore.toMarkerCoordinate(point)
  draft.value.x = Math.round(tagX * 100) / 100
  draft.value.y = Math.round(tagY * 100) / 100
  drag.moved = true
}

const releaseDrag = (restore: boolean) => {
  if (!drag) return
  const { id, position, moved } = drag
  drag = undefined
  if (restore && moved && draft.value) [draft.value.x, draft.value.y] = position
  if (canvas?.hasPointerCapture(id)) canvas.releasePointerCapture(id)
}

const endDrag = (event: PointerEvent) => {
  if (drag?.id !== event.pointerId) return
  event.stopImmediatePropagation()
  if (event.type === 'pointerup') moveDrag(event)
  releaseDrag(event.type !== 'pointerup')
}

useEventListener(canvas, 'pointerdown', startDrag, { capture: true })
useEventListener(canvas, 'pointermove', moveDrag, { capture: true })
useEventListener(canvas, ['pointerup', 'pointercancel', 'lostpointercapture'], endDrag, {
  capture: true,
})

useEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented || props.modalOpen || saving.value) return
  event.preventDefault()
  if (drag) releaseDrag(true)
  else if (confirmingDelete.value) confirmingDelete.value = false
  else if (draft.value) cancelDraft()
  else close()
})

onBeforeUnmount(() => {
  releaseDrag(false)
  tempLayer.remove(layerIndex, layerId)
})
</script>

<template>
  <section class="area-tag-editor" aria-labelledby="area-tag-editor-title" @contextmenu.prevent>
    <header class="editor-header">
      <h2 id="area-tag-editor-title" ref="title" tabindex="-1">地区标签编辑</h2>
      <el-button text size="small" :disabled="busy" @click="close">退出</el-button>
    </header>

    <div class="tag-toolbar">
      <select
        aria-label="选择已有地区标签"
        :value="selectedKey"
        :disabled="busy || dirty"
        @change="selectFromList"
      >
        <option value="" disabled>选择已有标签</option>
        <optgroup v-for="area of areas" :key="area.code" :label="area.name">
          <option v-for="(tag, index) of area.tags" :key="index" :value="tagKey(area.code, index)">
            {{ tag[0] }}
          </option>
        </optgroup>
      </select>
      <el-button size="small" :disabled="busy || dirty" @click="beginNew(origin)"
        >新增标签</el-button
      >
    </div>

    <p v-if="!draft" class="editor-hint">点击地图文字开始编辑，或右键指定新增位置。</p>

    <form v-else class="tag-form" @submit.prevent="save()">
      <fieldset :disabled="busy">
        <label>
          标签文字
          <input v-model="draft.text" maxlength="80" />
        </label>
        <div class="tag-fields">
          <label>
            所属地区
            <select v-model="draft.code" :disabled="Boolean(selection)">
              <option v-for="area of areas" :key="area.code" :value="area.code">
                {{ area.name }}
              </option>
            </select>
          </label>
          <label>
            级别
            <select v-model.number="draft.level">
              <option :value="0">区级</option>
              <option :value="1">块级</option>
              <option :value="2">国级</option>
            </select>
          </label>
        </div>
        <div class="tag-fields">
          <label>
            中心 X
            <input v-model.number="draft.x" type="number" step="any" />
          </label>
          <label>
            中心 Y
            <input v-model.number="draft.y" type="number" step="any" />
          </label>
        </div>
      </fieldset>
      <p class="editor-hint">拖动地图上的文字即可预览。圆环标示文字包围盒的中心。</p>
      <p v-if="hiddenAfterSave" class="editor-hint">按当前缩放和设置，保存后此标签将隐藏。</p>
      <div v-if="confirmingDelete" class="tag-actions">
        <span class="delete-prompt">删除「{{ originalTag?.[0] }}」？</span>
        <el-button size="small" :disabled="saving" @click="confirmingDelete = false"
          >取消</el-button
        >
        <el-button size="small" type="danger" :loading="saving" @click="save(true)">
          确认删除
        </el-button>
      </div>
      <div v-else class="tag-actions">
        <el-button
          v-if="selection"
          size="small"
          type="danger"
          plain
          :disabled="saving"
          @click="confirmingDelete = true"
        >
          删除
        </el-button>
        <el-button size="small" :disabled="!draftTag || saving" @click="locate">定位</el-button>
        <el-button size="small" :disabled="saving" @click="cancelDraft">取消</el-button>
        <el-button
          size="small"
          type="primary"
          native-type="submit"
          :disabled="!canSave"
          :loading="saving"
        >
          保存
        </el-button>
      </div>
    </form>

    <p v-if="status" class="editor-status" role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
.area-tag-editor {
  position: absolute;
  z-index: 9;
  top: max(16px, env(safe-area-inset-top, 0px));
  right: calc(56px + env(safe-area-inset-right, 0px));
  width: min(320px, calc(100% - 72px - env(safe-area-inset-right, 0px)));
  max-height: calc(100% - 32px);
  padding: 12px;
  overflow: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
  color: var(--el-text-color-primary);
  font-size: 13px;
  pointer-events: auto;
}

.editor-header,
.tag-toolbar,
.tag-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.editor-header h2 {
  margin: 0;
  font-size: 15px;
}

.tag-toolbar,
.tag-form {
  margin-top: 8px;
}

fieldset,
label {
  display: grid;
  min-width: 0;
  gap: 5px;
}

fieldset {
  gap: 8px;
  padding: 0;
  border: 0;
}

.tag-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

input,
select {
  min-width: 0;
  width: 100%;
  height: 30px;
  padding: 0 7px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
  color: inherit;
  font: inherit;
}

input:disabled,
select:disabled {
  color: var(--el-text-color-disabled);
}

.tag-actions {
  justify-content: flex-end;
  margin-top: 8px;
}

.tag-actions .el-button {
  margin-left: 0;
}

.tag-actions .el-button--danger:first-child {
  margin-right: auto;
}

.editor-hint,
.editor-status {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
}

.delete-prompt {
  margin-right: auto;
  overflow-wrap: anywhere;
  color: var(--el-color-danger);
}

@media (width <= 640px) {
  .area-tag-editor {
    top: auto;
    bottom: max(56px, env(safe-area-inset-bottom, 0px));
    max-height: min(48dvh, calc(100% - 72px));
  }
}
</style>
