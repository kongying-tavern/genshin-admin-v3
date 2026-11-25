<script setup lang="ts">
defineProps<{
  name: 'filter' | 'markers' | 'management' | 'manual' | 'settings'
}>()
</script>

<template>
  <svg
    class="sider-menu-icon"
    viewBox="0 0 40 40"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <g v-if="name === 'filter'">
      <path
        d="M8 6h24l3 3.6-10.9 12v6.3l-8.2 3v-9.3L5 9.6 8 6Z"
        fill="currentColor"
        fill-opacity=".14"
      />
      <path d="M6 10.2h28" />
      <path d="m11.8 13.5 7 8v5" stroke-width="1.1" opacity=".64" />
      <path d="m23.4 12.6 3.5 3.5-3.5 3.5-3.5-3.5 3.5-3.5Z" class="inlay" />
    </g>

    <g v-else-if="name === 'markers'">
      <path
        d="M8 6h19.5l6 6v15l-2.5 2.5H8L5.5 27V8.5L8 6Z"
        fill="currentColor"
        fill-opacity=".14"
      />
      <path d="M27.5 6.5V12h5.5" stroke-width="1.1" opacity=".7" />
      <path
        d="M14 11a4.7 4.7 0 0 1 4.7 4.7c0 3.1-2.7 5.6-4.7 7.8-2-2.2-4.7-4.7-4.7-7.8A4.7 4.7 0 0 1 14 11Z"
        fill="var(--sider-icon-accent)"
        fill-opacity=".18"
        stroke="var(--sider-icon-accent)"
      />
      <path d="m14 13.8 1.8 1.8-1.8 1.8-1.8-1.8 1.8-1.8Z" class="inlay" />
      <path d="M22.8 15h6.3m-6.3 4.5h6.3m-6.3 4.5h4.3" />
    </g>

    <g v-else-if="name === 'management'">
      <path
        d="
          M7 5h8.5L18 7.5V16l-2 2H7l-2-2V7l2-2Z
          M7 22h9l2 2v8.5L15.5 35H7l-2-2v-9l2-2Z
          M24 22h9l2 2v9l-2 2h-8.5L22 32.5V24l2-2Z
        "
        fill="currentColor"
        fill-opacity=".14"
      />
      <path
        d="M24.5 5H33l2 2v9l-2 2h-9l-2-2V7.5L24.5 5Z"
        fill="var(--sider-icon-accent)"
        fill-opacity=".18"
        stroke="var(--sider-icon-accent)"
      />
      <path d="M9 13V9h4M9 30v-4h4m13 4v-4h4" stroke-width="1.1" opacity=".7" />
      <path d="m28.5 8.5 3 3-3 3-3-3 3-3Z" class="inlay" />
      <path d="m20 17.6 2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4Z" fill="currentColor" stroke="none" />
    </g>

    <g v-else-if="name === 'manual'">
      <path
        d="M20 9.5c-3.5-3-9.8-3.5-15-1.3v22.2c5.2-2.2 11.5-1.6 15 1.7 3.5-3.3 9.8-3.9 15-1.7V8.2c-5.2-2.2-11.5-1.7-15 1.3Z"
        fill="currentColor"
        fill-opacity=".14"
      />
      <path d="M20 9.5v22.6" />
      <path
        d="M5 34c5.2-2.2 11.5-1.6 15 1.7 3.5-3.3 9.8-3.9 15-1.7"
        stroke-width="1.1"
        opacity=".75"
      />
      <path
        d="M9 13.2c2.3-.7 5.1-.4 7 .7m-7 3.8c2.3-.7 5.1-.4 7 .7m-7 3.8c1.6-.5 3.3-.4 4.8 0M24 23.2c2-1.1 4.7-1.4 7-.7"
        stroke-width="1.1"
        opacity=".75"
      />
      <path d="M26.3 7.1a17 17 0 0 1 5.1.1v12l-2.55-2.2-2.55 2.2V7.1Z" class="inlay" />
    </g>

    <g v-else>
      <path
        d="
          M16.82 7.7 17.51 3.89h4.98l.69 3.81A12.7 12.7 0 0 1 26.45 9.06
          L29.63 6.85 33.15 10.37 30.94 13.55A12.7 12.7 0 0 1 32.3 16.82
          L36.11 17.51v4.98l-3.81.69A12.7 12.7 0 0 1 30.94 26.45
          L33.15 29.63 29.63 33.15 26.45 30.94A12.7 12.7 0 0 1 23.18 32.3
          L22.49 36.11h-4.98l-.69-3.81A12.7 12.7 0 0 1 13.55 30.94
          L10.37 33.15 6.85 29.63 9.06 26.45A12.7 12.7 0 0 1 7.7 23.18
          L3.89 22.49v-4.98l3.81-.69A12.7 12.7 0 0 1 9.06 13.55
          L6.85 10.37 10.37 6.85 13.55 9.06A12.7 12.7 0 0 1 16.82 7.7Z
        "
        fill="currentColor"
        fill-opacity=".14"
      />
      <circle cx="20" cy="20" r="8" stroke-width="1.1" opacity=".75" />
      <path d="m20 15 5 5-5 5-5-5 5-5Z" class="inlay" />
    </g>
  </svg>
</template>

<style scoped>
.sider-menu-icon {
  display: block;
  width: 100%;
  height: 100%;
  color: var(--icon-color);
}

.inlay {
  fill: var(--sider-icon-accent);
  stroke: none;
}
</style>
