<script lang="ts" setup>
import type { InputInstance } from 'element-plus'
import type { MarkerItemLinkVo } from '@/api/alova/globals'
import { Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useDadianStore, useItemStore } from '@/stores'
import { AddonTeleporter } from '.'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    addonId: string
    itemList?: MarkerItemLinkVo[]
  }>(),
  {
    itemList: () => [],
  },
)

const emits = defineEmits<{
  (e: 'update:modelValue', v?: string): void
  (e: 'update:addonId', v: string): void
}>()

const dadianStore = useDadianStore()
const itemStore = useItemStore()

const isAddonActived = computed({
  get: () => props.addonId === 'content',
  set: v => emits('update:addonId', v ? 'content' : ''),
})

const internalBind = computed({
  get: () => props.modelValue ?? '',
  set: v => emits('update:modelValue', v),
})

const conditionIds = computed(() => new Set(props.itemList.map(({ itemId }) => itemId!)))

/** 根据已选物品 id 从数据库获取对应的物品对象 */
const selectedItems = computed(() => {
  return itemStore.itemList.filter(({ id }) => conditionIds.value.has(id!))
})

// ==================== 将填充字符插入到已有的文本中 ====================
/** 快捷标点 */
const characters = computed(() => dadianStore.raw.editor?.quickInputSnippets ?? [])

/** 选区 */
const selection = reactive({ start: 0, end: 0 })
const selectionStart = ref<number>()
const selectionEnd = ref<number>()

// TODO 这里的选区信息只在点击填充标签的时候需要，在离开输入区点击其他组件时必然会触发 blur 事件，理论上只需要注册 onblur 事件就行了
const updateSelectionState = (ev: Event) => {
  const target = ev.target as HTMLTextAreaElement
  selection.start = target.selectionStart
  selection.end = target.selectionEnd
  selectionStart.value = target.selectionStart
  selectionEnd.value = target.selectionEnd
}

const addonInputRef = ref<InputInstance | null>(null)

const insertChar = async (char: string, newline = false) => {
  const textarea = addonInputRef.value?.textarea
  if (!textarea) return
  if (newline) {
    internalBind.value = `${internalBind.value}\n${char}`.trim()
    return
  }
  let start = selectionStart.value
  let end = selectionEnd.value
  if (start === undefined || end === undefined) {
    ElMessage.warning('未记录到光标位置，请选择想要插入到的文本位置')
    return
  }
  const charArray = internalBind.value?.split('')
  charArray.splice(start, end - start, char)
  internalBind.value = charArray.join('')
  start += char.length
  end = start
  await addonInputRef.value?.focus()
  textarea.setSelectionRange(start, end)
}

// ==================== 自适应 textarea 行高 ====================
const textareaContainerRef = ref<HTMLElement>()
const { height } = useElementSize(textareaContainerRef)
const textareaRows = computed(() => Math.floor((height.value - 20) / 21))
</script>

<template>
  <div class="w-full flex flex-col gap-1">
    <div class="flex gap-1">
      <el-input
        v-model="internalBind"
        type="textarea"
        resize="none"
        :rows="3"
        @blur="updateSelectionState"
      />
      <el-button
        :icon="Setting"
        :type="isAddonActived ? 'primary' : ''"
        title="点位说明"
        circle
        @click="isAddonActived = !isAddonActived"
      />
    </div>

    <AddonTeleporter :active="isAddonActived">
      <div class="h-full flex flex-col gap-2">
        <div class="flex">
          <div class="whitespace-nowrap">快捷标点：</div>
          <el-button-group size="small">
            <el-button v-for="c in characters" :key="c" @click="() => insertChar(c)">
              {{ c }}
            </el-button>
          </el-button-group>
        </div>
        <div class="flex">
          <div class="whitespace-nowrap">描述模板：</div>
          <el-button-group size="small">
            <el-button
              v-for="item in selectedItems"
              :key="item.id"
              :title="item.defaultContent"
              @click="() => insertChar(item.defaultContent ?? '')"
            >
              {{ item.name }}
            </el-button>
          </el-button-group>
        </div>
        <div ref="textareaContainerRef" class="flex-1">
          <el-input
            ref="addonInputRef"
            v-model="internalBind"
            class="font-['SarasaMono']"
            type="textarea"
            resize="none"
            :rows="textareaRows"
            @blur="updateSelectionState"
          />
        </div>
      </div>
    </AddonTeleporter>
  </div>
</template>
