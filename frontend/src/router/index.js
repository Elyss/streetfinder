import { createRouter, createWebHistory } from "vue-router"

const routes = [
  // -- Public --
  { path: "/", name: "home", component: () => import("@/apps/Home.vue") },

  // -- 404 --
  { path: "/404", name: "not-found", component: () => import("@/apps/NotFound.vue") },
  { path: "/:pathMatch(.*)*", redirect: { name: "not-found" } },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
