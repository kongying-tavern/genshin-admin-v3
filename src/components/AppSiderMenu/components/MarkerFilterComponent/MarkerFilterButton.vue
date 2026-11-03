<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    clickable?: boolean
    disabled?: boolean
    iconColor?: string
    theme?: 'light' | 'dark'
    title?: string
  }>(),
  {
    clickable: true,
    theme: 'light',
  },
)

const emits = defineEmits<{
  click: [MouseEvent]
}>()

const handleClick = (ev: MouseEvent) => {
  if (!props.clickable) return
  else if (props.disabled) return
  emits('click', ev)
}
</script>

<template>
  <div
    class="condition-unit"
    :title="title"
    :class="[clickable ? 'is-button' : '', disabled ? 'is-disabled' : '', `theme-${theme}`]"
    @click="handleClick"
  >
    <span v-if="$slots.icon" class="icon">
      <slot name="icon" />
    </span>
    <span v-if="$slots.default" class="text">
      <slot />
    </span>
  </div>
</template>

<style lang="scss" scoped>
.condition-unit {
  --height: 32px;
  --text-color: #313131;
  --text-color--active: var(--text-color);
  --bg-normal: #fff;
  --bg-btn: var(--bg-normal);
  --bg-btn--hover: var(--bg-btn);
  --bg-btn--active: #ffe796;
  --bg-btn--disabled: #6b6964;
  --outline-color: transparent;
  --outline-color--hover: #ffffff80;
  --outline-color--active: #00000020;
  --icon-size: 20px;
  --icon-color: v-bind('props.iconColor');
  --icon-bg-color: #ffffff80;

  flex-shrink: 0;
  padding: 0px 2px;
  height: 24px;
  min-width: 24px;
  max-width: 150px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  overflow: hidden;
  line-height: 24px;
  font-size: 14px;
  color: var(--text-color);
  background: var(--bg-normal);
  transition: all ease 150ms;
  outline: 2px solid var(--outline-color);
}

.is-button {
  user-select: none;
  cursor: pointer;
  background: var(--bg-btn, var(--bg-normal));

  &:not(.is-disabled):hover {
    outline-color: var(--outline-color--hover);
    background: var(--bg-btn--hover);
  }

  &:not(.is-disabled):active {
    color: var(--text-color--active);
    background: var(--bg-btn--active);
    outline-color: var(--outline-color--active);
  }

  &.is-disabled {
    cursor: not-allowed;
  }
}

.theme-dark {
  --text-color: #fff;
  --text-color--active: #313131;
  --bg-btn: #313131;
  --bg-btn--hover: #404040;
  --icon-bg-color: #313131;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--icon-color, var(--text-color));
  padding: 3px;
  width: var(--icon-size);
  height: var(--icon-size);
  border-radius: 50%;
  background-color: var(--icon-bg-color);
}

.text {
  flex: 1;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  padding: 0 4px;
}
</style>
