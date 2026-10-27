import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/auth"

const routes = [
  // -- Public --
  { path: "/", name: "home", component: () => import("@/apps/Home.vue") },

  // -- Accounts --
  { path: "/login", name: "login", component: () => import("@/apps/accounts/Login.vue"), meta: { guestOnly: true } },
  { path: "/register", name: "register", component: () => import("@/apps/accounts/Register.vue"), meta: { guestOnly: true } },
  { path: "/reset-password/:uid?/:token?", name: "reset-password", component: () => import("@/apps/accounts/ResetPassword.vue"), props: true },
  // Link of the invitation e-mail: public, the person has no password yet
  {
    path: "/definir-mot-de-passe/:uid/:token",
    name: "define-password",
    component: () => import("@/apps/accounts/ResetPassword.vue"),
    props: (route) => ({ ...route.params, invitation: true }),
  },
  { path: "/profil", name: "profile", component: () => import("@/apps/accounts/Profile.vue"), meta: { requiresAuth: true } },
  { path: "/utilisateurs", name: "users", component: () => import("@/apps/accounts/Users.vue"), meta: { requiresAuth: true, admin: true } },
  { path: "/utilisateurs/ajouter", name: "add-user", component: () => import("@/apps/accounts/AddUser.vue"), meta: { requiresAuth: true, admin: true } },

  // -- Apps (activated accounts) --
  { path: "/characters", name: "characters", component: () => import("@/apps/personnages/Characters.vue"), meta: { requiresAuth: true } },
  { path: "/characters/:slug/:tab(combo)?", name: "character", component: () => import("@/apps/personnages/Character.vue"), meta: { requiresAuth: true } },
  { path: "/inputbreaker/:tab(dp)?", name: "input-breaker", component: () => import("@/apps/inputbreaker/InputBreaker.vue"), meta: { requiresAuth: true } },
  { path: "/boards", name: "boards", component: () => import("@/apps/boards/BoardsList.vue"), meta: { requiresAuth: true } },
  // Share link (write or read): the user joins the board with that right
  { path: "/boards/partage/:token", name: "board-join", component: () => import("@/apps/boards/JoinBoard.vue"), props: true, meta: { requiresAuth: true } },
  { path: "/boards/:id", name: "board", component: () => import("@/apps/boards/BoardEditor.vue"), meta: { requiresAuth: true } },

  // -- 404 --
  { path: "/404", name: "not-found", component: () => import("@/apps/NotFound.vue") },
  { path: "/:pathMatch(.*)*", redirect: { name: "not-found" } },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Valid tokens but user not fetched yet (page reload)
  if (!auth.user && auth.isLoggedIn) {
    try {
      await auth.fetchMe()
    } catch {
      auth.logout()
    }
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: "login", query: { next: to.fullPath } }
  }

  // Account not activated yet: only the home page (which says so) is reachable
  if (to.meta.requiresAuth && !auth.isActivated) {
    return { name: "home" }
  }

  if (to.meta.admin && !auth.isAdmin) {
    return { name: "home" }
  }

  // Login and registration make no sense once logged in
  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: "home" }
  }

  return true
})

export default router
