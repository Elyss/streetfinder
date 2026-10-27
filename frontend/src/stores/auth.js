import { defineStore } from "pinia"
import api, { clearTokens, isTokenExpired, storeTokens } from "@/api/axios"

// First error message sent by the backend, otherwise the default one
const errorMessage = (e, fallback) => e?.response?.data?.error || fallback

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    loading: false,
    error: null,
  }),

  getters: {
    // An expired access token does not log out while the refresh token is valid:
    // the axios interceptor asks for a new one on the first 401.
    isLoggedIn() {
      void this.user // re-evaluated when the user changes (login / logout)
      const access = localStorage.getItem("access")
      if (access && !isTokenExpired(access)) return true
      const refresh = localStorage.getItem("refresh")
      return !!refresh && !isTokenExpired(refresh)
    },
    fullName: (state) => (state.user ? `${state.user.first_name} ${state.user.last_name}`.trim() : ""),
    firstName: (state) => state.user?.first_name || "",
    id: (state) => state.user?.id || null,
    isAdmin: (state) => !!state.user?.is_admin,
    // Same rule as the backend (permissions.is_activated)
    isActivated: (state) => !!(state.user?.is_activated_by_admin || state.user?.is_admin),
  },

  actions: {
    async login(email, password) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post("/api/auth/login/", { email: email.trim().toLowerCase(), password })
        storeTokens(data.access, data.refresh)
        await this.fetchMe()
      } catch (e) {
        this.error = e?.response?.status === 401 ? "Email ou mot de passe invalide" : "Connexion impossible"
        throw e
      } finally {
        this.loading = false
      }
    },

    async register(payload) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post("/api/auth/register/", { ...payload, email: payload.email.trim().toLowerCase() })
        storeTokens(data.access, data.refresh)
        await this.fetchMe()
      } catch (e) {
        this.error = errorMessage(e, "Inscription impossible")
        throw e
      } finally {
        this.loading = false
      }
    },

    /** Login with the tokens returned by an invitation / reset link. */
    async loginWithTokens({ access, refresh }) {
      storeTokens(access, refresh)
      await this.fetchMe()
    },

    async fetchMe() {
      const { data } = await api.get("/api/auth/me/")
      this.user = data
    },

    async updateProfile(first_name, last_name) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post("/api/auth/profile/", { first_name, last_name })
        this.user = data
      } catch (e) {
        this.error = errorMessage(e, "Enregistrement impossible")
        throw e
      } finally {
        this.loading = false
      }
    },

    logout() {
      clearTokens()
      this.user = null
    },
  },
})
