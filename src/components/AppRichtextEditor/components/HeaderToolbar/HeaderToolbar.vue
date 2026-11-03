<script setup lang="ts">
import type { HeaderToolbarProps } from '../../types'
import { Link } from '@element-plus/icons-vue'
import { TextColor } from './components'
import ToolbarItem from './components/ToolbarItem.vue'

const props = withDefaults(defineProps<HeaderToolbarProps>(), {
  baseSize: 32,
  headerMin: 1,
  headerMax: 6,
})

// ==================== 字体尺寸 ====================
const size = controlledRef<number>(props.baseSize, {
  onBeforeChange: value => {
    if (Number.isNaN(Number(value))) return false
    return true
  },
  onChanged: value => {
    return Number(value)
  },
})

const isInternalChange = ref(false)

watch(
  () => props.editor.getAttributes('size').size,
  newSize => {
    if (!newSize) {
      size.value = props.baseSize
      return
    }
    size.value = Number(newSize)
  },
)

const setSize = (value: number) => {
  isInternalChange.value = true
  props.editor.chain().focus().setSize(value).run()
}

const sizeAliasList = computed(() => {
  const sizeAliasFullList = [
    { level: 1, sizeFactor: 2 },
    { level: 2, sizeFactor: 1.5 },
    { level: 3, sizeFactor: 1.2 },
    { level: 4, sizeFactor: 1 },
    { level: 5, sizeFactor: 0.8 },
    { level: 6, sizeFactor: 0.6 },
  ]

  if (props.headers && Array.isArray(props.headers) && props.headers.length > 0)
    return sizeAliasFullList.filter(alias => props.headers?.includes(alias.level))

  if (
    props.headerMin
    && props.headerMax
    && Number.isFinite(props.headerMin)
    && Number.isFinite(props.headerMax)
    && props.headerMin <= props.headerMax
  ) {
    return sizeAliasFullList.slice(props.headerMin - 1, props.headerMax)
  }

  return []
})

// ==================== 文字链接 ====================
const setLink = () => {
  const previousUrl = props.editor.getAttributes('link').href
  const url = window.prompt('请输入链接，清空链接为删除链接', previousUrl) // oxlint-disable-line no-alert

  // 取消弹窗
  if (url === null) return
  // empty
  if (url === '') {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  props.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}
</script>

<template>
  <div class="header-toolbar">
    <ToolbarItem plain title="字号">
      <el-input
        v-model="size"
        style="width: 60px"
        @blur="() => setSize(size)"
        @keydown.enter="() => setSize(size)"
      />
    </ToolbarItem>

    <ToolbarItem
      title="加粗"
      class="font-mono text-xl"
      :is-active="editor.isActive('bold')"
      @click="() => editor.chain().focus().toggleBold().run()"
    >
      B
    </ToolbarItem>

    <ToolbarItem
      title="斜体"
      class="italic font-mono text-xl"
      :is-active="editor.isActive('italic')"
      @click="() => editor.chain().focus().toggleItalic().run()"
    >
      I
    </ToolbarItem>

    <ToolbarItem
      title="下划线"
      class="underline font-mono text-xl"
      :is-active="editor.isActive('underline')"
      @click="() => editor.chain().focus().toggleUnderline().run()"
    >
      U
    </ToolbarItem>

    <ToolbarItem
      title="超链接"
      class="text-xl"
      :is-active="editor.isActive('link')"
      @click="setLink"
    >
      <el-icon>
        <Link />
      </el-icon>
    </ToolbarItem>

    <TextColor :editor="editor" />

    <ToolbarItem
      v-for="sizeAlias in sizeAliasList"
      :key="sizeAlias.level"
      @click="() => setSize(baseSize * sizeAlias.sizeFactor)"
    >
      <span class="font-bold text-base"
        >H<sub class="inline-block scale-[0.9]">{{ sizeAlias.level }}</sub></span
      >
    </ToolbarItem>
  </div>
</template>

<style scoped>
.header-toolbar {
  display: flex;
  background-color: var(--el-fill-color-light);
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color);
}
</style>
