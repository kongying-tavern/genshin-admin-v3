<script lang="ts" setup>
export interface GSButtonProps {
  icon?: 'submit' | 'cancel'
  iconSize?: string | number
  iconColor?: string
  disabled?: boolean
  loading?: boolean
  theme?: 'dark' | 'plain'
  // TODO large 尺寸还未设置对应的数值
  size?: 'small' | 'medium' | 'large'
}

export interface GSButtonEmits {
  (e: 'click', v: MouseEvent): void
}

const props = defineProps<GSButtonProps>()
const emits = defineEmits<GSButtonEmits>()

const onClick = (ev: MouseEvent) => {
  if (props.disabled || props.loading) return
  emits('click', ev)
}
</script>

<template>
  <button
    v-bind="$attrs"
    class="gs-button gs-button-variable font-['HYWenHei-85W']"
    :class="[
      `gs-button--theme-${theme ?? 'light'}`,
      `gs-button--size-${size ?? 'medium'}`,
      loading ? 'gs-button--icon-loading' : $slots.icon ? '' : `gs-button--icon-${icon}`,
      { loading, disabled },
    ]"
    @click="onClick"
  >
    <div v-if="icon || $slots.icon" class="gs-button-icon">
      <slot name="icon" />
    </div>
    <div v-if="$slots.default" class="gs-button-content">
      <slot name="default" />
    </div>
  </button>
</template>

<style lang="scss" scoped>
@mixin plainStyle($cursor: default) {
  cursor: $cursor;
  --icon-opacity: 1;
  --bg: transparent;
  --outline-color: #ece5d834;
  --outline-hover-color: var(--outline-color);
  --outline-active-color: var(--outline-color);
  --border-color: transparent;
  --border-hover-color: var(--border-color);
  --border-active-color: var(--border-color);
  --filter-active: none;
  --text-color: #959597;
  --text-active-color: var(--text-color);
  --filter: none;
  --filter-active: none;
}

.gs-button-variable {
  --height: 40px;
  --padding: 5px;
  --transition: all ease 150ms;
  // icon
  --icon-bg: #313131;
  --icon-color: #fac732;
  --icon-opacity: 1;
  --icon-size: calc(var(--height) - 2 * (var(--padding) + var(--border-width)));
  // background
  --bg: rgb(236 229 216 / 1);
  --bg-hover: var(--bg);
  --bg-active: rgb(236 229 216 / 0.6);
  // text
  --line-height: auto;
  --text-padding: 8px;
  --text-size: 18px;
  --text-color: #4a5366;
  --text-active-color: #fff;
  // outline
  --outline-width: 2px;
  --outline-color: transparent;
  --outline-hover-color: #fff;
  --outline-active-color: transparent;
  // border
  --border-width: 2px;
  --border-color: transparent;
  --border-hover-color: #dad4cb;
  --border-active-color: transparent;
  // filter
  --filter: drop-shadow(0 0 2px rgb(128 128 128 / 0.4));
  --filter-active: drop-shadow(0 0 6px rgb(128 128 128 / 0.4));
}

.gs-button--size-small {
  --height: 32px;
  --padding: 2px;
  --text-size: 14px;
  --text-padding: 4px;
  --border-width: 2px;
}

.gs-button {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  min-width: var(--height);
  height: var(--height);
  padding: var(--padding);
  border-radius: calc(var(--height) / 2);
  outline: var(--outline-width) solid var(--outline-color);
  outline-offset: -1px;
  border: var(--border-width) solid var(--border-color);
  transition: var(--transition);
  background: var(--bg);
  background-repeat: no-repeat;
  color: var(--text-color);
  filter: var(--filter);
  font-size: var(--text-size);
  line-height: var(--line-height);
  position: relative;

  &:not(.disabled, .loading):hover {
    outline-color: var(--outline-hover-color);
    border-color: var(--border-hover-color);
    background: var(--bg-hover);
  }
  &:not(.disabled, .loading):active {
    --icon-opacity: 0.8;
    background: var(--bg-active);
    color: var(--text-active-color);
    outline-color: var(--outline-active-color);
    border-color: var(--border-active-color);
    filter: var(--filter-active);
  }

  &:not(.disabled).loading {
    @include plainStyle();
  }
  &.disabled {
    @include plainStyle($cursor: not-allowed);
  }
}

.gs-button--theme-plain {
  --icon-bg: transparent;
  --icon-color: #3b4255;
  --border-width: 0px;
  --outline-width: 0px;
  --bg: rgb(236 229 216 / 0.2);
  --bg-hover: transparent;
  --bg-active: transparent;
  --bg-clip: circle(calc(var(--height) / 2 - 4px));
  --before-bg: radial-gradient(
    #ece5d8 calc(var(--height) / 2 - 4px),
    #fff calc(var(--height) / 2 - 4px)
  );
  &:hover {
    --bg-clip: circle(calc(var(--height) / 2 - 2px));
  }
  &:active {
    --icon-color: #ffffff;
    --before-bg: radial-gradient(
      rgb(180 167 146 / 0.6) calc(var(--height) / 2 - 0px),
      #fff calc(var(--height) / 2 - 0px)
    );
    --filter-active: drop-shadow(0 0 4px #fff);
  }
  &::before {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    opacity: var(--before-opacity);
    background: var(--before-bg);
    border-radius: 50%;
    clip-path: var(--bg-clip);
    transition: var(--transition);
  }
}

.gs-button--theme-dark {
  --text-color: #ece5d8;
  --text-active-color: #5b6272;
  --border-hover-color: rgb(91 98 114 / 1);
  --bg: #4a5366;
  --bg-active: #fff3d1;
  --outline-hover-color: #ffe6b2;
  --outline-active-color: #5b6272;
  --filter-active: drop-shadow(0 0 2px #dad4cb);
  &.disabled {
    --border-color: #959597;
    --icon-opacity: 0.5;
  }
}

.gs-button-icon {
  width: var(--icon-size);
  height: var(--icon-size);
  border-radius: 100%;
  background: var(--icon-bg);
  opacity: var(--icon-opacity);
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  &::before,
  &::after {
    content: '';
    left: 0;
    top: 0;
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 100%;
    transition: var(--transition);
  }
}

.gs-button--icon-loading {
  @keyframes anime-rotate {
    from {
      rotate: 0deg;
    }
    to {
      rotate: 360deg;
    }
  }
  .gs-button-icon::before {
    background: repeating-conic-gradient(transparent 0%, var(--icon-color) 33%);
    mask: radial-gradient(transparent 0, transparent 50%, #000 50%, #000);
    animation: anime-rotate 2000ms linear infinite;
    scale: 0.6;
  }
}

.gs-button--icon-submit {
  .gs-button-icon::before {
    border: 4px solid var(--icon-color);
    scale: 0.5;
  }
}

.gs-button--icon-cancel {
  --icon-color: #38a2e4;
  --icon-scale: calc(var(--icon-size) / var(--height));
  --icon-tr-y: calc(var(--icon-size) / 2 - 2px);

  .gs-button-icon::before,
  .gs-button-icon::after {
    background: var(--icon-color);
    border-radius: 2px;
    height: 4px;
    translate: 0 var(--icon-tr-y);
    scale: 0.6;
    rotate: 45deg;
  }
  .gs-button-icon::after {
    rotate: -45deg;
  }
}

.gs-button-content {
  white-space: nowrap;
  padding: 0 var(--text-padding);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
</style>
