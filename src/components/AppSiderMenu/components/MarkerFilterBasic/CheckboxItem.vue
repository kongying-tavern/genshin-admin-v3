<script lang="ts" setup generic="R extends unknown = unknown">
defineProps<{
  label?: string
  isActived: boolean
  props?: R
  draggable?: boolean
}>()
</script>

<template>
  <div
    :class="{ actived: isActived }"
    :draggable="draggable ? 'true' : 'false'"
    class="checkbox-item"
    v-bind="$attrs"
  >
    <div v-if="$slots.icon" class="checkbox-item__icon">
      <slot name="icon" :props="props" :actived="isActived" />
    </div>

    <slot name="default" :props="props" :actived="isActived">
      <div class="checkbox-item__content" :class="{ 'no-icon': !$slots.icon }" :title="label">
        <div class="label-wrapper">
          {{ label }}
        </div>
      </div>
    </slot>
  </div>
</template>

<style lang="scss" scoped>
.checkbox-item {
  --outline-color: #e3ddd180;
  --outline-width: 2px;
  --outline-offset: calc(0px - var(--outline-width));
  --color: #e4ddd1;
  --item-height: 48px;
  --item-bg: transparent;
  --icon-bg: color-mix(in srgb, #fff 20%, #263240);

  height: var(--item-height);
  margin: 2px;
  display: flex;
  align-items: center;
  position: relative;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color);
  background-color: var(--item-bg);
  outline-offset: var(--outline-offset);
  outline: var(--outline-width) solid var(--outline-color);
  transition:
    all ease 150ms,
    outline-offset linear 50ms;
  border-radius: 6px;
  user-select: none;

  &:hover {
    --outline-color: #f3eee6;
    outline-offset: 0px;
  }
  &:active {
    outline-offset: var(--outline-offset);
  }
  &.actived {
    --color: #263240;
    --item-bg: #e4ddd1;
    --icon-bg: color-mix(in srgb, #fff 60%, #263240);
  }
}

.checkbox-item__icon {
  height: 100%;
  aspect-ratio: 1 / 1;
  padding: 8px;
  display: grid;
  background-color: var(--icon-bg);
  place-items: center;
  transition: all ease 150ms;
  pointer-events: none;
}

.checkbox-item__content {
  width: 100%;
  height: 100%;
  padding: 6px;
  line-height: calc(1em + 2px);
  overflow: hidden;

  &.no-icon {
    padding: 8px 16px;
  }
}

.label-wrapper {
  text-align: left;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  overflow: hidden;
}
</style>
