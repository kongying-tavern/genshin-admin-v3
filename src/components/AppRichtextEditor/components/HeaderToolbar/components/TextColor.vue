<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import ToolbarItem from './ToolbarItem.vue'

const props = defineProps<{
  editor: Editor
}>()

/** 缓存颜色数量限制 */
const COLOR_CACHE_LIMIT = 20

/** 缓存使用过的颜色 */
const cacheColorList = ref<string[]>([])

/** 当前颜色 */
const currentColor = computed(
  () => props.editor.getAttributes('color').color || 'var(--el-text-color-primary)',
)

const setColor = (color: string, done?: () => void) => {
  props.editor.chain().focus().setColor(color).run()
  done?.()

  const isCached = cacheColorList.value.find(cachedColor => cachedColor === color)
  if (isCached || !color) return

  if (cacheColorList.value.length >= COLOR_CACHE_LIMIT) cacheColorList.value.shift()

  cacheColorList.value.push(color)
}

const setCurrentColor = () => {
  setColor(currentColor.value)
}

const colorList: { label: string; color: string }[] = [
  { label: '深红色', color: '#C00000' },
  { label: '红色', color: '#FF0000' },
  { label: '橙色', color: '#FFC000' },
  { label: '黄色', color: '#FFFF00' },
  { label: '浅绿色', color: '#92D050' },
  { label: '深绿色', color: '#00B050' },
  { label: '红色', color: '#00B0F0' },
  { label: '浅蓝色', color: '#0070C0' },
  { label: '蓝色', color: '#002060' },
  { label: '紫色', color: '#7030A0' },
]
</script>

<template>
  <ToolbarItem title="字体颜色" :style="{ '--color': currentColor }" @click="setCurrentColor">
    <template #default>
      <div class="w-full h-full flex flex-col">
        <div class="flex-1 flex justify-center items-end text-xl leading-none">A</div>
        <div class="w-full h-2 bg-[var(--color)] bg-clip-content px-[5px] pb-1" />
      </div>
    </template>

    <template #dropdown="{ close }">
      <div
        class="bg-[var(--el-bg-color)] flex flex-col text-xs rounded p-2 px-3"
        style="box-shadow: var(--el-box-shadow-light)"
      >
        <div class="text-[var(--el-text-color-primary)] pb-2 px-1 font-bold">字体颜色</div>

        <div
          class="color-button flex gap-2 text-[var(--el-text-color-primary)]"
          title=""
          @click="() => setColor('', close)"
        >
          <div
            class="w-4 h-full outline outline-[1px] outline-gray-500 outline-offset-[-1px] bg-[var(--el-text-color-primary)]"
          />
          自动
        </div>

        <div class="color-divider" />

        <div class="text-[var(--el-text-color-primary)] pb-2 px-1 font-bold">标准颜色</div>

        <div class="flex">
          <div
            v-for="{ label, color } in colorList"
            :key="color"
            :title="label"
            class="color-button w-6 outline outline-[1px] outline-[var(--el-border-color)] outline-offset-[-5px]"
            @click="() => setColor(color, close)"
          >
            <div class="w-full h-full" :style="`background-color: ${color}`" />
          </div>
        </div>

        <div class="color-divider" />

        <div class="text-[var(--el-text-color-primary)] pb-2 px-1 font-bold">最近使用的颜色</div>

        <div class="flex">
          <div
            v-for="color in cacheColorList"
            :key="color"
            :title="color.toUpperCase()"
            class="color-button w-6 outline outline-[1px] outline-[var(--el-border-color)] outline-offset-[-5px]"
            @click="() => setColor(color, close)"
          >
            <div class="w-full h-full" :style="`background-color: ${color}`" />
          </div>
        </div>

        <div class="color-divider" />

        <div class="flex gap-2 text-[var(--el-text-color-primary)]">
          <input
            title=""
            class="color-picker cursor-pointer outline outline-[1px] outline-[var(--el-border-color)] outline-offset-[-1px]"
            type="color"
            @change="ev => setColor((ev.target as HTMLInputElement).value, close)"
          />
          自定义
        </div>
      </div>
    </template>
  </ToolbarItem>
</template>

<style scoped>
.color-button {
  cursor: pointer;
  height: 24px;
  padding: 4px;

  &:hover {
    background: var(--el-color-info-light-7);
  }

  &:active {
    background: var(--el-color-info-light-5);
  }
}

.color-divider {
  width: 100%;
  height: 1px;
  background: var(--el-border-color-darker);
  margin: 8px 0;
}

.color-picker {
  height: 16px;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  &::-webkit-color-swatch {
    border: none;
  }
}
</style>
