<script lang="ts" setup>
import { ArrowDown } from '@element-plus/icons-vue'
import { GSButton, GSTab } from '@/components'
import { useUserStore } from '@/stores'
import { ArchiveAnalyser, ArchiveSelector, InfoEditor, PasswordEditor } from '.'
import { UserBanner } from './components'

const emits = defineEmits<{
  close: []
}>()

const userStore = useUserStore()

whenever(
  () => !userStore.info,
  () => {
    emits('close')
  },
)

const tabs: { title: string; value: string }[] = [
  { title: '云存档', value: 'archive' },
  { title: '编辑信息', value: 'info' },
  { title: '修改密码', value: 'password' },
]
const tab = ref('archive')
const progressExpanded = ref(false)
const progressId = useId()
</script>

<template>
  <div class="user-info-dialog font-genshin">
    <header class="user-info-header">
      <h2>用户中心</h2>
      <GSButton
        icon="cancel"
        theme="plain"
        aria-label="关闭用户中心"
        style="--icon-color: #816d51"
        @click="emits('close')"
      />
    </header>

    <div class="user-info-layout">
      <div class="user-card-stack">
        <div class="user-info-card">
          <UserBanner />
          <button
            type="button"
            class="progress-toggle"
            :aria-controls="progressId"
            :aria-expanded="progressExpanded"
            @click="progressExpanded = !progressExpanded"
          >
            存档统计
            <el-icon :class="{ 'rotate-180': progressExpanded }"><ArrowDown /></el-icon>
          </button>
          <ArchiveAnalyser
            :id="progressId"
            class="archive-progress"
            :class="{ expanded: progressExpanded }"
          />
        </div>
      </div>

      <GSTab v-model="tab" :tabs="tabs" divider class="user-action">
        <template #archive>
          <ArchiveSelector />
        </template>
        <template #info>
          <InfoEditor />
        </template>
        <template #password>
          <PasswordEditor />
        </template>
      </GSTab>
    </div>
  </div>
</template>

<style scoped>
@keyframes user-card-anime-in {
  from {
    rotate: 3deg;
  }
  to {
    rotate: 0deg;
  }
}

@keyframes user-card-bg-anime-in {
  from {
    rotate: 5deg;
  }
  to {
    rotate: -1.5deg;
  }
}

@keyframes user-action-anime-in {
  from {
    translate: -20px 0;
  }
  to {
    translate: 0 0;
  }
}

.user-info-dialog {
  @apply relative text-[#424F65];
  --paint-padding: 2;
  container: user-center / inline-size;
  height: min(720px, calc(100dvh - 48px));
  background: paint(user-card-border);
  @supports not (background: paint(user-card-border)) {
    background: #f0ebe3;
    border-radius: 6px;
    outline: 2px solid #dfd2c0;
    outline-offset: -8px;
  }
}

.user-info-header {
  position: absolute;
  top: 2px;
  right: 4px;
  z-index: 1;

  h2 {
    display: none;
  }
}

.user-info-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr);
  gap: 22px;
  height: 100%;
  padding-inline: 32px 16px;
}

.user-card-stack {
  position: relative;
  isolation: isolate;
  min-height: 0;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    border-radius: 4px;
    background: #f0ebe3;
    filter: drop-shadow(0 0 12px #66666640);
    animation: user-card-bg-anime-in 400ms forwards;
  }
}

.user-info-card {
  @apply rounded flex flex-col items-center;
  height: calc(100% + 4px);
  background: paint(user-card-info-border);
  filter: drop-shadow(0 0 4px #00000040);
  animation: user-card-anime-in 400ms forwards;
  @supports not (background: paint(user-card-info-border)) {
    background: #f0ebe3;
    border-radius: 6px;
    outline: 4px solid #e4d8c1;
    outline-offset: -8px;
  }
}

.progress-toggle {
  display: none;
}

.user-action {
  container: user-actions / inline-size;
  min-height: 0;
  margin-block: 44px 32px;
  animation: user-action-anime-in 400ms forwards;
}

@media (min-width: 1250px) {
  .user-info-header {
    right: -48px;
  }

  .user-action {
    margin-top: 32px;
  }
}

.user-action :deep(.gs-tab-title) {
  --tab-item-min-width: 0;
  --tab-item-padding: 6px 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(460px, calc(100% - 56px));
}

.user-action :deep(.gs-tab-content) {
  min-height: 0;
  overflow: auto;
}

@container user-center (max-width: 920px) {
  .user-info-header {
    position: relative;
    inset: auto;
    height: 48px;
    padding-inline: 20px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      display: block;
      font-size: 18px;
    }
  }

  .user-info-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: max-content max-content;
    align-content: start;
    gap: 16px;
    height: calc(100% - 48px);
    padding: 12px 16px 20px;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .user-info-card {
    height: auto;
  }

  .progress-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding-inline: 18px;
    color: #84603d;
  }

  .archive-progress:not(.expanded) {
    display: none;
  }

  .user-action {
    margin: 0;
    overflow: visible;
  }

  .user-action :deep(.gs-tab-content) {
    flex: auto;
    overflow: visible;
  }

  .user-action :deep(.gs-divider) {
    height: 24px;
  }
}

@container user-actions (max-width: 460px) {
  .user-action :deep(.gs-tab-title) {
    --tab-font-size: 16px;
    --tab-item-padding: 9px 0;
    width: 100%;
  }

  .user-action :deep(.gs-tab-title::before),
  .user-action :deep(.gs-tab-title::after) {
    display: none;
  }
}
</style>
