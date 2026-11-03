<template>
  <svg viewBox="0 0 100 100">
    <circle
      cx="50"
      cy="50"
      r="45"
      fill="transparent"
      stroke-width="10px"
      stroke="currentColor"
      stroke-opacity="0.2"
    />
    <circle cx="50" cy="50" r="45" fill="transparent" stroke-width="10px" stroke="currentColor">
      <animate
        attributeName="stroke-dasharray"
        values="40 249; 249 40; 40 249"
        dur="2.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="stroke-dashoffset"
        values="0; -283; -578"
        dur="2.5s"
        repeatCount="indefinite"
      />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 50 50"
        to="360 50 50"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>
</template>
