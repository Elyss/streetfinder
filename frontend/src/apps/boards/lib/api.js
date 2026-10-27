import api from "@/api/axios"

export const boardsApi = {
  list: () => api.get("/api/boards/").then((r) => r.data),
  get: (id) => api.get(`/api/boards/${id}/`).then((r) => r.data),
  create: (data = {}) => api.post("/api/boards/", data).then((r) => r.data),
  update: (id, data) => api.patch(`/api/boards/${id}/`, data).then((r) => r.data),
  remove: (id) => api.delete(`/api/boards/${id}/`),
  duplicate: (id) => api.post(`/api/boards/${id}/duplicate/`).then((r) => r.data),
  leave: (id) => api.post(`/api/boards/${id}/leave/`),
  import: (data) => api.post("/api/boards/import/", data).then((r) => r.data),
  upload(id, file) {
    const form = new FormData()
    form.append("file", file)
    return api.post(`/api/boards/${id}/uploads/`, form).then((r) => r.data.url)
  },

  // Sharing (owner only)
  share: (id, data) => (data ? api.post(`/api/boards/${id}/share/`, data) : api.get(`/api/boards/${id}/share/`)).then((r) => r.data),
  member: (id, userId, data) => api.post(`/api/boards/${id}/members/${userId}/`, data).then((r) => r.data),
  join: (token) => api.post("/api/boards/join/", { token }).then((r) => r.data),
}

/** Share link opened by the people the board is shared with. */
export function shareLink(token) {
  return `${window.location.origin}/boards/partage/${token}`
}

/** Uploaded files are stored as "/media/..." paths, relative to the API origin. */
export function mediaUrl(src) {
  if (!src) return ""
  if (src.startsWith("/")) return (import.meta.env.VITE_API_URL || "") + src
  return src
}
