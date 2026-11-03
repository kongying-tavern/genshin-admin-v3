<script lang="ts" setup>
import type { EditorProps } from './types'
import TextAlign from '@tiptap/extension-text-align'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { HeaderToolbar } from './components'
import { TextColor, TextSize } from './extensions'
import { Color, Size } from './marks'

const props = withDefaults(defineProps<EditorProps>(), {
  sizeRatio: 1,
  baseTextSize: 32,
  defaultForeground: '#000',
  defaultBackground: 'transparent',
  viewFont: '',
  viewZoom: 1,
  viewLineHeight: 1.2,
  readonly: false,
  scrollbarColor: '#FCFCFC',
  scrollbarWidth: '10px',
  scrollbarThumbColor: '#909399',
})

const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: '',
})

const editor = useEditor({
  content: modelValue.value,
  extensions: [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      hardBreak: false,
      heading: false,
      horizontalRule: false,
      listItem: false,
      code: false,
      codeBlock: false,
      orderedList: false,
      link: {
        protocols: ['http', 'https', 'ftp', 'sftp', 'ftps', 'mailto'],
        autolink: false,
        openOnClick: false,
        linkOnPaste: false,
      },
    }),
    TextAlign,
    TextColor,
    TextSize,
    Color,
    Size,
  ],
})

// StarterKit 引入了这两个组件，但是类型 merge 没生效。此处 hack 一下
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bold: {
      setBold: () => ReturnType
      toggleBold: () => ReturnType
      unsetBold: () => ReturnType
    }
    italic: {
      setItalic: () => ReturnType
      toggleItalic: () => ReturnType
      unsetItalic: () => ReturnType
    }
  }
}

watch(
  () => props.readonly,
  readonly => {
    editor.value?.setEditable(!readonly)
  },
)

watch(modelValue, newContent => {
  if (!editor.value) return
  if (editor.value.getHTML() === newContent) return
  editor.value.commands.setContent(newContent, {
    emitUpdate: false,
  })
})

onMounted(() => {
  const instance = editor.value
  if (!instance) return

  instance.on('update', ({ editor }) => {
    modelValue.value = editor.getHTML()
  })
  instance.setEditable(!props.readonly)
})
</script>

<template>
  <div
    v-if="editor"
    class="richtext-editor flex-1"
    :class="{
      'is-readonly': readonly,
    }"
  >
    <HeaderToolbar
      v-if="!readonly"
      :editor="editor"
      :base-size="baseTextSize / sizeRatio"
      :header-min="headerMin"
      :header-max="headerMax"
      :headers="headers"
    />
    <EditorContent class="editor-instance" :editor="editor" />
  </div>
</template>

<style scoped>
.richtext-editor {
  --sizeUnit: calc(v-bind('sizeRatio') * 1px);

  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color var(--el-transition-duration-fast)
    var(--el-transition-function-ease-in-out-bezier);

  &:not(.is-readonly) {
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-base);
  }

  &:hover {
    border-color: var(--el-border-color-hover);
  }

  &:focus-within {
    border-color: var(--el-color-primary);
  }
}

.editor-instance {
  flex: 1;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: v-bind('defaultBackground');

  &::-webkit-scrollbar {
    width: v-bind('scrollbarWidth');
    background-color: v-bind('scrollbarColor');
    border-radius: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: v-bind('scrollbarThumbColor');
    border-radius: 6px;
    border: 1px solid v-bind('scrollbarColor');
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, v-bind('scrollbarThumbColor') 90%, transparent 10%);
  }

  :deep(.tiptap) {
    --link-underline-color: #8cb4ff;
    --link-bg-color: #f5edd5;
    --link-bg-color-hover: #d5e0f7;

    outline: none;
    cursor: text;
    min-height: 100%;
    font-family: v-bind('viewFont');
    font-size: calc(v-bind('baseTextSize') * v-bind('viewZoom') * 1px);
    color: var(--el-text-color-primary);
    height: calc(v-bind('contentHeight') * v-bind('viewZoom') * 1px);
    line-height: v-bind('viewLineHeight');
    color: v-bind('defaultForeground');

    &[contenteditable='false'] {
      cursor: inherit;
    }

    p {
      margin: 0;
      padding: 0;
    }
    color {
      color: var(--color);
    }
    size {
      font-size: calc(
        var(--size, v-bind('baseTextSize') / v-bind('sizeRatio')) * v-bind('viewZoom') *
          var(--sizeUnit)
      );
    }
    a {
      cursor: pointer;
      text-decoration: underline dotted var(--link-underline-color);
      text-decoration-thickness: 3px;
      background-color: var(--link-bg-color);
      &:hover {
        text-decoration-style: dashed;
        background-color: var(--link-bg-color-hover);
      }
      &:focus,
      &:active {
        text-decoration: none;
        background-color: var(--link-underline-color);
        color: #fff;
      }
    }
    u {
      text-decoration: underline solid var(--link-underline-color);
      text-decoration-thickness: 3px;
    }
  }
}
</style>
