// WebSocket client of a board.
//
// Local changes are queued by item id and sent in batches; each batch stays
// "in flight" until the server acknowledges it has been persisted. Everything
// not acknowledged is mirrored in localStorage and replayed on reconnection,
// so that a network cut (or closing the tab offline) loses nothing.
import { freshAccessToken } from "@/api/axios"

const FLUSH_DELAY = 40
const CHUNK = 200

// Browsers cannot set headers on a WebSocket: the tokens go in the query string
// (token: account, share: share link used without an account)
export function socketUrl(boardId, { token, share }) {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  const query = new URLSearchParams()
  if (token) query.set("token", token)
  if (share) query.set("share", share)
  return base.replace(/^http/, "ws").replace(/\/$/, "") + `/ws/boards/${boardId}/?${query}`
}

export function createSync(boardId, { getItem, onInit, onOps, onMessage, onStatus }, { share = null } = {}) {
  const storageKey = `boards.pending.${boardId}`
  let ws = null
  let ready = false
  let closed = false
  let retry = 0
  let seq = 0
  let flushTimer = null
  let persistTimer = null
  const pendingIds = new Set()
  const inflight = new Map() // seq -> ops
  let restored = []

  try {
    restored = JSON.parse(localStorage.getItem(storageKey)) || []
  } catch {
    restored = []
  }

  const opFor = (id) => {
    const item = getItem(id)
    return item ? { op: "put", item } : { op: "del", id }
  }

  function unsentOps() {
    const ops = new Map()
    for (const op of restored) ops.set(op.op === "put" ? op.item.id : op.id, op)
    for (const batch of inflight.values()) for (const op of batch) ops.set(op.op === "put" ? op.item.id : op.id, op)
    for (const id of pendingIds) ops.set(id, opFor(id))
    return [...ops.values()]
  }

  function persist() {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      try {
        const ops = unsentOps()
        if (ops.length) localStorage.setItem(storageKey, JSON.stringify(ops))
        else localStorage.removeItem(storageKey)
      } catch {
        // quota exceeded / storage disabled: the in-memory queue still works
      }
    }, 300)
  }

  function status() {
    if (!ready) onStatus("offline")
    else onStatus(pendingIds.size || inflight.size ? "saving" : "saved")
  }

  function retryLater() {
    if (!closed) setTimeout(connect, Math.min(10000, 500 * 2 ** retry++))
  }

  async function connect() {
    let token = null
    try {
      token = await freshAccessToken()
    } catch {
      // Offline, or session expired: changes stay queued until a token can be obtained.
      // With a share link, the board is reachable without an account.
      if (!share) {
        status()
        retryLater()
        return
      }
    }
    if (closed) return
    ws = new WebSocket(socketUrl(boardId, { token, share }))
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "init") {
        // Local changes the server may not have: re-apply them on top of the snapshot
        const unsent = unsentOps()
        restored = []
        inflight.clear()
        onInit(msg)
        if (unsent.length) onOps(unsent)
        for (const op of unsent) pendingIds.add(op.op === "put" ? op.item.id : op.id)
        ready = true
        retry = 0
        flush()
        status()
      } else if (msg.type === "ack") {
        inflight.delete(msg.seq)
        persist()
        status()
      } else if (msg.type === "ops") {
        onOps(msg.ops)
      } else {
        onMessage(msg)
      }
    }
    ws.onclose = () => {
      ready = false
      status()
      retryLater()
    }
  }

  function flush() {
    clearTimeout(flushTimer)
    flushTimer = null
    if (!ready || !pendingIds.size) return
    const ops = [...pendingIds].map(opFor)
    pendingIds.clear()
    for (let i = 0; i < ops.length; i += CHUNK) {
      const chunk = ops.slice(i, i + CHUNK)
      inflight.set(++seq, chunk)
      ws.send(JSON.stringify({ type: "ops", seq, ops: chunk }))
    }
    status()
  }

  connect()

  return {
    queue(id) {
      pendingIds.add(id)
      if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY)
      persist()
      status()
    },
    send(message) {
      if (ready) ws.send(JSON.stringify(message))
    },
    hasUnsaved: () => pendingIds.size > 0 || inflight.size > 0,
    close() {
      closed = true
      flush()
      ws?.close()
    },
  }
}
