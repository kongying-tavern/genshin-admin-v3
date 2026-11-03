<script setup lang="ts">
import { Avatar } from '@element-plus/icons-vue'
import { ElIcon, ElImage } from 'element-plus'
import { GSButton } from '@/components'
import { ExitLeft } from '@/components/GenshinUI/GSIcon'
import { useUserStore } from '@/stores'

const userStore = useUserStore()

const BANNER_FALLBACK_URL = import.meta.env.VITE_BANNER_IMAGE
</script>

<template>
  <div class="w-full h-[260px] text-base pt-8 pb-0 flex rounded-t relative select-none">
    <template v-if="!userStore.info"> 未登录 </template>

    <template v-else>
      <div class="absolute top-0 left-0 w-full h-full z-[-1] p-1">
        <ElImage :src="BANNER_FALLBACK_URL" fit="cover" style="width: 100%; height: 100%">
          <template #placeholder>
            <div
              class="w-full h-full bg-[linear-gradient(to_bottom,#3B4250,#6395BD)] animate-pulse"
            />
          </template>
          <template #error>
            <div class="w-full h-full bg-[linear-gradient(to_bottom,#3B4250,#6395BD)]" />
          </template>
        </ElImage>
      </div>

      <div class="flex mx-8 flex-col items-center shrink-0">
        <div class="absolute left-4 top-4">
          <GSButton theme="plain" title="退出" @click="userStore.logout">
            <template #icon>
              <ElIcon :size="22">
                <ExitLeft />
              </ElIcon>
            </template>
          </GSButton>
        </div>

        <div
          class="w-[144px] h-[144px] m-2 rounded-[80px] overflow-hidden bg-[#DAAB86] outline-[#ECE5D820] outline outline-8 border-[#ECE5D8] border-[5px]"
        >
          <ElImage :src="userStore.info.logo" fit="cover" style="width: 100%; height: 100%">
            <template #placeholder>
              <div class="w-full h-full grid place-content-center">
                <ElIcon :size="64" color="#F0EBE3">
                  <Avatar />
                </ElIcon>
              </div>
            </template>
            <template #error>
              <div class="w-full h-full grid place-content-center">
                <ElIcon :size="64" color="#F0EBE3">
                  <Avatar />
                </ElIcon>
              </div>
            </template>
          </ElImage>
        </div>

        <div
          class="mt-2 text-[#ECE5D8] border border-[#ECE5D880] rounded-[16px] py-0.5 px-3 bg-[#00000040]"
          style="-webkit-text-stroke: 2px #363d4da0; paint-order: stroke"
        >
          {{ `UID ${userStore.info.id}` }}
        </div>
      </div>

      <div class="flex-1 mr-8 text-white overflow-hidden">
        <div
          class="py-0.5 overflow-hidden bg-[linear-gradient(to_right,transparent,#00000020_10%,#00000020_90%,transparent)]"
        >
          <div
            class="overflow-hidden whitespace-nowrap text-ellipsis text-3xl drop-shadow-[0_0_2px_#000]"
          >
            {{ userStore.info.nickname ?? userStore.info.username }}
          </div>
        </div>

        <div class="text-xl leading-10 drop-shadow-[0_0_2px_#000]">
          {{ userStore.info.role?.name }}
        </div>

        <div
          class="h-[5.5em] grid place-content-center bg-[linear-gradient(to_right,transparent,#00000020_10%,#00000020_90%,transparent)]"
        >
          Feature Comming Soon
        </div>

        <div class="flex justify-between drop-shadow-[0_0_2px_#000]">
          <div class="leading-8">更新时间</div>
          <div class="leading-8">
            {{
              userStore.info.updateTime
                ? new Date(userStore.info.updateTime).toLocaleString()
                : '--'
            }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
