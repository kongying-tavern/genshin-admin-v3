<script setup lang="ts">
import * as ElIcons from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { AppVirtualTable } from '@/components'
import { useFetchHook } from '@/hooks'
import {
  useAccessStore,
  useDadianStore,
  useDevStore,
  useIconStore,
  usePreferenceStore,
} from '@/stores'
import { SettingBar, SettingGroup, SettingPanel } from '../components'

const accessStore = useAccessStore()
const dadianStore = useDadianStore()
const devStore = useDevStore()
const preferenceStore = usePreferenceStore()

const initLogInfo = (args: unknown[]) => {
  const str: {
    style: string
    text: string
    object?: boolean
  }[] = []

  const [prefix, prefixStyle, tagStyle, ...payloads] = args

  const styles: string[] = ['', `${prefixStyle}`, `${tagStyle}`]

  ;`${prefix}`.split('%c').forEach((code, index) => {
    if (!code) return
    str.push({
      style: styles[index] ?? '',
      text: code,
    })
  })

  payloads.forEach(payload => {
    const text = `${payload}`
    if (text === '[object Object]') {
      str.push({
        style: 'margin-left: 4px',
        text: Object.prototype.toString.call(payload).replace(/(\[object )|(\])/g, ''),
        object: true,
      })
      return
    }
    str.push({
      style: 'margin-left: 4px',
      text,
    })
  })

  return str
}

const { refresh: refreshApp, loading: refreshLoading } = useFetchHook({
  onRequest: async () => {
    await Apis.app.triggerAppUpdate()
  },
})

const confirmRefreshApp = async () => {
  await ElMessageBox.confirm('该操作将会导致全部在线用户执行刷新操作，是否继续？', '警告', {
    type: 'warning',
    closeOnClickModal: false,
    closeOnPressEscape: false,
    closeOnHashChange: false,
    showClose: false,
    distinguishCancelAndClose: true,
    cancelButtonClass: 'el-button--primary el-button--danger',
    cancelButtonText: '确定',
    confirmButtonClass: 'el-button--info is-text',
    confirmButtonText: '取消',
    beforeClose: (action, instance, done) => {
      if (refreshLoading.value) return
      if (action !== 'cancel') return done()
      instance.cancelButtonLoading = true
      refreshApp().then(() => {
        ElMessage.success('操作成功')
        instance.cancelButtonLoading = false
        done()
      })
    },
  }).catch(() => false)
}

const showDadianJson = () => {
  // oxlint-disable-next-line no-console
  console.log('[DadianJSON]', dadianStore.raw)
}

const iconStore = useIconStore()
const downloadIconSprite = () => {
  if (!iconStore.iconTextureUrl) return
  const a = document.createElement('a')
  a.href = iconStore.iconTextureUrl
  a.download = 'icon-sprite.png'
  a.click()
  a.remove()
}

const downloadMarkerTexture = () => {
  if (!iconStore.markerSpriteUrl) return
  const a = document.createElement('a')
  a.href = iconStore.markerSpriteUrl
  a.download = 'marker-sprite.png'
  a.click()
  a.remove()
}

const printIconSpriteMapping = () => {
  // oxlint-disable-next-line no-console
  console.log('[mapping]', {
    marker: iconStore.markerSpriteMapping,
    icon: iconStore.iconCoordMap,
  })
}
</script>

<template>
  <SettingPanel>
    <SettingGroup name="日志">
      <div class="logger-list">
        <AppVirtualTable
          :data="devStore.visibleLogList"
          :item-height="24"
          :cached-rows="2"
          class="logger-list-content"
        >
          <template #default="{ item }">
            <div
              class="logger-item overflow-hidden whitespace-nowrap text-ellipsis"
              :class="`is-${item.type}`"
            >
              <span
                v-for="({ style, text, object }, index) in initLogInfo(item.args)"
                :key="index"
                :style="style"
              >
                <el-button v-if="object" size="small" link type="primary">
                  {{ text }}
                </el-button>
                <template v-else>
                  {{ text }}
                </template>
              </span>
            </div>
          </template>
        </AppVirtualTable>
      </div>

      <div class="flex justify-end items-center">
        <el-text size="small">
          {{ `${devStore.visibleLogList.length} / ${devStore.logList.length}` }} 次记录
        </el-text>
        <el-divider direction="vertical" style="height: 24px" />
        <el-button :icon="ElIcons.Delete" type="danger" @click="devStore.clearLogs">
          清空
        </el-button>
      </div>

      <SettingBar label="日志可见性" note="控制日志是否在面板上输出" :icon="ElIcons.Setting">
        <template #detail>
          <el-checkbox-group v-model="preferenceStore.enableLoggers" @change="devStore.refreshLogs">
            <div class="grid grid-cols-2 sm:grid-cols-4">
              <el-checkbox v-for="label in devStore.loggerLabels" :key="label" :value="label">
                {{ label }}
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </template>
      </SettingBar>
    </SettingGroup>

    <SettingGroup v-if="accessStore.get('ADMIN_COMPONENT')" name="开发者工具">
      <SettingBar label="发送刷新信号，将会导致所有在线用户刷新页面">
        <template #setting>
          <el-button
            class="shrink-0"
            :icon="ElIcons.WarnTriangleFilled"
            :loading="refreshLoading"
            @click="confirmRefreshApp"
          >
            刷新应用
          </el-button>
        </template>
      </SettingBar>

      <SettingBar label="打印纹理坐标映射">
        <template #setting>
          <el-button class="shrink-0" @click="printIconSpriteMapping"> 打印 </el-button>
        </template>
      </SettingBar>

      <SettingBar label="下载图标精灵图">
        <template #setting>
          <el-button class="shrink-0" @click="downloadIconSprite"> 下载 </el-button>
        </template>
      </SettingBar>

      <SettingBar label="下载点位纹理图">
        <template #setting>
          <el-button class="shrink-0" @click="downloadMarkerTexture"> 下载 </el-button>
        </template>
      </SettingBar>

      <SettingBar label="在控制台打印地图配置">
        <template #setting>
          <el-button @click="showDadianJson"> 查看地图配置 </el-button>
        </template>
      </SettingBar>

      <SettingBar label="从本地文件加载测试用的地图配置（会经过校验）">
        <template #setting>
          <el-button @click="dadianStore.loadDadianJSON"> 加载地图配置 </el-button>
        </template>
      </SettingBar>

      <SettingBar label="恢复为当前订阅的地图配置">
        <template #setting>
          <el-button @click="dadianStore.update"> 恢复地图配置 </el-button>
        </template>
      </SettingBar>
    </SettingGroup>
  </SettingPanel>
</template>

<style scoped>
.logger-list {
  width: 100%;
  height: 240px;
  overflow: hidden;
  background: #23262a;
  color: white;
  font-size: 12px;
  font-family: monospace;
  border-radius: 4px;
}

.logger-item {
  --item-bg: transparent;

  padding: 2px 4px;
  background: var(--item-bg);
  clip-path: inset(1px 4px round 6px);

  &.is-warn {
    --item-bg: #413c26;
  }

  &.is-error {
    --item-bg: #4e3534;
  }
}
</style>
