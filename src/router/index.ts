import type { RouterHistory } from 'vue-router'
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router'

const history: RouterHistory = (
  {
    history: createWebHistory,
    hash: createWebHashHistory,
    memory: createMemoryHistory,
  }[import.meta.env.VITE_ROUTER_MODE] ?? createWebHashHistory
)(import.meta.env.BASE_URL)

const router = createRouter({
  routes: [
    { path: '/:pathMatch(.*)', name: 'NotFound', component: () => import('../HomePage.vue') },
  ],
  history,
  scrollBehavior: () => ({
    top: 0,
    left: 0,
    behavior: 'smooth',
  }),
})

export { router }
