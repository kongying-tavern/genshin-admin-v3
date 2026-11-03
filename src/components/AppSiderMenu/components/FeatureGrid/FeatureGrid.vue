<script lang="ts" setup>
import type { FeatureGroupOption } from '.'

defineProps<{
  features: FeatureGroupOption[]
}>()
</script>

<template>
  <el-scrollbar height="100%">
    <div
      class="feature-grid w-[350px] max-w-full p-3 h-full overflow-hidden flex flex-col gap-4 font-[HYWenHei-85W]"
    >
      <div
        v-for="featureGroup in features"
        :key="featureGroup.label"
        class="grid grid-cols-3 gap-2"
      >
        <div v-if="featureGroup.label" class="col-span-3 text-white">
          {{ featureGroup.label }}
        </div>

        <div
          v-for="feature in featureGroup.items"
          :key="feature.label"
          :style="{ '--cols': feature.cols }"
          :class="{ 'is-opened': feature.hook?.isOpen.value }"
          class="grid-unit"
          @click="() => feature.cb()"
        >
          <div class="grid-unit-icon">
            <component :is="feature.icon" class="h-full" />
          </div>
          <div class="grid-unit-label">
            <span
              class="w-full inline-block whitespace-nowrap text-ellipsis overflow-hidden text-center"
            >
              {{ feature.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped>
.feature-grid {
  --base-size: 100px;
  --transition: all ease-out 100ms;
  container-type: inline-size;
  container-name: feature;
}

@media screen and (max-width: 400px) {
  .feature-grid {
    --base-size: 80px;
  }
}

@keyframes jump-loop {
  0% {
    translate: 0 0;
  }
  50% {
    translate: 0 4px;
  }
  100% {
    translate: 0 0;
  }
}

.grid-unit {
  --bg: #565f6f;
  --radius: 4px;
  --border-scale: 0.95;
  --outline-color: transparent;
  --inner-offset: -2px;
  --border-color: #e4ddd140;
  --arrow-visible: hidden;

  padding: 2.5%;
  min-width: var(--base-size);
  height: var(--base-size);
  display: grid;
  align-content: center;
  justify-items: center;
  grid-template-rows: repeat(6, 1fr);
  background: var(--bg);
  position: relative;
  color: #ece5d8;
  outline: 2px solid var(--outline-color);
  border-radius: var(--radius);
  user-select: none;
  transition: var(--transition);
  grid-column: span var(--cols, 1);

  &:not(.is-opened) {
    cursor: pointer;
  }

  &:not(.is-opened):hover {
    --outline-color: #f4e3c0;
    --arrow-visible: visible;
    --inner-offset: 0px;
    filter: drop-shadow(0 0 4px rgb(80 80 80 / 0.6));
  }

  &:not(.is-opened):active {
    --outline-color: transparent;
    --bg: #fefefd;
    --border-color: #565f6f40;
    --arrow-visible: hidden;
    color: #454f66;
    filter: drop-shadow(0 0 0 rgb(80 80 80 / 0.6));
  }

  &.is-opened {
    --outline-color: transparent;
    --bg: #fefefd;
    --border-color: #565f6f40;
    --arrow-visible: hidden;
    color: #454f66;
  }

  /* hover 选框 */
  &:not(.is-opened)::before {
    content: '';
    border-radius: var(--radius);
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    outline: 2px solid var(--border-color);
    outline-offset: var(--inner-offset);
    pointer-events: none;
    transition: var(--transition);
  }

  /* 箭头指示器 */
  &:not(.is-opened)::after {
    visibility: var(--arrow-visible);
    content: '';
    position: absolute;
    left: calc(50% - 5px);
    width: 12px;
    aspect-ratio: 1 / 1;
    background: conic-gradient(from -45deg, #fff 90deg, transparent 90deg);
    animation: jump-loop 1s infinite;
    filter: drop-shadow(0 0 4px #fff);
    pointer-events: none;
  }
}

.grid-unit-icon {
  width: 100%;
  grid-row-start: span 4;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 8px 12px;
}

.grid-unit-label {
  width: 100%;
  grid-row-start: span 2;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
</style>
