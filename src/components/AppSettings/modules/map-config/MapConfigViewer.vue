<script setup lang="ts">
import type { MapConfigViewerModel } from './model'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useId } from 'vue'
import MapConfigCoordinates from './MapConfigCoordinates.vue'
import MapConfigFragment from './MapConfigFragment.vue'
import MapConfigOverlayTree from './MapConfigOverlayTree.vue'

const props = defineProps<{
  model: MapConfigViewerModel
  initialAreaCode?: string
}>()

const emit = defineEmits<{
  back: []
}>()

const sections = [
  { key: 'map', label: '底图与坐标' },
  { key: 'layers', label: '叠层与插件' },
  { key: 'raw', label: '配置原文' },
  { key: 'resources', label: '全局资源' },
] as const

const titleId = useId()
const sectionsName = useId()
const activeSection = ref<(typeof sections)[number]['key']>('map')
const selectedAreaCode = ref<string>()
const selectedOverlay = ref<string>()
const detailGeneration = ref(0)
const title = ref<HTMLElement>()
const content = ref<HTMLElement>()

const selectedArea = computed(() =>
  props.model.areas.find(area => area.code === selectedAreaCode.value),
)

watch(
  [() => props.model.areas, () => props.initialAreaCode],
  ([areas, initialAreaCode]) => {
    if (areas.some(area => area.code === selectedAreaCode.value)) return
    const initial = areas.find(area => area.code === initialAreaCode)
    selectedAreaCode.value = initial?.code ?? areas[0]?.code
  },
  { immediate: true },
)

watch([() => props.model.digest, () => props.model.hasBeta, selectedAreaCode], () => {
  selectedOverlay.value = undefined
  detailGeneration.value += 1
})

watch([activeSection, selectedAreaCode], () => {
  if (content.value) content.value.scrollTop = 0
})

onMounted(() => title.value?.focus())

const selectOverlay = (id: string) => {
  selectedOverlay.value = selectedOverlay.value === id ? undefined : id
}

const formatValue = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every(item => typeof item === 'number')) {
    return `[${value.join(', ')}]`
  }
  return JSON.stringify(value) ?? '未配置'
}
</script>

<template>
  <section class="map-config-viewer" :aria-labelledby="titleId">
    <header class="viewer-header">
      <div class="viewer-heading">
        <button type="button" class="viewer-back" @click="emit('back')">
          <ArrowLeft aria-hidden="true" />
          返回地图设置
        </button>
        <h2 :id="titleId" ref="title" tabindex="-1">system.json 配置查看器</h2>
      </div>

      <dl class="viewer-meta">
        <div>
          <dt>版本</dt>
          <dd>{{ model.version || '—' }}</dd>
        </div>
        <div>
          <dt>签名</dt>
          <dd>{{ model.digest || '—' }}</dd>
        </div>
      </dl>

      <div class="viewer-sections" role="radiogroup" aria-label="配置视图">
        <label v-for="section in sections" :key="section.key">
          <input v-model="activeSection" type="radio" :name="sectionsName" :value="section.key" />
          <span>{{ section.label }}</span>
        </label>
      </div>

      <label v-if="activeSection !== 'resources' && model.areas.length" class="viewer-area">
        <span>浏览地区</span>
        <select v-model="selectedAreaCode">
          <option v-for="area in model.areas" :key="area.code" :value="area.code">
            {{ area.name === area.code ? area.name : `${area.name} · ${area.code}` }}
          </option>
        </select>
      </label>
    </header>

    <div ref="content" class="viewer-scroll">
      <p v-if="model.loading" role="status" class="viewer-state">正在加载系统配置…</p>
      <div :key="detailGeneration" class="viewer-content">
        <template v-if="activeSection === 'resources'">
          <section v-for="group in model.resources" :key="group.key" class="viewer-section">
            <h3 class="resource-heading">
              {{ group.label }} <code>{{ group.key }}</code>
            </h3>
            <details
              v-for="category in group.categories"
              :key="category.key"
              class="resource-category"
            >
              <summary>
                <ArrowRight class="resource-chevron" aria-hidden="true" />
                <span>{{ category.label }}</span>
                <small>{{ category.entries.length }} 项</small>
              </summary>
              <div class="resource-entries">
                <MapConfigFragment
                  v-for="entry in category.entries"
                  :key="entry.path"
                  :fragment="entry"
                  :image="entry.image"
                />
                <p v-if="!category.entries.length" class="viewer-state">
                  {{ category.present ? '当前类别没有条目。' : '当前配置未提供此类别。' }}
                </p>
              </div>
            </details>
          </section>
        </template>

        <p v-else-if="!selectedArea" role="status" class="viewer-state">
          {{ model.areasLoading ? '正在加载地区数据…' : '暂无可见且已配置底图的地区。' }}
        </p>

        <template v-else-if="activeSection === 'map'">
          <section class="viewer-section">
            <h3>地图坐标示意</h3>
            <MapConfigCoordinates
              :bounds="selectedArea.bounds"
              :origin="selectedArea.origin"
              :viewport="selectedArea.viewport"
            />
          </section>

          <section class="viewer-section">
            <h3>生效值</h3>
            <dl class="viewer-fields">
              <div v-for="field in selectedArea.fields" :key="field.label" class="viewer-field">
                <dt>{{ field.label }}</dt>
                <dd>
                  <code class="field-value">{{ formatValue(field.value) }}</code>
                  <div v-if="field.sources.length" class="field-sources">
                    <span class="sr-only">字段来源</span>
                    <code v-for="source in field.sources" :key="source">{{ source }}</code>
                  </div>
                </dd>
              </div>
            </dl>
          </section>
        </template>

        <template v-else-if="activeSection === 'layers'">
          <section class="viewer-section">
            <h3>叠层分组</h3>
            <MapConfigOverlayTree
              v-if="selectedArea.overlays.length"
              :entries="selectedArea.overlays"
              :selected-id="selectedOverlay"
              @select="selectOverlay"
            />
            <p v-else class="viewer-state">
              {{
                selectedArea.overlayEnabled
                  ? '已启用叠层，当前配置没有分组。'
                  : '该地区未启用叠层。'
              }}
            </p>
          </section>
          <section class="viewer-section">
            <h3>点位扩展</h3>
            <MapConfigFragment
              v-for="plugin in selectedArea.plugins"
              :key="plugin.path"
              :fragment="plugin"
            />
            <p v-if="!selectedArea.plugins.length" class="viewer-state">该地区未启用点位扩展。</p>
          </section>
        </template>

        <template v-else>
          <MapConfigFragment
            v-for="fragment in selectedArea.fragments"
            :key="fragment.path"
            :fragment="fragment"
          />
          <p v-if="!selectedArea.fragments.length" class="viewer-state">该地区暂无配置原文。</p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.map-config-viewer {
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  font-size: 14px;

  :deep(:focus-visible) {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
  }
}

.viewer-header {
  display: grid;
  flex: none;
  gap: 9px;
  padding: 0 12px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.viewer-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;

  h2 {
    color: var(--el-text-color-primary);
    font-size: 18px;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
}

.viewer-back {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-radius: 5px;
  color: var(--el-text-color-regular);
  font-size: 12px;

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }

  svg {
    width: 13px;
    height: 13px;
  }
}

.viewer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  font-size: 12px;

  > div {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: 6px;
  }

  dt {
    flex: none;
    color: var(--el-text-color-regular);
  }

  dd {
    font-family: var(--el-font-family-monospace, monospace);
    overflow-wrap: anywhere;
  }
}

.viewer-sections {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  width: fit-content;
  padding: 3px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 7px;
  background: var(--el-fill-color-light);
  font-size: 13px;

  label {
    position: relative;
    cursor: pointer;
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
  }

  span {
    display: block;
    padding: 5px 9px;
    border-radius: 4px;
    color: var(--el-text-color-regular);
  }

  label:hover span,
  input:checked + span {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }

  input:checked + span {
    box-shadow: inset 0 0 0 1px var(--el-border-color-lighter);
    font-weight: 650;
  }

  input:focus-visible + span {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -2px;
  }
}

.viewer-area {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--el-text-color-regular);
  font-size: 13px;

  span {
    flex: none;
  }

  select {
    width: min(100%, 22rem);
    min-width: 0;
    min-height: 32px;
    padding: 3px 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 5px;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }
}

.viewer-scroll {
  min-height: 0;
  flex: 1;
  padding: 12px;
  overflow: auto;

  > .viewer-state {
    margin-bottom: 10px;
  }
}

.viewer-content {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.viewer-section {
  display: grid;
  min-width: 0;
  gap: 6px;
  padding-bottom: 8px;

  h3 {
    font-weight: 650;
  }
}

.viewer-state {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.viewer-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  gap: 1px;
  overflow: hidden;
  background-color: var(--el-border-color-lighter);
}

.viewer-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
  align-content: start;
  gap: 8px;
  padding: 8px 10px;
  background: var(--el-bg-color);
  font-size: 12px;
  overflow-wrap: anywhere;

  dt {
    color: var(--el-text-color-regular);
  }

  dd {
    display: grid;
    min-width: 0;
    gap: 3px;
  }

  .field-value {
    white-space: pre-wrap;
  }

  .field-sources {
    display: grid;
    color: var(--el-text-color-regular);
  }
}

.resource-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5px;

  code {
    color: var(--el-text-color-regular);
    font-size: 12px;
    font-weight: 400;
  }
}

.resource-category {
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;

  > summary {
    display: flex;
    min-height: 36px;
    align-items: center;
    gap: 9px;
    padding: 7px 10px;
    border-radius: 5px;
    list-style: none;
    cursor: pointer;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &::-webkit-details-marker {
      display: none;
    }

    small {
      margin-inline-start: auto;
      color: var(--el-text-color-regular);
      font-size: 12px;
      white-space: nowrap;
    }
  }

  &[open] > summary .resource-chevron {
    transform: rotate(90deg);
  }

  .resource-chevron {
    width: 12px;
    height: 12px;
    color: var(--el-text-color-secondary);
  }
}

.resource-entries {
  display: grid;
  gap: 5px;
  padding: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
