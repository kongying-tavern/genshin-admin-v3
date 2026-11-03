<script setup lang="ts">
import type { NoticeVo } from '@/api/alova/globals'
import { GSButton } from '@/components'
import { CloseFilled, LeftRegular, RightRegular } from '@/components/GenshinUI/GSIcon'
import { useNoticeStore } from '@/stores'
import { context } from '../context'
import NoticeDetail from './NoticeDetail.vue'
import NoticeTitle from './NoticeTitle.vue'

const noticeStore = useNoticeStore()

const isMobileScreen = useMediaQuery('screen and (max-width: 400px)')

const isSiderCollapsed = ref(isMobileScreen.value)

watch(isMobileScreen, () => {
  isSiderCollapsed.value = true
})

const handleTitleSelect = (notice: NoticeVo) => {
  noticeStore.read(notice.id!)
  noticeStore.selected = notice
}
</script>

<template>
  <div class="card-body">
    <div class="card-header">
      <div
        v-if="isMobileScreen"
        class="absolute left-0 top-0 w-[60px] h-[60px] flex items-center p-4"
      >
        <GSButton theme="plain" @click="isSiderCollapsed = !isSiderCollapsed">
          <template #icon>
            <el-icon color="var(--icon-color)" :size="20">
              <component :is="isSiderCollapsed ? RightRegular : LeftRegular" />
            </el-icon>
          </template>
        </GSButton>
      </div>

      <div class="title">公告</div>

      <div class="absolute top-1/2 right-[16px] -translate-y-1/2">
        <GSButton theme="plain" @click="() => context.close()">
          <template #icon>
            <el-icon color="var(--icon-color)" :size="20">
              <CloseFilled />
            </el-icon>
          </template>
        </GSButton>
      </div>
    </div>

    <div class="card-content">
      <div
        class="sider"
        :class="{
          'is-collapsed': isSiderCollapsed,
        }"
      >
        <NoticeTitle
          v-for="notice in noticeStore.noticeList"
          :key="notice.id"
          :notice="notice"
          :hidden="noticeStore.isRead(notice.id!)"
          :is-selected="noticeStore.selected?.id === notice.id"
          @click="() => handleTitleSelect(notice)"
        />
      </div>

      <NoticeDetail :data="noticeStore.selected" />
    </div>
  </div>
</template>

<style scoped>
.card-body {
  width: 800px;
  max-width: 100dvw;
  height: 600px;
  display: flex;
  flex-direction: column;
  transform: scale(var(--dialog-body-scale));
  transition: transform var(--dialog-body-tr-timing) var(--dialog-body-tr-duration);
  position: relative;
  @media screen and (max-width: 400px) {
    height: 100dvh;
  }
}

.card-header {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #454d5c;
  color: #ece5d8;
  outline: 2px solid #ffffff20;
  outline-offset: -6px;
  padding: 8px 16px;
  filter: drop-shadow(0 0 6px #00000060);
  z-index: 1;
  user-select: none;
}

.title {
  line-height: 48px;
  font-size: 20px;
  padding: 0 8px;
  position: relative;
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 100%;
    height: 2px;
    background: #de7961;
  }
}

.card-content {
  background: #ebe7df;
  flex: 1;
  flex-shrink: 0;
  display: flex;
  overflow: hidden;
  position: relative;
  padding-left: 200px;
  @media screen and (max-width: 400px) {
    padding-left: 0px;
  }
}

.sider {
  width: 200px;
  height: 100%;
  overflow: auto;
  padding: 12px;
  position: absolute;
  left: 0;
  top: 0;
  filter: none;
  backdrop-filter: blur(2px);
  transform: translateX(0%);
  transition: transform ease 150ms;
  z-index: 1;
  @media screen and (max-width: 400px) {
    background-color: #ebe7dfa0;
    filter: drop-shadow(0 0 8px #33333380);
    &.is-collapsed {
      transform: translateX(-100%);
      filter: none;
    }
  }
  &::-webkit-scrollbar {
    width: 8px;
    background-color: #d8d7d5;
    border-radius: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #fff;
    border-radius: 8px;
    border: 1px solid #d8d7d5;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, #fff 90%, transparent 10%);
  }
}
</style>
