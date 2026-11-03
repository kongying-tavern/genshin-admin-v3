<script lang="ts" setup>
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
</script>

<template>
  <div class="user-info-dialog overflow-hidden">
    <div class="absolute right-[-48px] top-[2px]">
      <GSButton
        icon="cancel"
        theme="plain"
        style="--icon-color: #816d51"
        @click="() => emits('close')"
      />
    </div>

    <div class="user-info-card">
      <UserBanner />

      <ArchiveAnalyser />
    </div>

    <div class="user-action overflow-hidden">
      <GSTab v-model="tab" :tabs="tabs" divider class="h-full overflow-hidden">
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
  @apply relative overflow-visible
    font-[HYWenHei-85W] text-[#424F65];
  --paint-padding: 2;
  width: 1150px;
  height: 720px;
  background: paint(user-card-border);
  @supports not (background: paint(user-card-border)) {
    background: #f0ebe3;
    border-radius: 6px;
    outline: 2px solid #dfd2c0;
    outline-offset: -8px;
  }
  &::before {
    content: '';
    position: absolute;
    left: 32px;
    top: 0;
    width: 540px;
    height: 100%;
    border-radius: 4px;
    background: #f0ebe3;
    filter: drop-shadow(0 0 12px #66666640);
    animation: user-card-bg-anime-in 400ms forwards;
  }
}

.user-info-card {
  @apply rounded flex flex-col items-center;
  width: 540px;
  height: calc(100% + 4px);
  background: paint(user-card-info-border);
  filter: drop-shadow(0 0 4px #00000040);
  animation: user-card-anime-in 400ms forwards;
  position: absolute;
  left: 32px;
  top: 0;
  @supports not (background: paint(user-card-border)) {
    background: #f0ebe3;
    border-radius: 6px;
    outline: 4px solid #e4d8c1;
    outline-offset: -8px;
  }
}

.user-action {
  @apply my-8 mr-4 absolute top-0 right-0;
  width: 540px;
  height: calc(100% - 64px);
  animation: user-action-anime-in 400ms forwards;
}
</style>
