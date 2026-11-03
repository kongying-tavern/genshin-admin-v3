<script setup lang="ts">
const props = defineProps<{
  error: Error
}>()

const stack = computed<undefined | { label: string; codes: string[] }>(() => {
  const { stack } = props.error
  if (!stack) return
  const [label, ...codes] = stack.split('at ')
  return { label, codes }
})
</script>

<template>
  <div
    class="w-full h-full flex flex-col justify-center bg-[var(--el-color-primary)] text-[var(--el-color-white)] px-[10%]"
  >
    <div class="text-9xl mb-8">
      {{ `:(` }}
    </div>

    <div class="text-4xl mb-8">因关键错误崩溃。</div>

    <div class="custom-scrollbar h-[6em] text-xl mb-8 overflow-auto">
      <p>{{ error.message }}</p>
      <div v-if="stack">
        <div class="whitespace-nowrap">
          {{ stack.label }}
        </div>
        <div v-for="code in stack.codes" :key="code" class="pl-4 whitespace-nowrap text-sm">
          at {{ code }}
        </div>
      </div>
    </div>

    <div>
      <div>请将错误反馈至开发团队。</div>
      <a
        href="https://github.com/kongying-tavern/genshin-admin-v3/issues"
        target="_blank"
        rel="noreferrer"
        class="underline underline-offset-[6px]"
      >
        https://github.com/kongying-tavern/genshin-admin-v3/issues
      </a>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar {
  &::-webkit-scrollbar {
    border-radius: 8px;
    background-color: var(--el-color-primary-dark-2);
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 8px;
    border: 2px solid var(--el-color-primary-dark-2);
    background-color: var(--el-color-primary-light-3);
    &:hover {
      background-color: var(--el-color-primary-light-5);
    }
  }
}
</style>
