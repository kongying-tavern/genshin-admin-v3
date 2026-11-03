<template>
  <div class="h-full grid place-items-center text-sm gap-1">
    <div
      class="kongying-logo w-full h-full flex justify-center items-center gap-1 select-none bg-opacity-70 cursor-pointer"
    >
      <img class="w-8 h-8 object-contain" src="/favicon.ico" />
      <div class="h-8 text-xs font-['HYWenHei-85W']">空荧<br />酒馆后厨</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kongying-logo {
  clip-path: inset(5px round 6px);
  transition: all ease 300ms;

  &:hover {
    background-color: var(--el-color-primary-light-9);
  }
  &:active {
    background-color: var(--el-color-primary-light-7);
  }
}
</style>
