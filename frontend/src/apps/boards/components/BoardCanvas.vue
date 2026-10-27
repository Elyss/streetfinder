<template>
  <div ref="root" class="canvas" :class="cursorClass" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp"
    @pointercancel="onUp" @pointerleave="onLeave" @wheel.prevent="onWheel" @dblclick="onDblClick" @contextmenu.prevent
    @dragover.prevent @drop.prevent="onDrop">
    <!-- Background, drawn in screen space -->
    <svg class="layer" aria-hidden="true">
      <defs>
        <pattern id="sf-bg-dots" :width="gridPx" :height="gridPx" patternUnits="userSpaceOnUse" :x="mod(view.ox, gridPx)" :y="mod(view.oy, gridPx)">
          <circle cx="1" cy="1" r="1" fill="#c3cad6" />
        </pattern>
        <pattern id="sf-bg-grid" :width="gridPx" :height="gridPx" patternUnits="userSpaceOnUse" :x="mod(view.ox, gridPx)" :y="mod(view.oy, gridPx)">
          <path :d="`M${gridPx} 0H0V${gridPx}`" fill="none" stroke="#e1e6ee" stroke-width="1" />
        </pattern>
      </defs>
      <rect v-if="store.meta.background !== 'plain'" width="100%" height="100%" :fill="`url(#sf-bg-${store.meta.background})`" />
    </svg>

    <svg ref="svg" class="layer" xmlns="http://www.w3.org/2000/svg" role="img" :aria-label="`Board ${store.meta.title}`">
      <defs>
        <filter id="sf-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#1b2433" flood-opacity="0.18" />
        </filter>
        <filter id="sf-sticky-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1b2433" flood-opacity="0.15" />
        </filter>
      </defs>
      <g data-world :transform="`translate(${view.ox} ${view.oy}) scale(${view.zoom})`">
        <ItemView v-for="it in visible.frames" :key="it.id" :item="it" :editing="store.editing?.id === it.id" />
        <ConnectorView v-for="c in visible.connectors" :key="c.id" :conn="c" :zoom="view.zoom"
          :editing-label="store.editing?.id === c.id ? store.editing.label : null" />
        <ItemView v-for="it in visible.nodes" :key="it.id" :item="it" :editing="store.editing?.id === it.id" />

        <g v-if="!store.exporting" class="ui">
          <!-- Search results -->
          <rect v-for="r in highlightRects" :key="r.key" :x="r.x - 6 / view.zoom" :y="r.y - 6 / view.zoom"
            :width="r.w + 12 / view.zoom" :height="r.h + 12 / view.zoom" fill="none" :stroke="r.active ? '#e0922b' : '#f6bd84'"
            :stroke-width="(r.active ? 3 : 2) / view.zoom" :rx="6 / view.zoom" />

          <!-- Selections of the other collaborators -->
          <rect v-for="r in peerSelections" :key="r.key" :x="r.x - 3 / view.zoom" :y="r.y - 3 / view.zoom"
            :width="r.w + 6 / view.zoom" :height="r.h + 6 / view.zoom" fill="none" :stroke="r.color" :stroke-width="2 / view.zoom" />

          <!-- Own selection -->
          <template v-for="it in store.selectedItems" :key="'sel' + it.id">
            <path v-if="it.type === 'connector'" :d="connectorGeometry(it, store.items).hit" fill="none" stroke="#5366ce"
              stroke-opacity="0.35" :stroke-width="(it.style?.strokeWidth || 2) + 6 / view.zoom" stroke-linecap="round" stroke-linejoin="round" />
            <rect v-else :x="it.x" :y="it.y" :width="it.w" :height="it.h" fill="none" :stroke="it.locked ? '#9aa1ad' : '#5366ce'"
              :stroke-width="1.5 / view.zoom" :stroke-dasharray="it.locked ? `${4 / view.zoom}` : null" />
          </template>
          <rect v-if="selectionBox && selectedNodes.length > 1" :x="selectionBox.x" :y="selectionBox.y" :width="selectionBox.w"
            :height="selectionBox.h" fill="none" stroke="#5366ce" :stroke-width="1 / view.zoom" :stroke-dasharray="`${4 / view.zoom}`" />
          <g v-if="selectionBox && canResize" :style="{ pointerEvents: drag ? 'none' : null }">
            <rect v-for="s in edgeStrips" :key="s.handle" :data-handle="s.handle" :x="s.x" :y="s.y" :width="s.w" :height="s.h"
              fill="transparent" :style="{ cursor: CURSORS[s.handle] }" />
            <rect v-for="h in cornerHandles" :key="h.handle" :data-handle="h.handle" :x="h.x - hs / 2" :y="h.y - hs / 2"
              :width="hs" :height="hs" :rx="2 / view.zoom" fill="#fff" stroke="#5366ce" :stroke-width="1.5 / view.zoom"
              :style="{ cursor: CURSORS[h.handle] }" />
          </g>
          <g v-if="selectedConnector" :style="{ pointerEvents: drag ? 'none' : null }">
            <circle v-for="end in connectorEnds" :key="end.end" :data-end="end.end" :data-owner="selectedConnector.id"
              :cx="end.p.x" :cy="end.p.y" :r="6 / view.zoom" :fill="end.attached ? '#5366ce' : '#fff'" stroke="#5366ce"
              :stroke-width="2 / view.zoom" style="cursor: move" />
          </g>

          <!-- Hover affordances: anchor points and the "+" quick-create arrows -->
          <g v-if="affordance">
            <g v-for="a in affordance.anchors" :key="a.side">
              <circle :data-anchor="a.side" :data-owner="affordance.id" :cx="a.p.x" :cy="a.p.y" :r="9 / view.zoom" fill="transparent" />
              <circle :cx="a.p.x" :cy="a.p.y" :r="(a.active ? 6 : 4.5) / view.zoom" :fill="a.active ? '#5366ce' : '#fff'"
                stroke="#5366ce" :stroke-width="1.5 / view.zoom" style="pointer-events: none" />
            </g>
            <g v-for="p in affordance.plus" :key="p.side" :data-plus="p.side" :data-owner="affordance.id" class="plus"
              :transform="`translate(${p.p.x} ${p.p.y}) scale(${1 / view.zoom})`">
              <circle r="11" fill="#5366ce" />
              <path d="M-5 0H5M0 -5V5" stroke="#fff" stroke-width="2" stroke-linecap="round" />
            </g>
          </g>

          <!-- Alignment guides -->
          <line v-for="(g, i) in guides" :key="'g' + i" :x1="g.x1" :y1="g.y1" :x2="g.x2" :y2="g.y2" stroke="#e5484d"
            :stroke-width="1 / view.zoom" />

          <!-- Selection area being dragged -->
          <rect v-if="marqueeRect" :x="marqueeRect.x" :y="marqueeRect.y" :width="marqueeRect.w" :height="marqueeRect.h"
            fill="rgba(83,102,206,.1)" stroke="#5366ce" :stroke-width="1.5 / view.zoom" :rx="2 / view.zoom" />
          <rect v-if="drag?.kind === 'create' && createPreview" :x="createPreview.x" :y="createPreview.y" :width="createPreview.w"
            :height="createPreview.h" fill="rgba(83,102,206,.06)" stroke="#5366ce" :stroke-width="1.5 / view.zoom"
            :stroke-dasharray="`${5 / view.zoom}`" />
          <g v-if="draftGeometry" style="pointer-events: none">
            <path :d="draftGeometry.d" fill="none" stroke="#5366ce" :stroke-width="2" :stroke-dasharray="`${6 / view.zoom}`" />
            <path v-for="(cap, i) in capShapes('arrow', draftGeometry.end.p, draftGeometry.end.angle, 2)" :key="i" :d="cap.d" fill="#5366ce" />
          </g>

          <!-- Cursors of the other collaborators -->
          <g v-for="c in peerCursors" :key="c.key" :transform="`translate(${c.x} ${c.y}) scale(${1 / view.zoom})`" style="pointer-events: none">
            <path d="M0 0L0 16L4.5 12L7.5 19L10 18L7 11L13 11Z" :fill="c.color" stroke="#fff" stroke-width="1.2" />
            <rect x="12" y="18" :width="c.name.length * 6.6 + 12" height="20" rx="6" :fill="c.color" />
            <text x="18" y="32" font-size="12" font-weight="600" fill="#fff" :font-family="FONTS.sans">{{ c.name }}</text>
          </g>
        </g>
      </g>
    </svg>

    <TextEditor ref="textEditor" />

    <div v-if="quickMenu" class="quick-menu" :style="{ left: `${quickMenu.sx}px`, top: `${quickMenu.sy}px` }" @pointerdown.stop>
      <p>Créer ici</p>
      <button v-for="q in QUICK_SHAPES" :key="q.label" type="button" @click="quickCreate(q)">{{ q.label }}</button>
      <button type="button" class="muted" @click="quickMenu = null">Laisser libre</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import ItemView from "./ItemView.vue"
import ConnectorView from "./ConnectorView.vue"
import TextEditor from "./TextEditor.vue"
import { useBoardStore } from "../store"
import { FONTS, GRID, hasText, makeItem } from "../lib/defaults"
import {
  SIDES, anchorPoint, capShapes, center, connectorGeometry, containsPoint, contains, dist, inflate, intersects,
  nearestT, rectFromPoints, rectOf, union,
} from "../lib/geometry"
import { plainText } from "../lib/sanitize"

const props = defineProps({
  highlights: { type: Array, default: () => [] },
  activeHighlight: { type: String, default: null },
})
const emit = defineEmits(["files", "user-view-change", "open-board"])

const store = useBoardStore()
const view = store.view
const root = ref(null)
const svg = ref(null)
const textEditor = ref(null)
const size = reactive({ w: 1000, h: 800 })
const drag = ref(null)
const guides = ref([])
const hoverId = ref(null)
const quickMenu = ref(null)
const spaceDown = ref(false)
const lastPointer = ref(null)
const pointers = new Map()

const CURSORS = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" }
const QUICK_SHAPES = [
  { label: "Rectangle", type: "shape", shape: "rounded" },
  { label: "Ellipse", type: "shape", shape: "ellipse" },
  { label: "Décision", type: "shape", shape: "diamond" },
  { label: "Sticky note", type: "sticky" },
  { label: "Texte", type: "text" },
]
const LINKABLE = ["shape", "sticky", "image", "text"]
const MAGNET = 24 // px on screen within which a connector end snaps to an object

const mod = (a, n) => ((a % n) + n) % n
const gridPx = computed(() => {
  let g = GRID * view.zoom
  while (g < 10) g *= 5
  return g
})

// ------------------------------------------------------------ coordinates & view

function screenOf(e) {
  const r = root.value.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function toWorld(e) {
  const s = screenOf(e)
  return { x: (s.x - view.ox) / view.zoom, y: (s.y - view.oy) / view.zoom }
}

function zoomAt(p, zoom) {
  zoom = Math.min(4, Math.max(0.1, zoom))
  const wx = (p.x - view.ox) / view.zoom, wy = (p.y - view.oy) / view.zoom
  view.zoom = zoom
  view.ox = p.x - wx * zoom
  view.oy = p.y - wy * zoom
}

function zoomBy(factor) {
  zoomAt({ x: size.w / 2, y: size.h / 2 }, view.zoom * factor)
}

function fitRect(r, maxZoom = 1, padding = 80) {
  if (!r) return
  const zoom = Math.min(maxZoom, Math.max(0.1, Math.min((size.w - padding * 2) / Math.max(r.w, 1), (size.h - padding * 2) / Math.max(r.h, 1))))
  view.zoom = zoom
  view.ox = size.w / 2 - (r.x + r.w / 2) * zoom
  view.oy = size.h / 2 - (r.y + r.h / 2) * zoom
}

function centerOn(p, zoom = view.zoom) {
  view.zoom = Math.min(4, Math.max(0.1, zoom))
  view.ox = size.w / 2 - p.x * view.zoom
  view.oy = size.h / 2 - p.y * view.zoom
}

function ensureVisible(r) {
  const vp = inflate(viewport.value, -40 / view.zoom)
  if (!contains(vp, r)) centerOn(center(r))
}

const viewport = computed(() => ({ x: -view.ox / view.zoom, y: -view.oy / view.zoom, w: size.w / view.zoom, h: size.h / view.zoom }))

function worldCenter() {
  return center(viewport.value)
}

// ------------------------------------------------------------ rendering (virtualized)

function roughBounds(conn) {
  const pt = (end) => {
    const it = end?.id && store.items[end.id]
    return it ? rectOf(it) : { x: end?.x ?? 0, y: end?.y ?? 0, w: 0, h: 0 }
  }
  return inflate(union([pt(conn.from), pt(conn.to)]), 60)
}

// Only what intersects the viewport is drawn (everything while exporting)
const visible = computed(() => {
  const vp = inflate(viewport.value, 200 / view.zoom)
  const all = store.exporting
  const frames = [], connectors = [], nodes = []
  for (const it of Object.values(store.items)) {
    if (it.type === "connector") {
      if (all || intersects(roughBounds(it), vp)) connectors.push(it)
    } else if (all || intersects(rectOf(it), vp)) {
      ;(it.type === "frame" ? frames : nodes).push(it)
    }
  }
  const byZ = (a, b) => a.z - b.z
  return { frames: frames.sort(byZ), connectors: connectors.sort(byZ), nodes: nodes.sort(byZ) }
})

const selectedNodes = computed(() => store.selectedItems.filter((it) => it.type !== "connector"))
const selectionBox = computed(() => union(selectedNodes.value.map(rectOf)))
const canResize = computed(() => !store.readOnly && selectedNodes.value.some((it) => !it.locked) && !store.editing)
const hs = computed(() => 9 / view.zoom)
const cornerHandles = computed(() => {
  const b = selectionBox.value
  return [
    { handle: "nw", x: b.x, y: b.y }, { handle: "ne", x: b.x + b.w, y: b.y },
    { handle: "se", x: b.x + b.w, y: b.y + b.h }, { handle: "sw", x: b.x, y: b.y + b.h },
  ]
})
const edgeStrips = computed(() => {
  const b = selectionBox.value, t = 8 / view.zoom
  return [
    { handle: "n", x: b.x, y: b.y - t / 2, w: b.w, h: t },
    { handle: "s", x: b.x, y: b.y + b.h - t / 2, w: b.w, h: t },
    { handle: "w", x: b.x - t / 2, y: b.y, w: t, h: b.h },
    { handle: "e", x: b.x + b.w - t / 2, y: b.y, w: t, h: b.h },
  ]
})

const selectedConnector = computed(() => {
  if (store.readOnly) return null
  const s = store.selectedItems
  return s.length === 1 && s[0].type === "connector" ? s[0] : null
})
const connectorEnds = computed(() => {
  const c = selectedConnector.value
  const g = connectorGeometry(c, store.items)
  return [
    { end: "from", p: g.start.p, attached: !!c.from?.id },
    { end: "to", p: g.end.p, attached: !!c.to?.id },
  ]
})

const affordance = computed(() => {
  const d = drag.value
  let id = null, connecting = false
  if (d && (d.kind === "connect" || d.kind === "end")) {
    id = d.target?.id
    connecting = true
  } else if (!d && store.tool === "select" && view.zoom >= 0.2 && !store.readOnly) {
    id = hoverId.value
  }
  const it = id && store.items[id]
  if (!it || !LINKABLE.includes(it.type) || store.editing?.id === id || (it.locked && !connecting)) return null
  const r = rectOf(it)
  const sides = Object.keys(SIDES)
  return {
    id,
    anchors: sides.map((side) => ({ side, p: anchorPoint(r, side), active: connecting && d.target?.side === side })),
    plus: connecting ? [] : sides.map((side) => {
      const p = anchorPoint(r, side)
      return { side, p: { x: p.x + SIDES[side].x * (26 / view.zoom), y: p.y + SIDES[side].y * (26 / view.zoom) } }
    }),
  }
})

const marqueeRect = computed(() => {
  const d = drag.value
  return d?.kind === "marquee" ? rectFromPoints(d.start, d.cur) : null
})

const createPreview = computed(() => {
  const d = drag.value
  return d?.kind === "create" ? createRect(d) : null
})

const draftGeometry = computed(() => {
  const d = drag.value
  if (d?.kind !== "connect" || !d.moved) return null
  const to = d.target ? { id: d.target.id, side: d.target.side || "auto" } : { x: d.cur.x, y: d.cur.y }
  return connectorGeometry({ from: d.from, to, style: { route: "elbow", strokeWidth: 2, endCap: "arrow" } }, store.items)
})

const highlightRects = computed(() =>
  props.highlights.map((id) => store.items[id] && { ...store.bounds(store.items[id]), key: id, active: id === props.activeHighlight }).filter(Boolean),
)

const peerSelections = computed(() => {
  const out = []
  for (const [client, p] of Object.entries(store.peers)) {
    for (const id of p.selection || []) {
      const it = store.items[id]
      if (it) out.push({ ...store.bounds(it), color: p.color, key: client + id })
    }
  }
  return out
})

const peerCursors = computed(() =>
  Object.entries(store.peers)
    .filter(([, p]) => p.cursor)
    .map(([client, p]) => ({ key: client, x: p.cursor.x, y: p.cursor.y, color: p.color || "#5366ce", name: (p.name || "Anonyme").slice(0, 24) })),
)

const cursorClass = computed(() => {
  if (drag.value?.kind === "pan") return "grabbing"
  if (spaceDown.value || store.tool === "hand") return "grab"
  if (store.tool !== "select") return "crosshair"
  return null
})

// ------------------------------------------------------------ hit testing

function hitInfo(el) {
  const hit = el?.closest?.("[data-board-link],[data-handle],[data-anchor],[data-plus],[data-end],[data-label],[data-frame-body],[data-id]")
  if (!hit) return { kind: "bg" }
  const ds = hit.dataset
  if (ds.boardLink) return { kind: "board-link", id: ds.boardLink }
  if (ds.handle) return { kind: "handle", handle: ds.handle }
  if (ds.anchor) return { kind: "anchor", id: ds.owner, side: ds.anchor }
  if (ds.plus) return { kind: "plus", id: ds.owner, side: ds.plus }
  if (ds.end) return { kind: "end", id: ds.owner, end: ds.end }
  if (ds.label !== undefined) return { kind: "label", id: hit.closest("[data-id]").dataset.id, index: Number(ds.label) }
  if ("frameBody" in ds) return { kind: "bg" }
  return { kind: "item", id: ds.id }
}

/** Object (and anchor) under the pointer that a connector end can attach to. */
function linkTargetAt(e, excludeId) {
  for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
    if (!root.value.contains(el)) continue
    const hit = hitInfo(el)
    if (hit.kind === "anchor" && hit.id !== excludeId) return { id: hit.id, side: hit.side }
    if (hit.kind === "item" && hit.id !== excludeId) {
      const it = store.items[hit.id]
      if (it && LINKABLE.includes(it.type)) return { id: it.id, side: "auto" }
    }
  }
  return e.altKey ? null : magnetTarget(toWorld(e), excludeId)
}

/**
 * Magnetism: a connector end close to an object attaches to it, to the anchor
 * point itself when one is within reach (fixed side), otherwise dynamically.
 */
function magnetTarget(p, excludeId) {
  const reach = MAGNET / view.zoom
  let best = null
  for (const it of visible.value.nodes) {
    if (it.id === excludeId || !LINKABLE.includes(it.type)) continue
    const r = rectOf(it)
    if (!containsPoint(inflate(r, reach), p)) continue
    for (const side of Object.keys(SIDES)) {
      const d = dist(p, anchorPoint(r, side))
      if (d < reach && (!best || d < best.d)) best = { id: it.id, side, d }
    }
    // Distance to the outline; offset by `reach` so that a nearby anchor always wins
    const d = reach + Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h))
    if (!best || d < best.d) best = { id: it.id, side: "auto", d }
  }
  return best && { id: best.id, side: best.side }
}

function nodesAt(r, { whole }) {
  return Object.values(store.items).filter((it) => {
    if (it.locked) return false
    const b = store.bounds(it)
    return whole || it.type === "frame" || it.type === "connector" ? contains(r, b) : intersects(r, b)
  })
}

// ------------------------------------------------------------ pointer handling

function onDown(e) {
  quickMenu.value = null
  if (store.editing) store.editing = null
  root.value.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, screenOf(e))
  emit("user-view-change")

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    if (drag.value?.started) store.commit()
    drag.value = { kind: "pinch", d0: dist(a, b), zoom0: view.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ox: view.ox, oy: view.oy }
    return
  }
  if (e.button === 2) return

  const w = toWorld(e)
  const s = screenOf(e)
  if (e.button === 1 || spaceDown.value || store.tool === "hand") {
    drag.value = { kind: "pan", sx: s.x, sy: s.y, ox: view.ox, oy: view.oy }
    return
  }

  const hit = hitInfo(e.target)
  const tool = store.tool

  // Link to another board (readers can follow it too)
  if (hit.kind === "board-link") {
    emit("open-board", hit.id)
    return
  }

  // Readers select and navigate, nothing else
  if (store.readOnly && hit.kind === "item") {
    store.select(e.shiftKey ? [...store.selection, hit.id] : [hit.id])
    return
  }
  if (store.readOnly && hit.kind !== "bg") return

  if (["shape", "sticky", "text", "frame"].includes(tool)) {
    drag.value = { kind: "create", tool, start: w, cur: w, shift: false }
    return
  }
  if (tool === "connector") {
    const it = hit.kind === "item" && store.items[hit.id]
    const from = it && LINKABLE.includes(it.type) ? { id: it.id, side: "auto" } : { x: w.x, y: w.y }
    drag.value = { kind: "connect", from, cur: w, start: s, moved: false, target: null }
    return
  }

  switch (hit.kind) {
    case "handle":
      startResize(hit.handle, w)
      break
    case "anchor":
      drag.value = { kind: "connect", from: { id: hit.id, side: hit.side }, cur: w, start: s, moved: false, target: null }
      break
    case "plus":
      drag.value = { kind: "plus", id: hit.id, side: hit.side, start: s }
      break
    case "end":
      store.begin()
      drag.value = { kind: "end", id: hit.id, end: hit.end, target: null }
      break
    case "label":
      store.select([hit.id])
      store.begin()
      drag.value = { kind: "label", id: hit.id, index: hit.index }
      break
    case "item": {
      const it = store.items[hit.id]
      const already = store.selection.includes(hit.id)
      if (e.shiftKey) {
        const ids = store.withGroups([hit.id])
        store.select(already ? store.selection.filter((id) => !ids.includes(id)) : [...store.selection, ...ids])
        return
      }
      if (!already) store.select([hit.id])
      if (it.locked) return
      startMove(w, s, already ? hit.id : null)
      break
    }
    default:
      if (e.pointerType === "touch") {
        drag.value = { kind: "pan", sx: s.x, sy: s.y, ox: view.ox, oy: view.oy }
        return
      }
      if (!e.shiftKey) store.select([])
      drag.value = { kind: "marquee", start: w, cur: w, base: e.shiftKey ? store.selection.slice() : [] }
  }
}

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, screenOf(e))
  const w = toWorld(e)
  lastPointer.value = w
  store.sendPresence({ cursor: { x: Math.round(w.x), y: Math.round(w.y) } })

  const d = drag.value
  if (!d) {
    updateHover(e, w)
    return
  }
  const s = screenOf(e)
  switch (d.kind) {
    case "pan":
      view.ox = d.ox + s.x - d.sx
      view.oy = d.oy + s.y - d.sy
      break
    case "pinch": {
      const [a, b] = [...pointers.values()]
      if (!b) return
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const zoom = Math.min(4, Math.max(0.1, d.zoom0 * (dist(a, b) / d.d0)))
      const wx = (d.mid.x - d.ox) / d.zoom0, wy = (d.mid.y - d.oy) / d.zoom0
      view.zoom = zoom
      view.ox = mid.x - wx * zoom
      view.oy = mid.y - wy * zoom
      break
    }
    case "marquee": {
      d.cur = w
      const r = rectFromPoints(d.start, d.cur)
      store.select([...d.base, ...nodesAt(r, { whole: false }).map((it) => it.id)])
      break
    }
    case "create":
      d.cur = w
      d.shift = e.shiftKey
      break
    case "move":
      moveTo(d, w, s, e.altKey)
      break
    case "resize":
      resizeTo(d, w, e.shiftKey, e.altKey)
      break
    case "plus":
      if (dist(s, d.start) > 5) {
        drag.value = { kind: "connect", from: { id: d.id, side: "auto" }, cur: w, start: d.start, moved: true, target: null }
      }
      break
    case "connect":
      d.cur = w
      d.moved ||= dist(s, d.start) > 5
      d.target = linkTargetAt(e, d.from.id)
      break
    case "end": {
      const conn = store.items[d.id]
      if (!conn) return
      const other = d.end === "from" ? conn.to : conn.from
      d.target = linkTargetAt(e, other?.id)
      store.updateItem(d.id, { [d.end]: d.target || { x: w.x, y: w.y } })
      break
    }
    case "label": {
      const conn = store.items[d.id]
      if (!conn) return
      const t = nearestT(connectorGeometry(conn, store.items).samples, w)
      const labels = conn.labels.map((l, i) => (i === d.index ? { ...l, t } : l))
      store.updateItem(d.id, { labels })
      break
    }
  }
}

function onUp(e) {
  pointers.delete(e.pointerId)
  const d = drag.value
  if (!d) return
  if (d.kind === "pinch") {
    if (pointers.size === 0) drag.value = null
    return
  }
  drag.value = null
  guides.value = []

  switch (d.kind) {
    case "move":
      if (d.started) {
        assignParents(d.ids)
        store.commit()
      } else if (d.clickedId && store.selection.length > 1) {
        store.select([d.clickedId])
      }
      break
    case "resize":
      if (d.started) store.commit()
      break
    case "create":
      finishCreate(d)
      break
    case "connect":
      finishConnect(d)
      break
    case "plus":
      createLinked(d.id, d.side)
      break
    case "end":
    case "label":
      store.commit()
      break
  }
}

function onLeave() {
  if (!drag.value) {
    hoverId.value = null
    store.sendPresence({ cursor: null })
  }
}

function updateHover(e, w) {
  if (e.target.closest?.("[data-owner]")) return
  const hit = hitInfo(e.target)
  const it = hit.kind === "item" && store.items[hit.id]
  if (it && LINKABLE.includes(it.type)) {
    hoverId.value = it.id
    return
  }
  const cur = hoverId.value && store.items[hoverId.value]
  if (cur && containsPoint(inflate(rectOf(cur), 40 / view.zoom), w)) return
  hoverId.value = null
}

function onWheel(e) {
  emit("user-view-change")
  if (e.ctrlKey || e.metaKey) {
    const delta = Math.max(-50, Math.min(50, e.deltaMode ? e.deltaY * 20 : e.deltaY))
    zoomAt(screenOf(e), view.zoom * Math.exp(-delta * 0.006))
  } else {
    view.ox -= e.shiftKey ? e.deltaY : e.deltaX
    view.oy -= e.shiftKey ? 0 : e.deltaY
  }
}

// ------------------------------------------------------------ move & snapping

function startMove(w, s, clickedId) {
  const ids = new Set(store.selection.filter((id) => !store.items[id]?.locked))
  // Objects inside a moved frame follow it
  const frames = [...ids].filter((id) => store.items[id]?.type === "frame")
  if (frames.length) {
    for (const it of Object.values(store.items)) if (frames.includes(it.parent) && !it.locked) ids.add(it.id)
  }
  const orig = {}
  const nodeRects = []
  for (const id of ids) {
    const it = store.items[id]
    if (it.type === "connector") orig[id] = { from: { ...it.from }, to: { ...it.to } }
    else {
      orig[id] = { x: it.x, y: it.y }
      nodeRects.push(rectOf(it))
    }
  }
  const vp = inflate(viewport.value, 100 / view.zoom)
  const snapTargets = Object.values(store.items)
    .filter((it) => it.type !== "connector" && !ids.has(it.id) && intersects(rectOf(it), vp))
    .map(rectOf)
  drag.value = { kind: "move", start: w, startScreen: s, ids: [...ids], orig, box: union(nodeRects), snapTargets, started: false, clickedId }
}

function moveTo(d, w, s, alt) {
  if (!d.started) {
    if (dist(s, d.startScreen) < 3) return
    d.started = true
    store.begin()
  }
  let dx = w.x - d.start.x, dy = w.y - d.start.y
  if (d.box) ({ dx, dy } = snap(d, dx, dy, alt))
  for (const id of d.ids) {
    const o = d.orig[id], it = store.items[id]
    if (!it) continue
    if (it.type === "connector") {
      const patch = {}
      for (const end of ["from", "to"]) if (!o[end].id) patch[end] = { x: o[end].x + dx, y: o[end].y + dy }
      if (Object.keys(patch).length) store.updateItem(id, patch)
    } else {
      store.updateItem(id, { x: o.x + dx, y: o.y + dy })
    }
  }
}

function snap(d, dx, dy, alt) {
  guides.value = []
  const b = d.box
  if (alt) return { dx, dy }
  if (store.settings.snapGrid) {
    return { dx: Math.round((b.x + dx) / GRID) * GRID - b.x, dy: Math.round((b.y + dy) / GRID) * GRID - b.y }
  }
  const tol = 6 / view.zoom
  const box = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }
  const xs = [box.x, box.x + box.w / 2, box.x + box.w]
  const ys = [box.y, box.y + box.h / 2, box.y + box.h]
  let bx = null, by = null
  for (const r of d.snapTargets) {
    for (const t of [r.x, r.x + r.w / 2, r.x + r.w]) {
      for (const v of xs) if (Math.abs(t - v) < tol && (!bx || Math.abs(t - v) < Math.abs(bx.delta))) bx = { delta: t - v, at: t }
    }
    for (const t of [r.y, r.y + r.h / 2, r.y + r.h]) {
      for (const v of ys) if (Math.abs(t - v) < tol && (!by || Math.abs(t - v) < Math.abs(by.delta))) by = { delta: t - v, at: t }
    }
  }
  if (bx) dx += bx.delta
  if (by) dy += by.delta
  const moved = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }
  const lines = []
  const near = (a, c) => Math.abs(a - c) < 0.5
  if (bx) {
    const rs = d.snapTargets.filter((r) => [r.x, r.x + r.w / 2, r.x + r.w].some((t) => near(t, bx.at)))
    const all = [...rs, moved]
    lines.push({ x1: bx.at, x2: bx.at, y1: Math.min(...all.map((r) => r.y)) - 10, y2: Math.max(...all.map((r) => r.y + r.h)) + 10 })
  }
  if (by) {
    const rs = d.snapTargets.filter((r) => [r.y, r.y + r.h / 2, r.y + r.h].some((t) => near(t, by.at)))
    const all = [...rs, moved]
    lines.push({ y1: by.at, y2: by.at, x1: Math.min(...all.map((r) => r.x)) - 10, x2: Math.max(...all.map((r) => r.x + r.w)) + 10 })
  }
  guides.value = lines
  return { dx, dy }
}

/** Objects dropped inside a frame belong to it (and follow it). */
function assignParents(ids) {
  const frames = Object.values(store.items).filter((it) => it.type === "frame").sort((a, b) => b.z - a.z)
  for (const id of ids) {
    const it = store.items[id]
    if (!it || it.type === "frame" || it.type === "connector") continue
    const c = center(rectOf(it))
    const parent = frames.find((f) => containsPoint(rectOf(f), c))?.id || null
    if (parent !== (it.parent || null)) store.updateItem(id, { parent })
  }
}

// ------------------------------------------------------------ resize

function startResize(handle, w) {
  const nodes = selectedNodes.value.filter((it) => !it.locked)
  const orig = Object.fromEntries(nodes.map((it) => [it.id, rectOf(it)]))
  const keepRatio = nodes.length > 1 || nodes.some((it) => it.type === "image")
  drag.value = { kind: "resize", handle, start: w, box: union(Object.values(orig)), orig, keepRatio, started: false }
}

function resizeTo(d, w, shift, alt) {
  if (!d.started) {
    d.started = true
    store.begin()
  }
  const b = d.box, h = d.handle
  let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h
  const g = (v) => (store.settings.snapGrid && !alt ? Math.round(v / GRID) * GRID : v)
  const min = 12
  if (h.includes("w")) x1 = Math.min(g(w.x), x2 - min)
  if (h.includes("e")) x2 = Math.max(g(w.x), x1 + min)
  if (h.includes("n")) y1 = Math.min(g(w.y), y2 - min)
  if (h.includes("s")) y2 = Math.max(g(w.y), y1 + min)
  if ((d.keepRatio || shift) && h.length === 2) {
    const ratio = b.w / b.h
    let nw = x2 - x1, nh = y2 - y1
    if (nw / nh > ratio) nw = nh * ratio
    else nh = nw / ratio
    if (h.includes("w")) x1 = x2 - nw
    else x2 = x1 + nw
    if (h.includes("n")) y1 = y2 - nh
    else y2 = y1 + nh
  }
  const sx = (x2 - x1) / b.w, sy = (y2 - y1) / b.h
  for (const [id, o] of Object.entries(d.orig)) {
    store.updateItem(id, { x: x1 + (o.x - b.x) * sx, y: y1 + (o.y - b.y) * sy, w: Math.max(4, o.w * sx), h: Math.max(4, o.h * sy) })
  }
}

// ------------------------------------------------------------ creation

function createRect(d) {
  const r = rectFromPoints(d.start, d.cur)
  if (d.shift) {
    const s = Math.max(r.w, r.h)
    r.w = r.h = s
    if (d.cur.x < d.start.x) r.x = d.start.x - s
    if (d.cur.y < d.start.y) r.y = d.start.y - s
  }
  return r
}

function parentAt(p) {
  return Object.values(store.items)
    .filter((it) => it.type === "frame" && containsPoint(rectOf(it), p))
    .sort((a, b) => b.z - a.z)[0]?.id || null
}

function snapPoint(v) {
  return store.settings.snapGrid ? Math.round(v / GRID) * GRID : v
}

function finishCreate(d) {
  const r = createRect(d)
  const it = makeItem(d.tool, d.tool === "shape" ? { shape: store.shapeKind } : {})
  if (r.w * view.zoom < 8 && r.h * view.zoom < 8) {
    // Simple click: default size, centered on the click (texts start at the click)
    it.x = snapPoint(d.tool === "text" ? d.start.x : d.start.x - it.w / 2)
    it.y = snapPoint(d.start.y - it.h / 2)
  } else {
    it.x = r.x
    it.y = r.y
    it.w = Math.max(r.w, 20)
    if (d.tool !== "text") it.h = Math.max(r.h, 20)
  }
  if (it.type !== "frame") it.parent = parentAt(center(rectOf(it)))
  else it.z = Math.min(0, ...Object.values(store.items).filter((x) => x.type === "frame").map((x) => x.z - 1))
  store.addItem(it)
  store.select([it.id])
  store.tool = "select"
  if (hasText(it)) store.editing = { id: it.id }
}

function finishConnect(d) {
  store.tool = "select"
  if (!d.moved) return
  const to = d.target ? { id: d.target.id, side: d.target.side || "auto" } : { x: d.cur.x, y: d.cur.y }
  const conn = makeItem("connector", { from: d.from, to })
  store.addItem(conn)
  if (d.target) {
    store.select([conn.id])
  } else {
    // Released in the void: offer to create an object there, already linked
    const s = { x: d.cur.x * view.zoom + view.ox, y: d.cur.y * view.zoom + view.oy }
    quickMenu.value = { connId: conn.id, point: d.cur, sx: Math.min(s.x, size.w - 180), sy: Math.min(s.y, size.h - 230) }
    store.select([conn.id])
  }
}

function quickCreate(q) {
  const { connId, point } = quickMenu.value
  quickMenu.value = null
  const conn = store.items[connId]
  if (!conn) return
  const fromItem = conn.from?.id && store.items[conn.from.id]
  const origin = fromItem ? center(rectOf(fromItem)) : conn.from
  const it = makeItem(q.type, q.shape ? { shape: q.shape } : {})
  const dx = point.x - origin.x, dy = point.y - origin.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    it.x = dx >= 0 ? point.x : point.x - it.w
    it.y = point.y - it.h / 2
  } else {
    it.x = point.x - it.w / 2
    it.y = dy >= 0 ? point.y : point.y - it.h
  }
  it.parent = parentAt(center(rectOf(it)))
  store.mutate(() => {
    store.addItem(it)
    store.updateItem(connId, { to: { id: it.id, side: "auto" } })
  })
  store.select([it.id])
  if (hasText(it)) store.editing = { id: it.id }
}

/** "+" arrow: clone the object on that side, linked and aligned, and start typing in it. */
function createLinked(srcId, side) {
  const src = store.items[srcId]
  if (!src) return
  const dir = SIDES[side]
  const gap = 80
  // An image is continued by a regular shape of the same size
  const it = src.type === "image"
    ? makeItem("shape", { w: src.w, h: src.h })
    : makeItem(src.type, { shape: src.shape, w: src.w, h: src.h, style: JSON.parse(JSON.stringify(src.style || {})) })
  it.parent = src.parent || null
  it.x = src.x + dir.x * (src.w + gap)
  it.y = src.y + dir.y * (src.h + gap)
  // Do not drop the new object on top of an existing one: slide it along the side
  const step = dir.x ? { x: 0, y: it.h + 40 } : { x: it.w + 40, y: 0 }
  const others = Object.values(store.items).filter((x) => x.type !== "connector" && x.type !== "frame")
  for (let i = 0; i < 30 && others.some((o) => intersects(inflate(rectOf(it), 10), rectOf(o))); i++) {
    it.x += step.x
    it.y += step.y
  }
  const conn = makeItem("connector", { from: { id: srcId, side: "auto" }, to: { id: it.id, side: "auto" } })
  store.mutate(() => {
    store.addItem(it)
    store.addItem(conn)
  })
  store.select([it.id])
  ensureVisible(rectOf(it))
  if (hasText(it)) store.editing = { id: it.id }
}

// ------------------------------------------------------------ double click & drop

function onDblClick(e) {
  if (store.tool !== "select" || store.readOnly) return
  // The pointer capture of the canvas retargets click events: look at what is really under the pointer
  const hit = hitInfo(document.elementFromPoint(e.clientX, e.clientY))
  const w = toWorld(e)
  if (hit.kind === "label") {
    store.editing = { id: hit.id, label: hit.index }
    return
  }
  if (hit.kind === "item") {
    const it = store.items[hit.id]
    if (!it || it.locked) return
    if (it.type === "connector") {
      const t = nearestT(connectorGeometry(it, store.items).samples, w)
      const labels = [...(it.labels || []), { t, text: "" }]
      store.updateItem(it.id, { labels })
      store.select([it.id])
      store.editing = { id: it.id, label: labels.length - 1 }
    } else if (hasText(it) || it.type === "frame") {
      store.select([it.id])
      store.editing = { id: it.id, selectAll: !!plainText(it.text).trim() }
    }
    return
  }
  // Double-click on the canvas creates a text
  const it = makeItem("text", { x: w.x, y: w.y - 16 })
  it.parent = parentAt(w)
  store.addItem(it)
  store.select([it.id])
  store.editing = { id: it.id }
}

function onDrop(e) {
  if (store.readOnly) return
  const files = [...(e.dataTransfer?.files || [])]
  if (files.length) emit("files", files, toWorld(e))
}

// ------------------------------------------------------------ lifecycle

function onKey(e) {
  if (e.code !== "Space" || e.target.closest?.("input, textarea, [contenteditable]")) return
  if (e.type === "keydown") e.preventDefault()
  spaceDown.value = e.type === "keydown"
}

let resizeObserver
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const r = root.value.getBoundingClientRect()
    size.w = r.width
    size.h = r.height
  })
  resizeObserver.observe(root.value)
  window.addEventListener("keydown", onKey)
  window.addEventListener("keyup", onKey)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("keyup", onKey)
})

watch(() => [view.ox, view.oy, view.zoom, size.w, size.h], () => {
  const c = worldCenter()
  store.sendPresence({ view: { x: Math.round(c.x), y: Math.round(c.y), zoom: view.zoom } })
})

defineExpose({
  svg, size, lastPointer, textEditor, viewport,
  zoomAt, zoomBy, fitRect, centerOn, ensureVisible, worldCenter, createLinked,
})
</script>

<style scoped lang="scss">
.canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: #fbfcfe;

  &.grab {
    cursor: grab;
  }

  &.grabbing {
    cursor: grabbing;
  }

  &.crosshair {
    cursor: crosshair;
  }
}

.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ui {
  pointer-events: none;

  [data-handle],
  [data-anchor],
  [data-plus],
  [data-end] {
    pointer-events: all;
  }
}

.plus {
  cursor: pointer;
  opacity: 0.85;

  &:hover {
    opacity: 1;
  }
}

.quick-menu {
  position: absolute;
  z-index: 6;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 6px;
  background: white;
  border: 1px solid #e5e9f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(27, 36, 51, 0.14);

  p {
    margin: 4px 8px 6px;
    font-size: 0.75em;
    font-weight: 700;
    text-transform: uppercase;
    color: #8a909b;
  }

  button {
    border: 0;
    background: none;
    text-align: left;
    padding: 7px 10px;
    border-radius: 6px;
    font: inherit;
    font-size: 0.9em;
    color: #2e333d;
    cursor: pointer;

    &:hover {
      background: #ecf1ff;
    }

    &.muted {
      color: #8a909b;
    }
  }
}
</style>
