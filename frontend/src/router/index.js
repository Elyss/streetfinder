import { createRouter, createWebHistory } from "vue-router"

const routes = [
  // -- Public --
  { path: "/", name: "home", component: () => import("@/apps/Home.vue") },
  { path: "/characters", name: "characters", component: () => import("@/apps/personnages/Characters.vue") },
  { path: "/characters/:slug/:tab(combo)?", name: "character", component: () => import("@/apps/personnages/Character.vue") },
  { path: "/inputbreaker/:tab(dp)?", name: "input-breaker", component: () => import("@/apps/inputbreaker/InputBreaker.vue") },

  // -- 404 --
  { path: "/404", name: "not-found", component: () => import("@/apps/NotFound.vue") },
  { path: "/:pathMatch(.*)*", redirect: { name: "not-found" } },
]

const router = createRouter({ history: createWebHistory(), routes })

export default router
