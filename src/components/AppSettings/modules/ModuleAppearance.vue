<script setup lang="ts">
import { useDadianStore } from '@/stores/dadian'
import { usePreferenceStore } from '@/stores/userPreference'
import elementPreview from '../assets/font-element.svg'
import genshinPreview from '../assets/font-genshin.svg'
import mapLabelPreview from '../assets/font-map-label.svg'
import markerDescriptionPreview from '../assets/font-marker-description.svg'
import noticeEditorPreview from '../assets/font-notice-editor.svg'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const dadianStore = useDadianStore()
const preferenceStore = usePreferenceStore()

const fontSettings = [
  {
    key: 'mapLabelFont',
    label: '地图标签',
    preview: mapLabelPreview,
    previewDescription: '底图上的地名，例如蒙德城和风起地',
  },
  {
    key: 'genshinFont',
    label: '原神风格通用组件',
    preview: genshinPreview,
    previewDescription: '原神风格的云存档卡片标题和圆角按钮文字',
  },
  {
    key: 'elementFont',
    label: 'Element 系列管理组件',
    preview: elementPreview,
    previewDescription: '以物品管理窗口为例，包含搜索框、按钮和表格文字',
  },
  {
    key: 'markerDescriptionFont',
    label: '点位描述输入框',
    preview: markerDescriptionPreview,
    previewDescription: '点位表单中输入采集路线的多行文本区域',
  },
  {
    key: 'noticeEditorFont',
    label: '公告管理富文本编辑器',
    preview: noticeEditorPreview,
    previewDescription: '加粗、斜体等格式工具下方的公告正文编辑区',
  },
] as const

const fontOptions = computed(() => Object.keys(dadianStore.fontResources).filter(Boolean))

const defaultFontFamily = 'ui-sans-serif, system-ui, sans-serif'

const getOptionFontFamily = (font: string) => {
  const loadedFont = dadianStore.loadedFontFamilies.get(font)
  return loadedFont ? `${loadedFont}, ${defaultFontFamily}` : defaultFontFamily
}
</script>

<template>
  <SettingPanel>
    <SettingGroup name="字体">
      <SettingBar
        v-for="{ key, label, preview, previewDescription } in fontSettings"
        :key="key"
        class="font-setting"
      >
        <div class="font-setting-row">
          <img
            class="font-setting-preview"
            :src="preview"
            :alt="previewDescription"
            width="184"
            height="80"
          />
          <span class="font-setting-label">{{ label }}</span>
          <el-select
            class="font-setting-select"
            :model-value="fontOptions.includes(preferenceStore[key]) ? preferenceStore[key] : ''"
            :aria-label="label"
            :empty-values="[null, undefined]"
            @update:model-value="font => (preferenceStore[key] = font)"
          >
            <template #label="{ label: fontLabel, value: font }">
              <span :style="{ fontFamily: getOptionFontFamily(font) }">{{ fontLabel }}</span>
            </template>

            <el-option label="默认字体" value="" :style="{ fontFamily: defaultFontFamily }" />
            <el-option
              v-for="font in fontOptions"
              :key="font"
              :label="font"
              :value="font"
              :style="{ fontFamily: getOptionFontFamily(font) }"
            />
          </el-select>
        </div>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>

<style scoped>
.font-setting {
  container-type: inline-size;
}

.font-setting-row {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr) minmax(0, 200px);
  grid-template-areas: 'preview label select';
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.font-setting-preview {
  grid-area: preview;
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 7px;
  color-scheme: light;
}

:global(html.dark .font-setting-preview) {
  color-scheme: dark;
}

.font-setting-label {
  grid-area: label;
  color: var(--el-text-color-primary);
}

.font-setting-select {
  grid-area: select;
  width: 100%;
  max-width: 200px;
}

@container (max-width: 560px) {
  .font-setting-row {
    grid-template-columns: minmax(0, min(52%, 184px)) minmax(0, 1fr);
    grid-template-areas:
      'preview label'
      'preview select';
    gap: 6px 12px;
    padding-inline: 12px;
  }

  .font-setting-label {
    align-self: end;
    font-size: 14px;
    text-wrap: balance;
  }

  .font-setting-select {
    align-self: start;
  }
}
</style>
