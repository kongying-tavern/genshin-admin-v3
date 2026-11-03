<script lang="ts" setup>
import type { MiyousheAvatar } from '../hooks'
import { pick } from 'lodash'
import { AppVirtualTable, GSButton } from '@/components'
import { useFetchHook } from '@/hooks'
import { useUserStore } from '@/stores'
import { AvatarPreview } from '.'
import { useAvatarList } from '../hooks'

const userStore = useUserStore()

const { avatarList, loading: avatarsLoading, onSuccess: onAvatarListFetched } = useAvatarList()
const selectedAvatar = ref<MiyousheAvatar | null>(null)
onAvatarListFetched(() => {
  selectedAvatar.value =
    avatarList.value.find(avatar => avatar.icon === userStore.info?.logo) ?? null
})

const { loading, refresh: updateUserInfo } = useFetchHook({
  onRequest: async () => {
    if (!userStore.info) throw new Error('未登录')
    if (!selectedAvatar.value?.icon) throw new Error('头像地址为空')
    await Apis.user.updateUser({
      data: {
        ...pick(userStore.info, 'nickname', 'qq', 'phone', 'roleId'),
        userId: userStore.info.id,
        logo: selectedAvatar.value.icon,
      },
    })
    await userStore.refreshUserInfo()
  },
})

const setSelectedIcon = (avatar: MiyousheAvatar) => {
  if (loading.value) return
  selectedAvatar.value = avatar
}
</script>

<template>
  <div class="w-full flex-1 flex gap-2 overflow-hidden select-none">
    <AppVirtualTable
      v-loading="avatarsLoading"
      element-loading-background="transparent"
      element-loading-text="正在加载头像列表..."
      class="avatar-list w-[374px]"
      :data="avatarList"
      :cached-rows="1"
      :item-width="84"
      :item-height="84"
      :item-gap="[8, 8]"
    >
      <template #default="{ item }">
        <div
          class="avatar-btn rounded overflow-hidden"
          :class="{
            'is-selected': item.id === selectedAvatar?.id,
            'is-actived': item.icon === userStore.info?.logo,
          }"
          @click="setSelectedIcon(item)"
        >
          <img
            class="avatar-icon w-full h-full rounded-full object-contain"
            :src="item.icon"
            crossorigin=""
            referrerpolicy="no-referrer"
            loading="lazy"
          />
        </div>
      </template>
    </AppVirtualTable>

    <div class="w-[150px] flex flex-col gap-8 justify-center items-center pb-1">
      <AvatarPreview :src="selectedAvatar?.icon" />

      <div class="avatar-name">{{ selectedAvatar?.name ?? '<???>' }}</div>

      <GSButton
        icon="submit"
        theme="dark"
        style="width: 100%"
        :disabled="!selectedAvatar || userStore.info?.logo === selectedAvatar.icon"
        :loading="loading"
        @click="updateUserInfo"
      >
        使用头像
      </GSButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.avatar-list {
  --avatar-size: 84px;

  overflow: auto;
  background: #e7e3db;

  &::-webkit-scrollbar {
    width: 6px;
    background-color: #9e9a94;
    border-radius: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: #ffffff;
    border-radius: 6px;
  }
}

.avatar-btn {
  --btn-bg: transparent;
  --btn-padding: 8px;
  --btn-border-color: transparent;
  --icon-filter: drop-shadow(0 0 4px #00000060);
  --icon-outline-color: transparent;
  --icon-border-color: #00000060;

  content-visibility: auto;
  width: var(--avatar-size);
  height: var(--avatar-size);
  padding: var(--btn-padding);
  background-color: var(--btn-bg);
  border: 2px solid var(--btn-border-color);
  transition: padding 50ms linear;
  transition-delay: 25ms;
  position: relative;

  &:not(.is-selected):hover {
    --btn-border-color: #8f6d4c;
    --btn-padding: 4px;
  }

  &:not(.is-selected):active {
    --btn-border-color: #d1c1a7;
    --btn-padding: 8px;
    --btn-bg: #38404f20;
  }

  &.is-selected {
    --btn-border-color: #5d6a81;
    --btn-bg: #38404f;
    --icon-filter: none;
    --icon-border-color: #d5d7d9;
    --icon-outline-color: #ffffff20;
  }

  &.is-actived {
    border-color: #5d6a81;
    &::before {
      content: '使用中';
      position: absolute;
      width: 100%;
      height: 1.5em;
      bottom: 0;
      left: 0;
      background: #38404f;
      color: #fff;
      font-size: 12px;
      text-align: center;
      z-index: 1;
    }
  }

  .avatar-icon {
    background-color: #c79575;
    border: 2px solid var(--icon-border-color);
    filter: var(--icon-filter);
    outline: 4px solid var(--icon-outline-color);
  }
}

.avatar-name {
  width: 100%;
  text-align: center;
  font-size: 20px;
  padding: 8px;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      #d4be92 2px,
      #fff 2px,
      #fff calc(100% - 2px),
      #d4be92 calc(100% - 2px)
    );
    mask: linear-gradient(to right, transparent, #fff, transparent);
    z-index: -1;
  }
}
</style>
