<script setup lang="ts">
import { Check, Close, Delete, RefreshLeft } from '@element-plus/icons-vue'
import { useSubscription } from '@vueuse/rxjs'
import { ElAlert, ElButton } from 'element-plus'
import { filter, tap } from 'rxjs'
import { WinDialog, WinDialogFooter } from '@/components/WinUI'
import { CONTROL_KEYS, globalKeydown$, KEYBOARD_ALIAS, STANDARD_KEYBOARD_KEYS } from '@/shared'
import { useArchiveStore, useShortcutStore } from '@/stores'
import { ShortcutKeyUtil } from '@/utils'

const props = withDefaults(
  defineProps<{
    defaultValue?: string
    focusElement?: HTMLElement
  }>(),
  {
    defaultValue: undefined,
    focusElement: undefined,
  },
)

const shortcutStore = useShortcutStore()
const archiveStore = useArchiveStore()

const existKeys = computed(() => {
  return Object.entries(archiveStore.currentArchive.body.Preference)
    .filter(([key]) => key.startsWith('app.shortcutKey'))
    .reduce((set, [_, value]) => {
      if (typeof value !== 'string' || !value) return set
      set.add(value)
      return set
    }, new Set<string>())
})

onBeforeMount(() => {
  shortcutStore.isPaused = true
})

onBeforeUnmount(() => {
  shortcutStore.isPaused = false
})

const visible = defineModel<boolean>('visible', {
  required: true,
})

/** 格式: `'ctrl_alt_p'` */
const modelValue = defineModel<string>('modelValue', {
  required: false,
  default: '',
})

const shortcutKeys = shallowRef<string[]>(ShortcutKeyUtil.parse(modelValue.value))

const shortcutValue = computed(() => ShortcutKeyUtil.stringify(shortcutKeys.value))

const clearDisabled = computed(() => !shortcutKeys.value.length)
const clear = () => {
  shortcutKeys.value = []
}

const isResetDisabled = computed(
  () => props.defaultValue === undefined || shortcutValue.value === props.defaultValue,
)
const reset = () => {
  if (props.defaultValue === undefined) return
  shortcutKeys.value = ShortcutKeyUtil.parse(props.defaultValue)
}

/** 校验 */
const error = computed(() => {
  if (!shortcutKeys.value.length) return ''

  const firstKey = shortcutKeys.value[0]
  if (!props.focusElement && !CONTROL_KEYS.has(firstKey)) return '开始键只能为 Ctrl、Shift 或 Alt'

  const lastKey = shortcutKeys.value.at(-1) ?? ''
  if (CONTROL_KEYS.has(lastKey)) return '缺少终止键'

  if (shortcutValue.value !== modelValue.value && existKeys.value.has(shortcutValue.value))
    return '按键冲突'

  return ''
})

const isSaveDisabled = computed(() => Boolean(error.value))
const save = () => {
  modelValue.value = ShortcutKeyUtil.stringify(shortcutKeys.value)
  visible.value = false
}

const cancel = () => {
  visible.value = false
}

useSubscription(
  globalKeydown$
    .pipe(
      filter(ev => !ev.repeat && STANDARD_KEYBOARD_KEYS.has(ev.key.toLowerCase())),
      tap(ev => {
        ev.preventDefault()
      }),
    )
    .subscribe(ev => {
      const hotKeys: string[] = []
      const { ctrlKey, shiftKey, altKey, key } = ev
      const lowerCaseKey = key.toLowerCase()
      ctrlKey && hotKeys.push('control')
      shiftKey && hotKeys.push('shift')
      altKey && hotKeys.push('alt')
      !CONTROL_KEYS.has(lowerCaseKey) && hotKeys.push(lowerCaseKey)
      shortcutKeys.value = hotKeys
    }),
)
</script>

<template>
  <WinDialog class="w-[400px]">
    <div class="bg-[var(--el-fill-color-blank)] p-4">
      <div class="text-xl">激活快捷键</div>

      <div class="text-sm">按组合键以更改此快捷键</div>

      <div class="my-2">
        <div class="py-10 box-content flex gap-2 justify-center h-8">
          <div v-for="key in shortcutKeys" :key="key" class="keyboard-key">
            {{ KEYBOARD_ALIAS.get(key) }}
          </div>
        </div>

        <ElAlert
          v-if="error"
          type="error"
          :title="error"
          :closable="false"
          show-icon
          style="margin-top: 16px"
        />
      </div>

      <div class="text-xs mb-1">
        {{
          props.focusElement
            ? '该功能指定了聚焦元素，可以设置单按键快捷键'
            : '只有以 Ctrl、Alt 或 Shift 开头的快捷键才有效。'
        }}
      </div>

      <div class="text-xs text-[var(--el-text-color-secondary)]">
        <p class="mb-1">提示：</p>
        <p>
          1. 受浏览器限制，Web 按键事件优先级低于本地应用，在本地应用触发快捷键组合的情况下，Web
          可能无法收到对应的按键事件。
        </p>
        <p>2. 设置当前快捷键时，将会暂停其他快捷键的触发。</p>
      </div>
    </div>

    <WinDialogFooter>
      <ElButton :icon="Delete" text type="danger" :disabled="clearDisabled" @click="clear">
        清除
      </ElButton>

      <ElButton :icon="RefreshLeft" :disabled="isResetDisabled" @click="reset"> 默认 </ElButton>

      <ElButton :icon="Check" :disabled="isSaveDisabled" @click="save"> 保存 </ElButton>

      <ElButton :icon="Close" @click="cancel"> 取消 </ElButton>
    </WinDialogFooter>
  </WinDialog>
</template>

<style scoped>
.keyboard-key {
  @apply w-fit
    px-3
    leading-8
    text-base text-[var(--el-text-color-primary)]
    font-mono
    bg-[var(--el-color-primary-light-7)]
    rounded;
}
</style>
