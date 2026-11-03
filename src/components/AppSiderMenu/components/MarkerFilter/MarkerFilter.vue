<script lang="ts" setup>
import { GSButton } from '@/components'
import { IconSetting } from '@/components/AppIcons'
import { useArchiveStore, useMapStateStore } from '@/stores'
import { MarkerFilterAdvanced } from '../MarkerFilterAdvanced'
import { MarkerFilterBasic } from '../MarkerFilterBasic'
import { PresetManager } from '../PresetManager'

const archiveStore = useArchiveStore()
const mapStateStore = useMapStateStore()

const filterType = computed(() => {
  return archiveStore.currentArchive.body.Preference['markerFilter.setting.filterType']
})

/** 筛选预设管理器 */
const conditionManagerVisible = ref(false)
</script>

<template>
  <div class="marker-filter font-['HYWenHei-85W'] h-full flex flex-col">
    <MarkerFilterAdvanced v-if="filterType === 'advanced'">
      <template #append>
        <GSButton class="flex-1" size="small" @click="conditionManagerVisible = true">
          <template #icon>
            <el-icon color="var(--gs-color-confirm)">
              <IconSetting />
            </el-icon>
          </template>
          管理预设
        </GSButton>
      </template>
    </MarkerFilterAdvanced>
    <MarkerFilterBasic v-else>
      <template #append>
        <GSButton class="flex-1" size="small" @click="conditionManagerVisible = true">
          <template #icon>
            <el-icon color="var(--gs-color-confirm)">
              <IconSetting />
            </el-icon>
          </template>
          管理预设
        </GSButton>
      </template>
    </MarkerFilterBasic>

    <PresetManager v-model="conditionManagerVisible" :conditions="mapStateStore.markerFilters" />
  </div>
</template>

<style scoped>
.marker-filter {
  width: 350px;
  max-width: calc(100dvw - 72px);
}
</style>
