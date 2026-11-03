<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    history?: string
    current?: string
  }>(),
  {
    history: '',
    current: '',
  },
)

const start = computed(() => {
  if (!props.history) return [0, 0]
  return props.history.split(',').map(Number)
})

const end = computed(() => {
  if (!props.current) return [0, 0]
  return props.current.split(',').map(Number)
})

/** 计算移动矢量 */
const vector = computed(() => {
  const [x1, y1] = toValue(start)
  const [x2, y2] = toValue(end)
  return {
    angle: Math.atan((y2 - y1) / (x2 - x1)) || 0,
    length: Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2),
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="vector"
      :class="{
        'is-moved': vector.length > 0,
      }"
      :style="{ '--arrow-angle': vector.angle }"
    />
    <div class="flex flex-col text-xs">
      <div>移动矢量</div>
      <div :title="history">
        {{ `开始: X ${start[0].toFixed(2)}, Y ${start[1].toFixed(2)}` }}
      </div>
      <div :title="current">
        {{ `结束: X ${end[0].toFixed(2)}, Y ${end[1].toFixed(2)}` }}
      </div>
      <div>{{ `角度: ${((vector.angle * 180) / Math.PI).toFixed(2)}°` }}</div>
      <div>{{ `距离: ${vector.length.toFixed(2)}` }}</div>
    </div>
  </div>
</template>

<style scoped>
.vector {
  --draw-color: var(--el-text-color-secondary);

  width: 80px;
  height: 80px;
  border-radius: 40px;
  border: 1px solid var(--draw-color);
  background: radial-gradient(red 1px, transparent 1px);
  position: relative;
  overflow: hidden;

  &.is-moved::before {
    content: '';
    position: absolute;
    border-radius: 1px;
    width: 100%;
    height: 1px;
    left: 50%;
    top: 50%;
    border-top: 1px solid var(--el-color-danger);
    transform-origin: 0.5px 0.5px;
    transform: translate(-0.5px, -0.5px) rotate(calc(var(--arrow-angle) * 1rad));
  }
}
</style>
