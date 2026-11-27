<script setup lang="ts">
import type { MapConfigOverlay } from './model'
import { ArrowRight } from '@element-plus/icons-vue'
import { useId } from 'vue'

withDefaults(
  defineProps<{
    entries: MapConfigOverlay[]
    selectedId?: string
    depth?: number
  }>(),
  { depth: 0 },
)

const emit = defineEmits<{
  select: [id: string]
}>()

const kinds = ['分组', '图层', '分片']
const treeId = useId()
const formatBounds = (bounds: DTO.OverlayBounds) =>
  bounds.map(point => `[${point.join(', ')}]`).join(' → ')
</script>

<template>
  <ul class="overlay-tree" :class="{ nested: depth > 0 }">
    <li v-for="(entry, index) in entries" :key="entry.id">
      <button
        type="button"
        class="overlay-entry"
        :aria-label="entry.label"
        :aria-expanded="selectedId === entry.id"
        :aria-controls="`${treeId}-${index}`"
        @click="emit('select', entry.id)"
      >
        <ArrowRight class="chevron" aria-hidden="true" />
        <span>{{ entry.label }}</span>
        <small>{{ kinds[depth] }}</small>
      </button>
      <div :id="`${treeId}-${index}`" aria-live="polite">
        <dl v-if="selectedId === entry.id" class="overlay-detail">
          <dt>角色</dt>
          <dd>{{ entry.role === 'tile' ? '底图叠层' : '普通叠层' }}</dd>
          <dt>选择方式</dt>
          <dd>{{ entry.multiple ? '可同时启用多个图层' : '每次启用一个图层' }}</dd>
          <template v-if="entry.markerBounds">
            <dt>点位坐标边界</dt>
            <dd>
              <code>{{ formatBounds(entry.markerBounds) }}</code>
            </dd>
          </template>
          <template v-if="entry.mapBounds">
            <dt>地图坐标边界</dt>
            <dd>
              <code>{{ formatBounds(entry.mapBounds) }}</code>
            </dd>
          </template>
          <template v-else>
            <dt>{{ entry.markerBounds ? '地图坐标边界' : '坐标边界' }}</dt>
            <dd>
              {{
                entry.boundsMessage
                ?? (entry.markerBounds ? '无法换算地图边界。' : '没有有效的边界配置。')
              }}
            </dd>
          </template>
          <template v-if="entry.boundsSources?.length">
            <dt>边界来源</dt>
            <dd>
              <code v-for="source in entry.boundsSources" :key="source">{{ source }}</code>
            </dd>
          </template>
        </dl>
      </div>
      <MapConfigOverlayTree
        v-if="entry.children.length"
        :entries="entry.children"
        :selected-id="selectedId"
        :depth="depth + 1"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.overlay-tree {
  display: grid;
  gap: 4px;
  min-width: 0;
  list-style: none;

  li {
    min-width: 0;
  }

  &.nested {
    margin: 4px 0 4px 8px;
    padding-inline-start: 8px;
    border-inline-start: 1px solid var(--el-border-color);
  }
}

.overlay-entry {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-height: 36px;
  gap: 9px;
  padding: 7px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  text-align: start;
  overflow-wrap: anywhere;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &[aria-expanded='true'] {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);

    .chevron {
      transform: rotate(90deg);
    }
  }

  .chevron {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    margin-top: 4px;
    color: var(--el-text-color-secondary);
  }

  small {
    margin-inline-start: auto;
    color: var(--el-text-color-regular);
    font-size: 12px;
    white-space: nowrap;
  }
}

.overlay-detail {
  display: grid;
  grid-template-columns: fit-content(8rem) minmax(0, 1fr);
  gap: 5px 12px;
  margin: 4px 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  font-size: 12px;
  overflow-wrap: anywhere;

  dt {
    color: var(--el-text-color-regular);
  }

  dd {
    display: grid;
    gap: 2px;
  }
}
</style>
