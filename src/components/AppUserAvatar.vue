<script lang="ts" setup>
import { Avatar, CircleCloseFilled } from '@element-plus/icons-vue'
import { ElIcon, ElImage, ElSkeleton, ElSkeletonItem } from 'element-plus'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
</script>

<template>
  <div
    class="user-avatar"
    :class="{
      'is-login': Boolean(userStore.info),
      'has-logo': userStore.info?.logo,
    }"
  >
    <ElIcon v-if="!userStore.info" :size="32" color="#263240">
      <Avatar />
    </ElIcon>

    <ElIcon v-else-if="!userStore.info?.logo" :size="32" color="#ECE5D8">
      <Avatar />
    </ElIcon>

    <ElImage v-else :src="userStore.info.logo" fit="cover" class="drop-shadow-[0_0_1px_#000000A0]">
      <template #placeholder>
        <ElSkeleton loading animated>
          <template #template>
            <ElSkeletonItem variant="image" style="width: 44px; height: 44px" />
          </template>
        </ElSkeleton>
      </template>
      <template #error>
        <ElIcon :size="32" color="#FF5F40">
          <CircleCloseFilled />
        </ElIcon>
      </template>
    </ElImage>
  </div>
</template>

<style scoped>
.user-avatar {
  @apply w-full h-full rounded-full overflow-hidden
    grid place-content-center
    bg-gray-500
    border-2 border-transparent;
  &.is-login {
    @apply border-[#ECE5D8];
  }
  &.has-logo {
    background: #da9241;
  }
}

.user-info {
  @apply w-[100px] p-0.5
    grid place-content-center
    text-[#ECE5D8] text-xs;
}
</style>
