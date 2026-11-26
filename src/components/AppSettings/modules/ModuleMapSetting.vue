<script setup lang="ts">
import { useDadianStore, usePreferenceStore, useTileStore } from '@/stores'
import cachedPopover from '../assets/marker-popover-cached.svg'
import onlinePopover from '../assets/marker-popover-online.svg'
import placementMinimap from '../assets/placement-minimap.svg'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const tileStore = useTileStore()
const dadianStore = useDadianStore()
const preferenceStore = usePreferenceStore()

const consoleConfig = () => {
  // oxlint-disable-next-line no-console
  console.log(tileStore.mergedTileConfigs)
}
</script>

<template>
  <SettingPanel>
    <SettingGroup name="状态">
      <SettingBar label="配置状态">
        <template #note>
          <div class="text-xs text-[var(--el-text-color-regular)]">
            <div>签名：{{ dadianStore.meta.digest.slice(-16) }}</div>
            <div>版本：{{ dadianStore.meta.version }}</div>
          </div>
        </template>
        <template #setting>
          <el-button @click="consoleConfig"> 查看配置 </el-button>
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="筛选器设置">
      <SettingBar label="条件预设" note="当前存储的自定义条件预设总数">
        <template #setting>
          <span class="text-sm">{{
            preferenceStore.presets.filter(p => p.name !== 'temp')?.length ?? 0
          }}</span>
        </template>
      </SettingBar>
      <SettingBar label="自动跳转下级筛选" note="点位筛选器满足条件后自动跳转下一级筛选器">
        <template #setting>
          <el-switch v-model="preferenceStore.autoNext" />
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup name="地图设置">
      <SettingBar label="全幅十字线" note="指针在地图上时，显示横纵轴及地图坐标和点位坐标">
        <template #setting>
          <el-switch v-model="preferenceStore.showFullCrosshair" aria-label="全幅十字线" />
        </template>
      </SettingBar>
      <SettingBar label="选址小地图">
        <template #note>
          <p class="text-xs text-[var(--el-text-color-regular)]">
            在新增点位的罗盘旁，以固定比例显示选址处的地形。拖动朝向滑块，让三角与游戏内的箭头同向。
          </p>
          <img
            :src="placementMinimap"
            class="block max-w-full h-auto mt-2"
            width="232"
            height="84"
            alt="左侧罗盘对准路口，右侧小地图中的三角绕同一路口旋转"
          />
        </template>
        <template #setting>
          <el-switch v-model="preferenceStore.showPlacementMinimap" aria-label="选址小地图" />
        </template>
      </SettingBar>
      <SettingBar label="显示区域标签" note="地图上各国、地区、子地区的标签">
        <template #setting>
          <el-switch v-model="preferenceStore.showZoneTag" />
        </template>
      </SettingBar>
      <SettingBar label="弱化已完成点位" note="是否以半透明状态显示已完成点位">
        <template #setting>
          <el-switch v-model="preferenceStore.transparentMarked" />
        </template>
      </SettingBar>
      <div class="marker-verification">
        <SettingBar
          label="高新鲜度模式"
          note="开启后将尽最大努力确认信息的新鲜度，网络请求压力将大幅提高！不建议在较差的网络环境下开启!"
        >
          <template #setting>
            <el-switch v-model="preferenceStore.verifyMarkersOnline" aria-label="高新鲜度模式" />
          </template>
        </SettingBar>

        <div class="marker-verification-description">
          <div class="marker-verification-previews">
            <figure class="marker-verification-preview">
              <img :src="cachedPopover" width="320" height="144" alt="" />
              <figcaption>
                <span class="marker-verification-mode">关闭</span>
                <span>通过 WebSocket 消息和定时更新同步</span>
              </figcaption>
            </figure>
            <figure class="marker-verification-preview">
              <img :src="onlinePopover" width="320" height="144" alt="" />
              <figcaption>
                <span class="marker-verification-mode is-online">开启</span>
                <span>点击点位时额外在线核对</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
      <SettingBar
        label="滚轮缩放过渡时间（毫秒）"
        note="使用滚轮进行缩放时，过渡所消耗的时间，设置为 0 时则取消过渡"
      >
        <template #setting>
          <div class="flex flex-col">
            <el-input-number
              v-model="preferenceStore.zoomTransitionDuration"
              style="width: 140px"
              :min="0"
              :step="10"
              :max="200"
            />
          </div>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>

<style scoped>
.marker-verification {
  overflow: hidden;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}

.marker-verification-description {
  padding: 0 16px 12px;
}

.marker-verification-previews {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 218px), 1fr));
  gap: 10px;
}

.marker-verification-preview {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);

  img {
    display: block;
    width: 100%;
    height: auto;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: baseline;
    padding: 8px 10px;
    color: var(--el-text-color-regular);
    font-size: 12px;
    line-height: 1.5;
  }
}

.marker-verification-mode {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  font-weight: 600;

  &.is-online {
    background: var(--el-color-success-light-9);
    color: var(--el-color-success-dark-2);
  }
}
</style>
