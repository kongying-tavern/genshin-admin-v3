<script setup lang="ts">
import db from '@/database'
import { useFetchHook } from '@/hooks'
import { useSocketStore, useUserStore } from '@/stores'
import MessageItem from './MessageItem.vue'

const socketStore = useSocketStore()
const userStore = useUserStore()

const { refresh: clearMessageList, loading: clearLoading } = useFetchHook({
  onRequest: async () => {
    await db.websocketEvents.clear()
    socketStore.clearMessageList()
  },
})

const wrapperRef = shallowRef<HTMLDivElement>()

const scrollToBottom = useDebounceFn(() => {
  if (!wrapperRef.value) return
  wrapperRef.value.scrollTo({
    behavior: 'smooth',
    top: wrapperRef.value.scrollHeight,
  })
}, 50)
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden">
    <div ref="wrapperRef" class="flex-1 overflow-y-auto bg-[var(--el-fill-color)]">
      <div
        v-if="!socketStore.messageList.length"
        class="h-full grid place-content-center text-xs text-[var(--el-text-color-secondary)]"
      >
        暂无记录
      </div>
      <MessageItem
        v-for="(message, index) in socketStore.messageList"
        :key="message.key"
        :data="message"
        :pre-data="socketStore.messageList[index - 1]"
        :is-self="message.user.id === userStore.info?.id"
        @resolve="scrollToBottom"
      />
    </div>

    <div
      class="shrink-0 p-1 flex justify-end border-t-[1px] border-[var(--el-border-color)] bg-[var(--el-fill-color)]"
    >
      <el-button
        type="danger"
        plain
        size="small"
        :disabled="!socketStore.messageList.length"
        :loading="clearLoading"
        @click="clearMessageList"
      >
        删除所有记录
      </el-button>
    </div>
  </div>
</template>
