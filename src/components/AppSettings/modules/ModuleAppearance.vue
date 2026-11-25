<script setup lang="ts">
import { useDadianStore } from '@/stores/dadian'
import { usePreferenceStore } from '@/stores/userPreference'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const dadianStore = useDadianStore()
const preferenceStore = usePreferenceStore()

const fontSettings = [
  { key: 'mapLabelFont', label: '地图标签' },
  { key: 'genshinFont', label: '原神风格通用组件' },
  { key: 'elementFont', label: 'Element 系列管理组件' },
  { key: 'markerDescriptionFont', label: '点位描述输入框' },
  { key: 'noticeEditorFont', label: '公告管理富文本编辑器' },
] as const

const fontOptions = computed(() => Object.keys(dadianStore.fontResources).filter(Boolean))
</script>

<template>
  <SettingPanel>
    <SettingGroup name="字体">
      <SettingBar v-for="{ key, label } in fontSettings" :key="key" :label="label">
        <template #setting>
          <el-select
            :model-value="fontOptions.includes(preferenceStore[key]) ? preferenceStore[key] : ''"
            :aria-label="label"
            :empty-values="[null, undefined]"
            style="width: min(40vw, 200px)"
            @update:model-value="font => (preferenceStore[key] = font)"
          >
            <el-option label="默认字体" value="" />
            <el-option v-for="font in fontOptions" :key="font" :label="font" :value="font" />
          </el-select>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
