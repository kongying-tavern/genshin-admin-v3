<script setup lang="ts">
import type { IconVo } from '@/api/alova/globals'
import { Loading, Search } from '@element-plus/icons-vue'
import { PgUnit, useFetchHook, usePagination } from '@/hooks'

const modelValue = defineModel<IconVo | null>('modelValue', {
  default: null,
})

const iconList = ref<IconVo[]>([])

const { state, isLoading, execute } = useAsyncState<{
  url?: string
  size?: number[]
  byteLength?: number
}>(
  async () => {
    if (!modelValue.value?.url) return {}
    const res = await fetch(modelValue.value.url)
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    return {
      url: modelValue.value.url,
      byteLength: blob.size,
      size: [bmp.width, bmp.height],
    }
  },
  {},
  { immediate: true },
)

watch(modelValue, () => execute())

const iconQuery = ref('')

const { pagination, layout } = usePagination({
  units: [PgUnit.TOTAL, PgUnit.PREV, PgUnit.PAGER, PgUnit.NEXT],
  init: {
    pageSize: 25,
    total: 0,
    current: 1,
  },
})

const {
  loading,
  refresh: updateIconList,
  onSuccess,
} = useFetchHook({
  immediate: true,
  onRequest: async () => {
    const { data: { record = [], total = 0 } = {} } = await Apis.icon.listIcon({
      data: {
        current: pagination.value.current,
        size: pagination.value.pageSize,
        name: iconQuery.value,
      },
    })
    return { record, total }
  },
})

watchDebounced(iconQuery, updateIconList, { debounce: 500 })

function activeImage(icon: IconVo) {
  if (modelValue.value?.id === icon.id) return
  modelValue.value = icon
}

onSuccess(({ record, total }) => {
  iconList.value = record
  pagination.value.total = total
})
</script>

<template>
  <div class="h-full grid gap-2 grid-cols-[auto_1fr] grid-rows-[auto_1fr_auto]">
    <el-input v-model="iconQuery" placeholder="搜索名称..." class="col-span-2">
      <template #suffix>
        <el-icon :class="{ 'is-loading': loading }">
          <Loading v-if="loading" />
          <Search v-else />
        </el-icon>
      </template>
    </el-input>

    <div
      v-loading="loading"
      element-loading-text="加载中..."
      element-loading-background="var(--el-mask-color)"
      class="w-[256px] overflow-hidden flex justify-evenly content-evenly flex-wrap border border-[var(--el-border-color)]"
    >
      <div
        v-for="icon in iconList"
        :key="icon.id"
        class="icon-radio w-[48px] h-[48px] flex-shrink-0 p-1 grid place-items-center"
        :class="[modelValue?.id === icon.id ? 'actived' : 'cursor-pointer']"
        :title="icon.url || '<url>'"
        @click="() => activeImage(icon)"
      >
        <img
          :src="icon.url"
          class="w-full h-full aspect-square object-contain"
          draggable="false"
          crossorigin=""
        />
      </div>
      <div
        v-for="i in 25 - iconList.length"
        :key="i"
        class="w-[48px] h-[48px] pointer-events-none"
      />
    </div>

    <div class="w-full h-full flex flex-col justify-between overflow-hidden">
      <el-divider style="margin: 0 0 8px" />
      <div
        class="w-full h-[23px] overflow-hidden text-xs text-center leading-[23px] whitespace-nowrap text-ellipsis"
        :title="modelValue?.tag"
      >
        {{ modelValue ? `id: ${modelValue.id}` : '<选择图标>' }}
      </div>
      <el-divider style="margin: 8px 0 0" />

      <div class="flex-1 grid place-items-center place-content-center gap-1">
        <div class="w-16 h-16 border border-[var(--el-border-color)] box-content">
          <img
            v-if="modelValue"
            :src="modelValue.url"
            class="w-full h-full object-contain"
            draggable="false"
            crossorigin=""
          />
        </div>
        <div class="text-xs">
          {{
            isLoading ? 'loading...' : state.size ? `${state.size[0]} x ${state.size[1]} px` : ''
          }}
        </div>
      </div>
    </div>

    <el-pagination
      v-model:current-page="pagination.current"
      :total="pagination.total"
      :page-size="pagination.pageSize"
      :pager-count="5"
      :layout="layout"
      background
      size="small"
      class="flex justify-end col-span-2"
      @current-change="updateIconList"
    >
      <div>{{ pagination.current }} / {{ Math.ceil(pagination.total / pagination.pageSize) }}</div>
    </el-pagination>
  </div>
</template>

<style scoped>
.icon-radio {
  &:not(.actived):not(.error):not(.loading):hover {
    &:hover {
      background: var(--el-color-primary-light-7);
    }
    &:active {
      background: var(--el-color-primary-light-5);
    }
  }

  &.error {
    background: var(--el-color-danger-light-7);
    cursor: not-allowed;
  }

  &.actived {
    background: var(--el-color-primary);
  }
}
</style>
