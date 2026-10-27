import axios from "axios"

const baseURL = import.meta.env.VITE_API_URL || ""
const api = axios.create({ baseURL })

// ------------------------------------------------------------------ JWT tokens

export function decodeToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return null
  }
}

export function isTokenExpired(token, marginSeconds = 0) {
  const exp = token && decodeToken(token)?.exp
  return !exp || Date.now() >= (exp - marginSeconds) * 1000
}

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

export function storeTokens(access, refresh) {
  localStorage.setItem("access", access)
  if (refresh) localStorage.setItem("refresh", refresh)
  setAuthToken(access)
}

export function clearTokens() {
  localStorage.removeItem("access")
  localStorage.removeItem("refresh")
  setAuthToken(null)
}

setAuthToken(localStorage.getItem("access"))

// A single refresh request at a time, shared by every caller waiting for it
let refreshing = null

function refreshAccess() {
  const refresh = localStorage.getItem("refresh")
  if (!refresh || isTokenExpired(refresh)) return Promise.reject(new Error("no refresh token"))
  refreshing ??= axios
    .post(`${baseURL}/api/auth/refresh/`, { refresh })
    .then(({ data }) => {
      storeTokens(data.access)
      return data.access
    })
    .catch((e) => {
      clearTokens()
      throw e
    })
    .finally(() => (refreshing = null))
  return refreshing
}

/** Valid access token (refreshed if needed), e.g. for the board WebSocket. */
export async function freshAccessToken() {
  const access = localStorage.getItem("access")
  if (access && !isTokenExpired(access, 30)) return access
  return refreshAccess()
}

// Expired access token: refresh it once, then replay the request
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const request = error.config
    if (error.response?.status !== 401 || request._retry || /\/api\/auth\/(login|refresh)\//.test(request.url)) throw error
    request._retry = true
    const access = await refreshAccess().catch(() => {
      throw error
    })
    request.headers.Authorization = `Bearer ${access}`
    return api(request)
  },
)

export default api
