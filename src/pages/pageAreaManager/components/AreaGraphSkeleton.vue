<script lang="ts" setup>
const containerRef = ref<HTMLElement>()
const { width, height } = useElementSize(containerRef)

const DESIGN_W = 1180
const DESIGN_H = 560

const scale = computed(() => {
  if (!width.value || !height.value) return 1
  return Math.min(width.value / DESIGN_W, height.value / DESIGN_H, 1)
})

interface CardPos {
  x: number
  y: number
  hasChildren?: boolean
}

// 卡片尺寸与 useGraph 中保持一致：240 x 120，圆角 8
const cards: CardPos[] = [
  { x: 80, y: 220, hasChildren: true },
  { x: 470, y: 60, hasChildren: true },
  { x: 470, y: 220 },
  { x: 470, y: 380 },
  { x: 860, y: 20 },
  { x: 860, y: 100 },
]

// cubic-horizontal 连线，与 G6 compactBox LR 布局一致
const lines = [
  'M 320 280 C 395 280, 395 120, 470 120',
  'M 320 280 C 395 280, 395 280, 470 280',
  'M 320 280 C 395 280, 395 440, 470 440',
  'M 710 120 C 785 120, 785 80, 860 80',
  'M 710 120 C 785 120, 785 160, 860 160',
]
</script>

<template>
  <div ref="containerRef" class="absolute inset-0 z-10 overflow-hidden bg-[var(--el-bg-color)]">
    <el-skeleton class="w-full h-full" animated>
      <template #template>
        <div
          class="absolute left-1/2 top-1/2"
          :style="{
            width: `${DESIGN_W}px`,
            height: `${DESIGN_H}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }"
        >
          <svg :width="DESIGN_W" :height="DESIGN_H" class="absolute inset-0 overflow-visible">
            <path
              v-for="(d, i) in lines"
              :key="i"
              :d="d"
              stroke="var(--el-skeleton-color)"
              stroke-width="2"
              fill="none"
            />
          </svg>
          <div
            v-for="(card, i) in cards"
            :key="i"
            class="absolute"
            :style="{ left: `${card.x}px`, top: `${card.y}px` }"
          >
            <el-skeleton-item
              variant="rect"
              style="width: 240px; height: 120px; border-radius: 8px"
            />
            <div class="flex gap-2 mt-2">
              <el-skeleton-item
                variant="rect"
                style="width: 116px; height: 32px; border-radius: 8px"
              />
              <el-skeleton-item
                v-if="card.hasChildren"
                variant="rect"
                style="width: 72px; height: 32px; border-radius: 8px"
              />
            </div>
          </div>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>
