<script setup lang="ts">
import type { ModifyLinkOptions } from '../shared/types'
import type { GSMarkerInfo } from '@/packages/map'
import type { LinkActionEnum } from '@/shared'
import { Check, Close } from '@element-plus/icons-vue'
import LinkActionSelect from './LinkActionSelect.vue'
import LinkGroupViewer from './LinkGroupViewer.vue'
import MarkerInfo from './MarkerInfo.vue'

defineProps<{
  loading: boolean
  prevMarker?: GSMarkerInfo
  nextMarker?: GSMarkerInfo
  previewLinkGroups: Map<string, ModifyLinkOptions>
  containLinkGroups: Map<string, Map<string, ModifyLinkOptions>>
  tempContainLinkGroups: Map<string, Map<string, ModifyLinkOptions>>
}>()

defineEmits<{
  submit: []
  cancel: []
  delete: [linkKey: string, options: ModifyLinkOptions]
  extract: [linkKey: string, options: ModifyLinkOptions]
  revest: [linkKey: string, options: ModifyLinkOptions]
}>()

const linkAction = defineModel<LinkActionEnum>('linkAction', {
  required: true,
})

const hoverLinkKey = defineModel<string>('hoverLinkKey', {
  required: true,
})

const focusLinkKey = defineModel<string>('focusLinkKey', {
  required: true,
})

const merge = defineModel<boolean>('merge', {
  required: true,
})

const showDelete = defineModel<boolean>('showDelete', {
  required: true,
})
</script>

<template>
  <div
    class="w-full h-full overflow-hidden grid grid-cols-[1fr_auto_1fr] grid-rows-[auto_1fr_auto] justify-items-center text-sm"
  >
    <div class="w-full h-full col-span-3 grid grid-cols-[1fr_auto_1fr] place-items-center">
      <MarkerInfo :marker="prevMarker" placeholder="起始点" />
      <LinkActionSelect v-model="linkAction" />
      <MarkerInfo :marker="nextMarker" placeholder="终止点" reverse />
    </div>

    <LinkGroupViewer
      v-model:hover-key="hoverLinkKey"
      v-model:focus-key="focusLinkKey"
      title="修改前"
      :groups="containLinkGroups"
      :temp-groups="tempContainLinkGroups"
    />

    <div class="w-[1px] h-full bg-[var(--el-border-color)]" />

    <LinkGroupViewer
      v-model:hover-key="hoverLinkKey"
      v-model:focus-key="focusLinkKey"
      title="修改后"
      :append-group="previewLinkGroups"
      @delete="(...args) => $emit('delete', ...args)"
      @extract="(...args) => $emit('extract', ...args)"
      @revest="(...args) => $emit('revest', ...args)"
    />

    <div class="w-full shrink-0 col-span-3 flex p-2">
      <div class="flex-1 flex gap-2">
        <el-switch
          v-model="merge"
          inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
          active-text="合并原有关联"
          inactive-text="拆解原有关联"
        />
        <el-switch
          v-model="showDelete"
          inline-prompt
          active-text="显示删除项"
          inactive-text="隐藏删除项"
        />
      </div>

      <div class="shrink-0">
        <el-button :icon="Check" :loading="loading" @click="() => $emit('submit')">
          保存
        </el-button>
        <el-button :icon="Close" :disabled="loading" @click="() => $emit('cancel')">
          取消
        </el-button>
      </div>
    </div>
  </div>
</template>
