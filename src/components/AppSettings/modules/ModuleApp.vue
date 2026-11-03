<script setup lang="ts">
import { Brush, Crop, Grape } from '@element-plus/icons-vue'
import { mapCanvasRef } from '@/shared'
import { useArchiveStore } from '@/stores'
import { getDefaultPreference } from '@/stores/types'
import { SettingBar, SettingGroup, SettingPanel, ShortcutKey } from '../components'

const archiveStore = useArchiveStore()

const defaultPreference = getDefaultPreference()
</script>

<template>
  <SettingPanel>
    <SettingGroup name="快捷键">
      <SettingBar label="切换黑暗模式" :icon="Brush">
        <template #setting>
          <ShortcutKey
            v-model="archiveStore.currentArchive.body.Preference['app.shortcutKey.toggleDarkMode']"
            :default-value="defaultPreference['app.shortcutKey.toggleDarkMode']"
          />
        </template>
      </SettingBar>

      <SettingBar label="批量编辑点位" :icon="Crop">
        <template #setting>
          <ShortcutKey
            v-model="
              archiveStore.currentArchive.body.Preference['app.shortcutKey.multiselectMarker']
            "
            :default-value="defaultPreference['app.shortcutKey.multiselectMarker']"
          />
        </template>
      </SettingBar>

      <SettingBar label="批量标记点位" :icon="Grape">
        <template #setting>
          <ShortcutKey
            v-model="
              archiveStore.currentArchive.body.Preference['app.shortcutKey.toggleMarkerState']
            "
            :default-value="defaultPreference['app.shortcutKey.toggleMarkerState']"
          />
        </template>
      </SettingBar>

      <SettingBar label="拖拽点位" :icon="Grape">
        <template #setting>
          <ShortcutKey
            v-model="archiveStore.currentArchive.body.Preference['app.shortcutKey.draggingMarker']"
            :default-value="defaultPreference['app.shortcutKey.draggingMarker']"
            :focus-element="mapCanvasRef"
          />
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>
