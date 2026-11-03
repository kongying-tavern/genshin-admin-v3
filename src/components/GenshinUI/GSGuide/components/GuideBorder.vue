<script setup lang="ts">
const box = ref([1600, 900])
const filterId = crypto.randomUUID()
const pathId = crypto.randomUUID()
</script>

<template>
  <svg
    class="absolute left-0 top-0 pointer-events-none"
    :viewBox="`0 0 ${box[0]} ${box[1]}`"
    fill="#79FFFF"
  >
    <defs>
      <filter :id="filterId">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#1DC5FD" />
        <feDropShadow dx="0" dy="0" stdDeviation="1" flood-color="#79FFFF" />
      </filter>
      <path
        :id="pathId"
        d="
          m 8 8 l 28.5 0 q 2 0 2 -2 q 0 -2 -2 -2 l -28.5 0 q -4 0 -4 4 l 0 28.5 q 0 2 2 2 q 2 0 2 -2 z
          m 4 4 l 0 12 l 12 0 l 0 -12 z
        "
        :style="`filter:url(#${filterId})`"
      />
    </defs>
    <g>
      <use :href="`#${pathId}`" />
      <use :href="`#${pathId}`" :transform="`translate(${box[0]} 0) rotate(90)`" />
      <use :href="`#${pathId}`" :transform="`translate(${box[0]} ${box[1]}) rotate(180)`" />
      <use :href="`#${pathId}`" :transform="`translate(0 ${box[1]}) rotate(270)`" />
    </g>
    <rect
      :width="box[0] - 12"
      :height="box[1] - 12"
      :style="`filter:url(#${filterId})`"
      transform="translate(6 6)"
      fill="transparent"
      stroke="#1DC5FD40"
    />
  </svg>
</template>
