<script setup lang="ts">
import type { MapConfigFragment } from './model'
import { ArrowRight } from '@element-plus/icons-vue'

const props = defineProps<{
  fragment: MapConfigFragment
  image?: string
}>()

const open = ref(false)
const failedImage = ref(false)
const json = computed(() => JSON.stringify(props.fragment.value, null, 2))

const updateOpen = (event: Event) => {
  if (event.currentTarget instanceof HTMLDetailsElement) open.value = event.currentTarget.open
}

watch(
  () => props.image,
  () => (failedImage.value = false),
)
</script>

<template>
  <details class="config-fragment" @toggle="updateOpen">
    <summary>
      <ArrowRight class="chevron" aria-hidden="true" />
      <span class="fragment-label">
        <strong>{{ fragment.label }}</strong>
        <code>{{ fragment.path }}</code>
      </span>
    </summary>
    <div v-if="open" class="fragment-body">
      <img
        v-if="image && !failedImage"
        :src="image"
        :alt="`${fragment.label}预览`"
        loading="lazy"
        @error="failedImage = true"
      />
      <p v-if="image && failedImage" class="fragment-note">图片加载失败，仍可查看配置字段。</p>
      <div v-if="fragment.sources?.length" class="fragment-sources">
        <span>配置来源</span>
        <code v-for="source in fragment.sources" :key="source">{{ source }}</code>
      </div>
      <pre v-if="json !== undefined">{{ json }}</pre>
      <p v-else class="fragment-note">未配置详细字段。</p>
    </div>
  </details>
</template>

<style scoped>
.config-fragment {
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;

  > summary {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 8px 10px;
    border-radius: 5px;
    list-style: none;
    cursor: pointer;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &::-webkit-details-marker {
      display: none;
    }

    .fragment-label {
      display: grid;
      min-width: 0;
      gap: 2px;
    }
  }

  .chevron {
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    margin-top: 4px;
    color: var(--el-text-color-secondary);
  }

  &[open] > summary .chevron {
    transform: rotate(90deg);
  }

  code,
  pre {
    overflow-wrap: anywhere;
  }

  code {
    color: var(--el-text-color-regular);
    font-size: 12px;
  }
}

.fragment-body {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--el-border-color-lighter);

  pre {
    padding: 10px;
    border-radius: 4px;
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  img {
    display: block;
    max-width: 100%;
    max-height: 112px;
    border-radius: 4px;
    object-fit: contain;
  }
}

.fragment-sources {
  display: grid;
  gap: 2px;
  font-size: 12px;
}

.fragment-note {
  color: var(--el-text-color-regular);
  font-size: 12px;
}
</style>
