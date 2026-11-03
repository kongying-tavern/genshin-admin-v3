<script setup lang="ts">
import type { IconVo, SysUserVo } from '@/api/alova/globals.js'
import { Delete } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useFetchHook, useGlobalDialog } from '@/hooks'
import { useIconStore } from '@/stores'
import { formatByteSize } from '@/utils'
import IconDeleteConfirm from './IconDeleteConfirm.vue'
import IconEditor from './IconEditor.vue'

const emits = defineEmits<{
  refresh: []
}>()

const iconStore = useIconStore()

const { DialogService } = useGlobalDialog()

const iconId = defineModel<number | undefined>('iconId', {
  default: undefined,
})

const icon = computed(() => {
  if (!iconId.value) return
  return iconStore.idMap.get(iconId.value)
})

// ==================== 用户信息 ====================
const userCache = ref<Record<number, SysUserVo>>({})

const {
  refresh: getUserInfo,
  loading: isUserInfoLoading,
  onSuccess,
} = useFetchHook<SysUserVo[], [userIds: number[]]>({
  onRequest: (userIds: number[]) =>
    Promise.all(
      [...new Set(userIds)].reduce((seed, userId) => {
        if (userCache.value[userId] === undefined) {
          seed.push(
            Apis.user
              .getUserInfo({ pathParams: { userId } })
              .then(({ data = {} }) => data)
              .catch(() => ({ id: userId }) as SysUserVo),
          )
        }
        return seed
      }, [] as Promise<SysUserVo>[]),
    ),
})

watch(
  () => icon.value,
  icon => {
    if (!icon) return
    const ids = new Set<number>()
    icon.creatorId && ids.add(icon.creatorId)
    icon.updaterId && ids.add(icon.updaterId)
    getUserInfo([...ids])
  },
)

const {
  state,
  isLoading,
  execute: refreshIconMeta,
} = useAsyncState<{ url?: string; size?: number[]; byteLength?: number }>(
  async () => {
    if (!icon.value?.url) return {}
    const res = await fetch(icon.value.url)
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    return {
      url: icon.value.url,
      byteLength: blob.size,
      size: [bmp.width, bmp.height],
    }
  },
  {},
  { immediate: false },
)

onSuccess(userInfos =>
  userInfos.forEach(userInfo => {
    userCache.value[userInfo.id!] = userInfo
  }),
)

// ==================== 图标信息 ====================

/** 用于预览的变体 */
const previewVariant = ref('')

const toggleVariant = (name: string, bool: boolean) => {
  if (bool) previewVariant.value = name
  else previewVariant.value = ''
}

watch(
  () => icon.value,
  () => {
    refreshIconMeta()
    previewVariant.value = ''
  },
  { immediate: true },
)

// ==================== 修改图标 ====================
const showIconEditor = () => {
  if (!icon.value) return
  DialogService.props({
    icon: icon.value,
  })
    .listeners({
      success: () => {
        emits('refresh')
      },
    })
    .open(IconEditor)
}

// ==================== 删除图标 ====================
const showIconDeleteConfirm = (icon: IconVo) => {
  DialogService.props({
    title: '删除地区',
    icon,
  })
    .listeners({
      success: () => {
        emits('refresh')
      },
    })
    .open(IconDeleteConfirm)
}

// ==================== 其他 ====================
const timeFormatter = (time?: string) => {
  if (!time) return ''
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const vatiantLabelRecord: Record<string, string> = {
  default: '默认',
  active: '已激活',
  inactive: '未激活',
}

// 图标变体
const variants = computed(() => {
  const list: string[] = []
  if (icon.value?.urlVariants?.active) list.push('active')
  if (icon.value?.urlVariants?.inactive) list.push('inactive')
  return list
})
</script>

<template>
  <div
    element-loading-text="操作中..."
    element-loading-background="var(--el-overlay-color-lighter)"
    class="icon-previewer h-full"
  >
    <div v-if="!icon" class="w-64 h-full grid place-items-center">选择要预览的图标</div>

    <div v-else class="w-64 h-full overflow-auto flex flex-col">
      <div v-if="!iconStore.iconCoordMap.get(icon.id!)" class="icon-image h-64" />

      <div
        v-else
        class="icon-image h-64 grid place-items-center overflow-hidden flex-shrink-0 relative"
      >
        <el-tag v-if="previewVariant" class="absolute left-1 top-1">
          变体: {{ vatiantLabelRecord[previewVariant] }}
        </el-tag>
        <img
          :src="previewVariant ? icon.urlVariants?.[previewVariant] : icon.url"
          class="hover:bg-[var(--el-color-primary)] max-w-full max-h-full object-contain"
          crossorigin=""
          draggable="false"
        />
      </div>

      <div class="icon-detail flex-1 px-2">
        <el-form label-width="70px" label-position="left" :model="icon">
          <el-form-item label-width="0px" class="margin-bottom-0">
            <el-button class="flex-1" @click="showIconEditor"> 编辑图标信息 </el-button>
            <el-button
              type="danger"
              plain
              :icon="Delete"
              @click="() => showIconDeleteConfirm(icon!)"
            />
          </el-form-item>

          <el-form-item label="名称" class="margin-bottom-0">
            <el-text truncated>
              {{ JSON.stringify(icon.tag).slice(1, -1) }}
            </el-text>
          </el-form-item>

          <el-form-item label="图片 id" class="margin-bottom-0">
            <el-text>
              {{ icon.id }}
            </el-text>
          </el-form-item>

          <el-form-item label="分辨率" class="margin-bottom-0">
            <el-text v-if="isLoading" type="warning"> 加载中... </el-text>
            <el-text v-else-if="!state.size" type="danger"> 加载失败 </el-text>
            <el-text v-else>
              {{ `${state.size[0]} x ${state.size[1]}` }}
            </el-text>
          </el-form-item>

          <el-form-item label="文件大小" class="margin-bottom-0">
            <el-text v-if="isLoading" type="warning"> 加载中... </el-text>
            <el-text v-else-if="!state.byteLength" type="danger"> 加载失败 </el-text>
            <el-text v-else>
              {{ formatByteSize(state.byteLength ?? 0) }}
            </el-text>
          </el-form-item>

          <el-form-item label="描述" class="margin-bottom-0">
            <el-text>{{ icon.description }}</el-text>
          </el-form-item>

          <el-form-item label="变体" class="margin-bottom-0">
            <div class="w-full flex gap-1">
              <el-check-tag
                v-for="variant in variants"
                :key="variant"
                :checked="previewVariant === variant"
                type="success"
                size="small"
                disable-transitions
                @update:checked="bool => toggleVariant(variant, bool)"
              >
                {{ vatiantLabelRecord[variant] }}
              </el-check-tag>
            </div>
          </el-form-item>

          <el-divider style="margin: 8px 0" />

          <el-form-item label="创建人" class="margin-bottom-0">
            <el-text truncated>
              {{ isUserInfoLoading ? '...' : userCache[icon.creatorId ?? -1]?.nickname }} (id:{{
                icon.creatorId
              }})
            </el-text>
          </el-form-item>

          <el-form-item label="创建时间" class="margin-bottom-0">
            <el-text>{{ timeFormatter(icon.createTime) }}</el-text>
          </el-form-item>

          <el-form-item label="最后修改" class="margin-bottom-0">
            <el-text truncated>
              {{ isUserInfoLoading ? '...' : userCache[icon.updaterId ?? -1]?.nickname }} (id:{{
                icon.updaterId
              }})
            </el-text>
          </el-form-item>

          <el-form-item label="修改时间" class="margin-bottom-0">
            <el-text>{{ timeFormatter(icon.updateTime) }}</el-text>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.margin-bottom-0 {
  margin-bottom: 0;
}

.icon-previewer {
  overflow: hidden;
}

.icon-image {
  --s: 32px;

  --color-a: transparent;
  --color-b: var(--el-fill-color-darker);

  border: 8px solid transparent;
  background: conic-gradient(
    from 0deg at 50% 50%,
    var(--color-a) 25%,
    var(--color-b) 25%,
    var(--color-b) 50%,
    var(--color-a) 50%,
    var(--color-a) 75%,
    var(--color-b) 75%,
    var(--color-b) 100%
  );
  background-size: var(--s) var(--s);
  background-clip: padding-box;
}

.image-box {
  background: var(--bg);
  background-position: var(--x) var(--y);
  scale: 2;
}
</style>
