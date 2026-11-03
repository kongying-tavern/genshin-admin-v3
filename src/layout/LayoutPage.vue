<template>
  <router-view>
    <template #default="{ Component, route: currentRoute }">
      <div v-bind="$attrs" class="h-full overflow-hidden transition-all duration-200">
        <keep-alive>
          <component :is="Component" :key="currentRoute.fullPath" />
        </keep-alive>
      </div>
    </template>
  </router-view>
</template>
