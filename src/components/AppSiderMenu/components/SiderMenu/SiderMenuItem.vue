<script lang="ts" setup>
import { Grid } from '@element-plus/icons-vue'
import { contentRefKey, tabNameRefKey } from '.'

const props = defineProps<{
  label?: string
  name?: string
  icon?: Component
}>()

const emits = defineEmits<{
  (e: 'click', v: MouseEvent): void
}>()

const contentRef = inject(contentRefKey, ref())
const tabNameRef = inject(tabNameRefKey, ref())

const actived = computed(() => tabNameRef.value === props.name)

const activeTab = (ev: MouseEvent) => {
  emits('click', ev)
  if (!props.name) return
  tabNameRef.value = props.name
}
</script>

<template>
  <div
    class="sider-menu-tab"
    :class="{ actived }"
    :data-tab-label="label"
    @click="ev => activeTab(ev)"
  >
    <slot name="tab">
      <div class="sider-menu-tab-button">
        <slot name="icon" color="var(--icon-color)">
          <component :is="icon ?? Grid" style="color: var(--icon-color)" />
        </slot>
      </div>
    </slot>
    <Teleport v-if="contentRef && tabNameRef === name" :to="contentRef">
      <slot name="default" />
    </Teleport>
  </div>
</template>

<style scoped>
.sider-menu-tab {
  --icon-padding: 5px;
  --icon-color: #d3bc8e;
  --scale: 1;
  --button-bg: transparent;

  width: 72px;
  height: 72px;
  padding: 12px;

  &:hover {
    --scale: 1.1;
    --button-bg: #3b4554;
    --icon-color: #ece5d8;
  }
  &:active,
  &.actived {
    --button-bg: #ece5d8;
    --icon-color: #3b4255;
  }
}

.sider-menu-tab-button {
  width: 100%;
  height: 100%;
  padding: var(--icon-padding);
  scale: var(--scale);
  border-radius: 50%;
  background: var(--button-bg);
  transition: all ease 150ms;
}
</style>
