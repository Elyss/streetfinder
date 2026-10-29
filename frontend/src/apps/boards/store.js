import { defineStore } from "pinia"
import { computed, reactive, ref, toRaw } from "vue"
import { makeItem, newId, rememberStyle } from "./lib/defaults"
import { connectorGeometry, rectOf, union } from "./lib/geometry"
import { createSync } from "./lib/sync"

const NAMES = ["Renard", "Loutre", "Hibou", "Panda", "Lynx", "Koala", "Castor", "Héron", "Faucon", "Blaireau", "Lama", "Gecko"]
const COLORS = ["#e5484d", "#f76b15", "#d6a400", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f"]

// JSON copy rather than structuredClone: items may hold nested reactive proxies
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)))
// Same object apart from its timestamp (a rewrite with the same content is not an undo step)
const sameContent = (a, b) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 })

function loadIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem("boards.identity"))
    if (saved?.name && saved?.color) return saved
  } catch {
    // ignore
  }
  const identity = {
    name: `${NAMES[Math.floor(Math.random() * NAMES.length)]} anonyme`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
  try {
    localStorage.setItem("boards.identity", JSON.stringify(identity))
  } catch {
    // ignore
  }
  return identity
}

export const useBoardStore = defineStore("board", () => {
  const meta = reactive({ id: null, title: "", background: "dots" })
  const items = reactive({})
  const selection = ref([])
  const view = reactive({ ox: 0, oy: 0, zoom: 1 })
  const editing = ref(null) // { id, label?: index }
  // Column / row of a table picked with its grip: { id, axis: "col" | "row", index }
  const tableSel = ref(null)
  const tool = ref("select")
  const shapeKind = ref("rect")
  const settings = reactive({ snapGrid: false, minimap: true })
  const status = ref("connecting")
  const peers = reactive({})
  const me = reactive(loadIdentity())
  const exporting = ref(false)
  const canUndo = ref(false)
  const canRedo = ref(false)
  // owner / edit / view: readers see the board live but cannot change it
  const role = ref(null)
  const readOnly = computed(() => role.value === "view")

  let sync = null
  let tx = null
  const undoStack = []
  const redoStack = []

  const selectedItems = computed(() => selection.value.map((id) => items[id]).filter(Boolean))

  // ------------------------------------------------------------ connection

  /** share: token of the share link, when the board is opened without an account */
  function open(boardId, { share = null } = {}) {
    close()
    meta.id = boardId
    status.value = "connecting"
    sync = createSync(boardId, {
      getItem: (id) => clone(items[id]),
      onInit(msg) {
        for (const id of Object.keys(items)) delete items[id]
        for (const it of msg.items) if (it?.id) items[it.id] = it
        Object.assign(meta, msg.board)
        role.value = msg.role
        for (const id of Object.keys(peers)) delete peers[id]
        selection.value = selection.value.filter((id) => items[id])
      },
      onOps: applyRemote,
      onMessage,
      onStatus: (s) => (status.value = s),
    }, { share })
  }

  function close() {
    sync?.close()
    sync = null
    for (const id of Object.keys(items)) delete items[id]
    for (const id of Object.keys(peers)) delete peers[id]
    selection.value = []
    editing.value = null
    undoStack.length = redoStack.length = 0
    canUndo.value = canRedo.value = false
    role.value = null
  }

  function onMessage(msg) {
    if (msg.type === "presence") {
      peers[msg.client] = { ...msg.data, seen: Date.now() }
    } else if (msg.type === "leave") {
      delete peers[msg.client]
    } else if (msg.type === "join") {
      sendPresence.force?.()
    } else if (msg.type === "meta") {
      if (msg.title !== undefined) meta.title = msg.title
      if (msg.background !== undefined) meta.background = msg.background
    }
  }

  function applyRemote(ops) {
    for (const op of ops) {
      if (op.op === "put") items[op.item.id] = op.item
      else delete items[op.id]
    }
    if (editing.value && !items[editing.value.id]) editing.value = null
    if (selection.value.some((id) => !items[id])) selection.value = selection.value.filter((id) => items[id])
  }

  function setMeta(patch) {
    if (readOnly.value) return
    Object.assign(meta, patch)
    sync?.send({ type: "meta", ...patch })
  }

  const sendPresence = (() => {
    let last = 0, timer = null, data = {}
    const send = () => {
      last = Date.now()
      timer = null
      sync?.send({ type: "presence", data: { ...data, name: me.name, color: me.color, selection: selection.value.slice(0, 50) } })
    }
    const fn = (patch = {}) => {
      Object.assign(data, patch)
      if (timer) return
      timer = setTimeout(send, Math.max(0, 50 - (Date.now() - last)))
    }
    fn.force = send
    return fn
  })()

  function setIdentity(patch) {
    Object.assign(me, patch)
    try {
      localStorage.setItem("boards.identity", JSON.stringify(toRaw(me)))
    } catch {
      // ignore
    }
    sendPresence()
  }

  // ------------------------------------------------------------ mutations
  // Every local change goes through a transaction: it is sent to the server and
  // recorded as one undo step (only the actions of the current user are undone).

  function begin() {
    if (!tx) tx = { before: new Map(), depth: 0 }
    tx.depth++
  }

  function commit() {
    if (!tx || --tx.depth > 0) return
    const changes = []
    for (const [id, before] of tx.before) {
      const after = clone(items[id])
      if (!sameContent(before, after)) changes.push({ id, before, after })
    }
    tx = null
    if (changes.length) {
      undoStack.push(changes)
      redoStack.length = 0
      canUndo.value = true
      canRedo.value = false
    }
  }

  function mutate(fn) {
    begin()
    try {
      return fn()
    } finally {
      commit()
    }
  }

  function track(id) {
    if (tx && !tx.before.has(id)) tx.before.set(id, clone(items[id]))
  }

  const send = (id) => sync?.queue(id)

  function addItem(item) {
    if (readOnly.value) return null
    mutate(() => {
      track(item.id)
      item.author ??= me.name
      item.createdAt ??= Date.now()
      items[item.id] = item
      send(item.id)
    })
    return items[item.id]
  }

  function updateItem(id, patch) {
    const it = items[id]
    if (!it || readOnly.value) return
    mutate(() => {
      track(id)
      for (const [k, v] of Object.entries(patch)) {
        if (k === "style") Object.assign((it.style ||= {}), v)
        else it[k] = v
      }
      it.updatedAt = Date.now()
      send(id)
    })
  }

  function updateStyle(ids, style) {
    mutate(() => {
      for (const id of ids) {
        updateItem(id, { style })
        if (items[id]) rememberStyle(items[id].type, style)
      }
    })
  }

  function removeItems(ids) {
    if (readOnly.value) return
    const doomed = new Set(ids)
    // Connectors attached to a deleted object go with it
    for (const it of Object.values(items)) {
      if (it.type === "connector" && (doomed.has(it.from?.id) || doomed.has(it.to?.id))) doomed.add(it.id)
    }
    mutate(() => {
      for (const id of doomed) {
        if (!items[id]) continue
        track(id)
        delete items[id]
        send(id)
      }
      for (const it of Object.values(items)) {
        if (doomed.has(it.parent)) updateItem(it.id, { parent: null })
      }
    })
    selection.value = selection.value.filter((id) => items[id])
    if (editing.value && !items[editing.value.id]) editing.value = null
  }

  function restore(changes, key) {
    for (const c of changes) {
      const data = c[key]
      if (data) items[c.id] = clone(data)
      else delete items[c.id]
      send(c.id)
    }
    selection.value = selection.value.filter((id) => items[id])
  }

  function undo() {
    if (readOnly.value) return
    const changes = undoStack.pop()
    if (!changes) return
    editing.value = null
    restore(changes, "before")
    redoStack.push(changes)
    canUndo.value = undoStack.length > 0
    canRedo.value = true
  }

  function redo() {
    if (readOnly.value) return
    const changes = redoStack.pop()
    if (!changes) return
    restore(changes, "after")
    undoStack.push(changes)
    canUndo.value = true
    canRedo.value = redoStack.length > 0
  }

  // ------------------------------------------------------------ selection

  /** Clicking one member of a group selects the whole group. */
  function withGroups(ids) {
    const groups = new Set(ids.map((id) => items[id]?.group).filter(Boolean))
    if (!groups.size) return ids
    const out = new Set(ids)
    for (const it of Object.values(items)) if (groups.has(it.group)) out.add(it.id)
    return [...out]
  }

  function select(ids) {
    selection.value = withGroups(ids.filter((id) => items[id]))
    if (tableSel.value && !(selection.value.length === 1 && selection.value[0] === tableSel.value.id)) tableSel.value = null
    sendPresence()
  }

  // Objects the elbow routing tries to avoid. Read without reactivity on purpose:
  // a route is recomputed when its own ends move, not whenever anything moves.
  function obstaclesFor(conn) {
    const out = []
    const skip = new Set([conn.from?.id, conn.to?.id])
    for (const it of Object.values(toRaw(items))) {
      if (it.type === "connector" || it.type === "frame" || it.type === "text" || skip.has(it.id)) continue
      out.push(rectOf(it))
    }
    return out
  }

  /** Path of a connector, the same everywhere: drawing, selection, handles, labels, bounds. */
  function routeOf(conn) {
    return connectorGeometry(conn, items, (conn.style?.route || "elbow") === "elbow" ? obstaclesFor(conn) : [])
  }

  function bounds(it) {
    if (it.type === "connector") return routeOf(it).bounds
    return rectOf(it)
  }

  function boundsOf(ids) {
    return union(ids.map((id) => items[id]).filter(Boolean).map(bounds))
  }

  // ------------------------------------------------------------ arrange

  function zOrder(ids, where) {
    const all = Object.values(items).sort((a, b) => a.z - b.z)
    if (!all.length) return
    const moving = new Set(ids)
    mutate(() => {
      if (where === "front" || where === "back") {
        let z = where === "front" ? all[all.length - 1].z : all[0].z
        const sorted = all.filter((it) => moving.has(it.id))
        if (where === "back") sorted.reverse()
        for (const it of sorted) {
          z += where === "front" ? 1 : -1
          updateItem(it.id, { z })
        }
      } else {
        // Swap with the closest non-selected neighbour
        const order = where === "forward" ? all : all.slice().reverse()
        for (let i = order.length - 2; i >= 0; i--) {
          const it = order[i], next = order[i + 1]
          if (moving.has(it.id) && !moving.has(next.id)) {
            const z = it.z
            updateItem(it.id, { z: next.z })
            updateItem(next.id, { z })
            order[i] = next
            order[i + 1] = it
          }
        }
      }
    })
  }

  function group(ids) {
    const gid = newId()
    mutate(() => ids.forEach((id) => updateItem(id, { group: gid })))
  }

  function ungroup(ids) {
    mutate(() => ids.forEach((id) => items[id]?.group && updateItem(id, { group: null })))
  }

  function align(ids, how) {
    const nodes = ids.map((id) => items[id]).filter((it) => it && it.type !== "connector" && !it.locked)
    const b = union(nodes.map(rectOf))
    if (!b || nodes.length < 2) return
    mutate(() => {
      for (const it of nodes) {
        const p = {
          left: { x: b.x }, center: { x: b.x + (b.w - it.w) / 2 }, right: { x: b.x + b.w - it.w },
          top: { y: b.y }, middle: { y: b.y + (b.h - it.h) / 2 }, bottom: { y: b.y + b.h - it.h },
        }[how]
        updateItem(it.id, p)
      }
    })
  }

  function distribute(ids, axis) {
    const nodes = ids.map((id) => items[id]).filter((it) => it && it.type !== "connector" && !it.locked)
    if (nodes.length < 3) return
    const pos = axis === "h" ? "x" : "y", size = axis === "h" ? "w" : "h"
    nodes.sort((a, b) => a[pos] - b[pos])
    const first = nodes[0], last = nodes[nodes.length - 1]
    const total = nodes.reduce((s, it) => s + it[size], 0)
    const gap = (last[pos] + last[size] - first[pos] - total) / (nodes.length - 1)
    let cursor = first[pos]
    mutate(() => {
      for (const it of nodes) {
        updateItem(it.id, { [pos]: cursor })
        cursor += it[size] + gap
      }
    })
  }

  function matchSize(ids) {
    const nodes = ids.map((id) => items[id]).filter((it) => it && it.type !== "connector" && !it.locked)
    if (nodes.length < 2) return
    const w = Math.max(...nodes.map((it) => it.w)), h = Math.max(...nodes.map((it) => it.h))
    mutate(() => nodes.forEach((it) => updateItem(it.id, { w, h })))
  }

  function changeShape(ids, shape) {
    mutate(() => ids.forEach((id) => items[id]?.type === "shape" && updateItem(id, { shape })))
  }

  // ------------------------------------------------------------ clipboard

  /** Serializable copy of the selection; connectors keep their ends inside it. */
  function copyPayload(ids) {
    const set = new Set(ids)
    for (const it of Object.values(items)) {
      if (it.type === "connector" && set.has(it.from?.id) && set.has(it.to?.id)) set.add(it.id)
    }
    const list = [...set].map((id) => clone(items[id])).filter(Boolean)
    for (const it of list) {
      if (it.type !== "connector") continue
      // Ends attached outside the copy become free points at their current position
      const geom = routeOf(items[it.id])
      if (it.from?.id && !set.has(it.from.id)) it.from = { ...geom.start.p }
      if (it.to?.id && !set.has(it.to.id)) it.to = { ...geom.end.p }
    }
    return { kind: "streetfinder-board", items: list }
  }

  function pastePayload(payload, offset) {
    const map = new Map(payload.items.map((it) => [it.id, newId()]))
    const groups = new Map()
    const zBase = Date.now() / 1000
    const created = []
    mutate(() => {
      payload.items.forEach((src, i) => {
        const it = clone(src)
        it.id = map.get(src.id)
        it.z = zBase + i * 0.001
        it.parent = map.get(src.parent) || null
        if (it.group) {
          if (!groups.has(it.group)) groups.set(it.group, newId())
          it.group = groups.get(it.group)
        }
        if (it.type === "connector") {
          for (const end of ["from", "to"]) {
            if (it[end]?.id) it[end] = { ...it[end], id: map.get(it[end].id) }
            else if (it[end]) it[end] = { x: it[end].x + offset.x, y: it[end].y + offset.y }
          }
        } else {
          it.x += offset.x
          it.y += offset.y
        }
        it.author = me.name
        it.createdAt = Date.now()
        addItem(it)
        created.push(it.id)
      })
    })
    select(created)
    return created
  }

  function copyStyle(id) {
    const it = items[id]
    if (it) localStorage.setItem("boards.copiedStyle", JSON.stringify({ type: it.type, style: clone(it.style), shape: it.shape }))
  }

  function pasteStyle(ids) {
    let copied
    try {
      copied = JSON.parse(localStorage.getItem("boards.copiedStyle"))
    } catch {
      return
    }
    if (!copied) return
    mutate(() => {
      for (const id of ids) {
        const it = items[id]
        if (!it || (it.type === "connector") !== (copied.type === "connector")) continue
        updateItem(id, { style: copied.style })
      }
    })
  }

  return {
    meta, items, selection, selectedItems, view, editing, tableSel, tool, shapeKind, settings, status,
    peers, me, exporting, canUndo, canRedo, role, readOnly,
    open, close, setMeta, sendPresence, setIdentity,
    begin, commit, mutate, addItem, updateItem, updateStyle, removeItems, undo, redo,
    select, withGroups, bounds, boundsOf, routeOf,
    zOrder, group, ungroup, align, distribute, matchSize, changeShape,
    copyPayload, pastePayload, copyStyle, pasteStyle,
    makeItem,
    hasUnsaved: () => sync?.hasUnsaved() ?? false,
  }
})
