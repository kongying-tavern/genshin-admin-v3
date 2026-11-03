<script setup lang="ts">
const props = defineProps<{
  label: string
  divider?: boolean
  interactive?: boolean
  actived?: boolean
  disabled?: boolean
}>()

const emits = defineEmits<{
  click: [MouseEvent]
}>()

const handleClick = (ev: MouseEvent) => {
  if (props.disabled) return
  emits('click', ev)
}

const contextmenuVisible = ref(false)

const toggleContextmenuVisible = () => {
  contextmenuVisible.value = !contextmenuVisible.value
}

const contextmenuRef = ref<HTMLElement>()
onClickOutside(contextmenuRef, () => {
  contextmenuVisible.value = false
})
</script>

<template>
  <div
    class="bar-item"
    :class="{
      divider,
      disabled,
    }"
  >
    <div
      v-bind="$attrs"
      class="fontend"
      :data-label="label"
      @click="handleClick"
      @contextmenu.prevent="toggleContextmenuVisible"
    >
      <slot name="default" />
    </div>

    <div
      v-if="$slots.contextmenu"
      ref="contextmenuRef"
      class="contextmenu"
      :class="{
        'is-collapse': !contextmenuVisible,
      }"
    >
      <slot name="contextmenu" />
    </div>
  </div>
</template>

<style scoped>
.bar-item {
  --divider-gap: 6px;
  --fontend-opacity: 1;
  --fontend-cursor: pointer;
  --fontend-mask: unset;

  position: relative;

  &:not(.divider):not(:last-of-type) {
    margin-right: 2px;
  }

  &.disabled {
    --fontend-opacity: 0.5;
    --fontend-cursor: not-allowed;
    --fontend-mask: transparent;
  }

  &.divider:not(:last-of-type) {
    margin-right: var(--divider-gap);
    &::before {
      content: '';
      position: absolute;
      height: 90%;
      width: var(--divider-gap);
      background: linear-gradient(
        90deg,
        transparent 0 calc(50% - 0.5px),
        #ffffff40 calc(50% - 0.5px) calc(50% + 0.5px),
        transparent calc(50% + 0.5px) 100%
      );
      right: calc(0px - var(--divider-gap));
      top: 0;
      translate: 0 5%;
      pointer-events: none;
    }
  }
}

.fontend {
  --mask-color: transparent;

  cursor: var(--fontend-cursor);
  user-select: none;
  height: 32px;
  min-width: 32px;
  font-size: 12px;
  opacity: var(--fontend-opacity);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 2px;
    pointer-events: none;
    background-color: var(--fontend-mask, var(--mask-color));
    transition: all ease 150ms;
  }

  &:hover {
    --mask-color: #ffffff20;
  }

  &:active {
    --mask-color: #ffffff40;
  }
}

.contextmenu {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);

  &.is-collapse {
    opacity: 0;
    pointer-events: none;
  }
}
</style>
