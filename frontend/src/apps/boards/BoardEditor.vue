<template>
  <div class="board-page light-theme">
    <div v-if="notFound" class="not-found">
      <h1>Board introuvable</h1>
      <p>Ce lien ne correspond à aucun board (il a peut-être été supprimé).</p>
      <router-link :to="auth.isLoggedIn ? '/boards' : '/'" class="btn btn-primary">{{ auth.isLoggedIn ? "Mes boards" : "Accueil" }}</router-link>
    </div>

    <template v-else>
      <header class="topbar">
        <button v-if="auth.isLoggedIn" type="button" class="icon-btn" :class="{ active: sidebarOpen }"
          :title="sidebarOpen ? 'Masquer la liste des boards' : 'Afficher la liste des boards'" aria-label="Liste des boards"
          :aria-pressed="sidebarOpen" @click="toggleSidebar"><Icon name="sidebar" :size="20" /></button>
        <router-link :to="auth.isLoggedIn ? '/boards' : '/'" class="icon-btn" :title="auth.isLoggedIn ? 'Mes boards' : 'Accueil'"
          :aria-label="auth.isLoggedIn ? 'Mes boards' : 'Accueil'"><Icon name="back_arrow" :size="20" /></router-link>
        <input v-model="title" class="title" aria-label="Titre du board" maxlength="200" :readonly="store.readOnly"
          @keydown.enter="$event.target.blur()" @keydown.stop @blur="saveTitle" />
        <span v-if="store.role && store.role !== 'owner'" class="badge" :class="store.role"
          :title="`Board de ${ownerName}`">{{ store.readOnly ? "Lecture seule" : "Partagé" }} · {{ ownerName }}</span>
        <!-- Opened through a share link without an account -->
        <span v-if="!auth.isLoggedIn" class="guest">
          Invité · <router-link :to="{ name: 'login', query: { next: route.fullPath } }">Se connecter</router-link>
        </span>
        <span class="status" :class="store.status">{{ STATUS[store.status] }}</span>

        <div class="spacer"></div>

        <div class="peers">
          <button v-for="p in peerList" :key="p.client" type="button" class="avatar" :class="{ following: following === p.client }"
            :style="{ background: p.color }" :title="following === p.client ? `Arrêter de suivre ${p.name}` : `Suivre la vue de ${p.name}`"
            @click="toggleFollow(p.client)">{{ initials(p.name) }}</button>
          <span class="avatar me" :style="{ background: store.me.color }" :title="`Vous : ${store.me.name}`">{{ initials(store.me.name) }}</span>
        </div>

        <button type="button" class="icon-btn" title="Rechercher (Ctrl+F)" aria-label="Rechercher" @click="openSearch"><Icon name="search" /></button>
        <div class="menu">
          <button type="button" class="icon-btn" title="Paramètres du board" aria-label="Paramètres" @click="toggleMenu('settings')"><Icon name="settings" /></button>
          <div v-if="menu === 'settings'" class="dropdown">
            <p>Fond</p>
            <button v-for="(label, k) in BACKGROUNDS" :key="k" type="button" :class="{ active: store.meta.background === k }"
              :disabled="store.readOnly" @click="store.setMeta({ background: k })">{{ label }}</button>
            <p>Aides</p>
            <label><input v-model="store.settings.snapGrid" type="checkbox" /> Magnétisme sur la grille</label>
            <label><input v-model="store.settings.minimap" type="checkbox" /> Minimap</label>
          </div>
        </div>
        <div class="menu">
          <button type="button" class="icon-btn" title="Exporter" aria-label="Exporter" @click="toggleMenu('export')"><Icon name="download" /></button>
          <div v-if="menu === 'export'" class="dropdown">
            <p>Contenu</p>
            <label><input v-model="exportScope" type="radio" value="all" /> Board entier</label>
            <label :class="{ disabled: !store.selection.length }"><input v-model="exportScope" type="radio" value="selection"
              :disabled="!store.selection.length" /> Sélection / cadre</label>
            <p>PNG</p>
            <label>Résolution
              <select v-model.number="exportScale"><option :value="1">1x</option><option :value="2">2x</option><option :value="3">3x</option></select>
            </label>
            <label><input v-model="exportTransparent" type="checkbox" /> Fond transparent</label>
            <div class="row">
              <button type="button" class="btn btn-primary" @click="doExport('png')">PNG</button>
              <button type="button" class="btn btn-secondary" @click="doExport('svg')">SVG</button>
              <button type="button" class="btn btn-secondary" @click="doExport('pdf')">PDF</button>
            </div>
            <button type="button" class="link" @click="doExport('clipboard')">Copier en image</button>
            <button type="button" class="link" title="Code à coller dans « Importer » (Mes boards) pour recréer ce board"
              @click="copyCode">Copier le code du board</button>
          </div>
        </div>
        <button v-if="store.role === 'owner'" type="button" class="btn btn-primary share" @click="shareOpen = true">
          <Icon name="share" :size="16" /> Partager
        </button>
      </header>

      <div class="body">
      <BoardSidebar v-if="sidebarOpen && auth.isLoggedIn" :current-id="store.meta.id" :current-title="store.meta.title" />
      <main class="workspace">
        <BoardCanvas ref="canvas" :highlights="search.open ? search.results : []" :active-highlight="search.results[search.index]"
          @files="addImages" @user-view-change="following = null" @open-board="openBoard" />
        <Toolbar ref="toolbar" :read-only="store.readOnly" @image="pickImage" @help="help = true" />
        <PropertiesBar v-if="canvas && !store.readOnly" :canvas-size="canvas.size" :busy="store.exporting" @command="textCommand" />

        <div v-if="search.open" class="search" @pointerdown.stop>
          <Icon name="search" :size="16" />
          <input ref="searchInput" v-model="search.query" placeholder="Rechercher dans le board" aria-label="Rechercher"
            @keydown.stop="onSearchKey" />
          <span class="count">{{ search.results.length ? `${search.index + 1} / ${search.results.length}` : "0" }}</span>
          <button type="button" aria-label="Fermer la recherche" @click="closeSearch"><Icon name="close" :size="16" /></button>
        </div>

        <div class="zoombar">
          <button type="button" title="Zoom arrière" aria-label="Zoom arrière" @click="canvas.zoomBy(1 / 1.25)"><Icon name="minus" :size="16" /></button>
          <input :value="Math.round(store.view.zoom * 100) + '%'" aria-label="Niveau de zoom" @keydown.stop @change="setZoom($event.target)" />
          <button type="button" title="Zoom avant" aria-label="Zoom avant" @click="canvas.zoomBy(1.25)"><Icon name="plus" :size="16" /></button>
          <button type="button" title="Tout afficher (Maj+1)" aria-label="Tout afficher" @click="fitAll"><Icon name="fit" :size="16" /></button>
          <button type="button" title="Minimap" aria-label="Minimap" :class="{ active: store.settings.minimap }"
            @click="store.settings.minimap = !store.settings.minimap"><Icon name="map" :size="16" /></button>
        </div>
        <Minimap v-if="store.settings.minimap && canvas" :viewport="canvas.viewport" @navigate="(p) => canvas.centerOn(p)" />

        <div v-if="toast" class="toast" role="status">{{ toast }}</div>
      </main>
      </div>

      <HelpPanel v-if="help" @close="help = false" />
      <ShareDialog v-if="shareOpen" :board-id="store.meta.id" @close="shareOpen = false" />
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple hidden
        @change="onFilePicked" />
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue"
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router"
import BoardCanvas from "./components/BoardCanvas.vue"
import Toolbar from "./components/Toolbar.vue"
import PropertiesBar from "./components/PropertiesBar.vue"
import Minimap from "./components/Minimap.vue"
import HelpPanel from "./components/HelpPanel.vue"
import ShareDialog from "./components/ShareDialog.vue"
import BoardSidebar from "./components/BoardSidebar.vue"
import Icon from "@/components/Icon.vue"
import { useBoardStore } from "./store"
import { useAuthStore } from "@/stores/auth"
import { boardsApi, mediaUrl } from "./lib/api"
import { hasText, makeItem } from "./lib/defaults"
import { center, union } from "./lib/geometry"
import { escapeHtml, plainText } from "./lib/sanitize"
import { buildSvg, download, pngToPdfBlob, safeFilename, svgToPngBlob } from "./lib/exporter"
import { encodeBoard } from "./lib/transfer"

const STATUS = { connecting: "Connexion…", offline: "Hors ligne · modifications conservées", saving: "Enregistrement…", saved: "Enregistré" }
const BACKGROUNDS = { dots: "Grille de points", grid: "Quadrillage", plain: "Uni" }

const route = useRoute()
const router = useRouter()
const store = useBoardStore()
const auth = useAuthStore()
const canvas = ref(null)
const toolbar = ref(null)
const fileInput = ref(null)
const searchInput = ref(null)
const notFound = ref(false)
const title = ref("")
const menu = ref(null)
const help = ref(false)
const shareOpen = ref(false)

// Side panel listing the boards; its state is remembered by the browser
const sidebarOpen = ref(readSidebarPref())

function readSidebarPref() {
  try {
    return localStorage.getItem("boards.sidebar") === "1"
  } catch {
    return false
  }
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  try {
    localStorage.setItem("boards.sidebar", sidebarOpen.value ? "1" : "0")
  } catch {
    // storage unavailable: the panel just won't stay open after a reload
  }
}
const ownerName = ref("")
const toast = ref("")
const following = ref(null)
const exportScope = ref("all")
const exportScale = ref(2)
const exportTransparent = ref(false)
const search = reactive({ open: false, query: "", index: 0, results: [] })
let pasteInPlace = false
let fitted = false
let timers = []

const boardId = computed(() => route.params.id)
// Token of the share link, when the board is opened without an account
const share = computed(() => route.query.share || null)

// Handy for debugging and end-to-end tests
if (import.meta.env.DEV) window.__board = store

const peerList = computed(() =>
  Object.entries(store.peers).map(([client, p]) => ({ client, name: p.name || "Anonyme", color: p.color || "#5366ce" })),
)

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()

// ------------------------------------------------------------ loading

async function load() {
  notFound.value = false
  fitted = false
  try {
    const board = await boardsApi.get(boardId.value, share.value)
    title.value = board.title
    ownerName.value = board.owner_name
    store.open(board.id, { share: share.value })
    store.role = board.role
    // Render the REST snapshot right away; the WebSocket "init" replaces it once connected
    store.meta.title = board.title
    store.meta.background = board.background
    for (const it of board.items) store.items[it.id] = it
    document.title = `${board.title} · Boards`
    await nextTick()
    fitAll(true)
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 400) notFound.value = true
    else showToast("Impossible de charger le board.")
  }
}

watch(() => store.meta.title, (t) => {
  if (document.activeElement?.classList?.contains("title")) return
  title.value = t
  document.title = `${t} · Boards`
})

function saveTitle() {
  if (store.readOnly) return
  const t = title.value.trim() || "Sans titre"
  title.value = t
  if (t !== store.meta.title) store.setMeta({ title: t })
}

function fitAll(initial = false) {
  if (initial && fitted) return
  const b = store.boundsOf(Object.keys(store.items))
  if (b) canvas.value.fitRect(b, 1)
  else canvas.value.centerOn({ x: 0, y: 0 }, 1)
  fitted = true
}

function fitSelection() {
  const b = store.boundsOf(store.selection)
  if (b) canvas.value.fitRect(b, 2)
}

function setZoom(el) {
  const v = parseFloat(el.value)
  if (v > 0) canvas.value.zoomAt({ x: canvas.value.size.w / 2, y: canvas.value.size.h / 2 }, v / 100)
  el.value = Math.round(store.view.zoom * 100) + "%"
}

// ------------------------------------------------------------ collaboration

function toggleFollow(client) {
  following.value = following.value === client ? null : client
  if (following.value) followView()
}

function followView() {
  const v = following.value && store.peers[following.value]?.view
  if (v) canvas.value.centerOn({ x: v.x, y: v.y }, v.zoom)
}

watch(() => following.value && store.peers[following.value]?.view, followView)
watch(() => following.value && !store.peers[following.value], (gone) => gone && (following.value = null))

// Readers keep the select / hand tools only
watch(() => store.readOnly, (ro) => {
  if (ro && !["select", "hand"].includes(store.tool)) store.tool = "select"
})

// ------------------------------------------------------------ menus, toast, search

function toggleMenu(name) {
  menu.value = menu.value === name ? null : name
}

function showToast(message) {
  toast.value = message
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => (toast.value = ""), 3500)
}

async function openSearch() {
  search.open = true
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
}

function closeSearch() {
  search.open = false
  search.query = ""
}

watch(() => [search.query, search.open], () => {
  const q = search.query.trim().toLowerCase()
  search.index = 0
  if (!q) {
    search.results = []
    return
  }
  search.results = Object.values(store.items)
    .filter((it) => {
      const text = [plainText(it.text), ...(it.labels || []).map((l) => l.text)].join(" ").toLowerCase()
      return text.includes(q)
    })
    .sort((a, b) => (store.bounds(a).y - store.bounds(b).y) || (store.bounds(a).x - store.bounds(b).x))
    .map((it) => it.id)
  focusResult()
})

function focusResult() {
  const id = search.results[search.index]
  if (id && store.items[id]) canvas.value.centerOn(center(store.bounds(store.items[id])), Math.max(store.view.zoom, 0.6))
}

function onSearchKey(e) {
  if (e.key === "Escape") closeSearch()
  if (e.key === "Enter" && search.results.length) {
    search.index = (search.index + (e.shiftKey ? search.results.length - 1 : 1)) % search.results.length
    focusResult()
  }
}

// ------------------------------------------------------------ images

function pickImage() {
  fileInput.value.click()
}

function onFilePicked(e) {
  addImages([...e.target.files], canvas.value.worldCenter())
  e.target.value = ""
}

function imageSize(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 320, h: img.naturalHeight || 240 })
    img.onerror = () => resolve({ w: 320, h: 240 })
    img.src = url
  })
}

async function addImages(files, at) {
  if (store.readOnly) return
  const images = files.filter((f) => f.type.startsWith("image/"))
  if (!images.length) return
  const created = []
  for (const [i, file] of images.entries()) {
    try {
      const url = await boardsApi.upload(store.meta.id, file, share.value)
      let { w, h } = await imageSize(mediaUrl(url))
      const k = Math.min(1, 400 / Math.max(w, h))
      w = Math.round(w * k)
      h = Math.round(h * k)
      const it = makeItem("image", { src: url, x: at.x - w / 2 + i * 24, y: at.y - h / 2 + i * 24, w, h })
      store.addItem(it)
      created.push(it.id)
    } catch (err) {
      showToast(err.response?.data?.file || "Échec de l'envoi de l'image.")
    }
  }
  store.select(created)
}

// ------------------------------------------------------------ export

async function doExport(format) {
  menu.value = null
  let ids = null
  if (exportScope.value === "selection" && store.selection.length) {
    const set = new Set(store.selection)
    for (const it of Object.values(store.items)) if (set.has(it.parent)) set.add(it.id)
    for (const it of Object.values(store.items)) {
      if (it.type === "connector" && set.has(it.from?.id) && set.has(it.to?.id)) set.add(it.id)
    }
    ids = [...set]
  }
  const bounds = store.boundsOf(ids || Object.keys(store.items))
  if (!bounds) {
    showToast("Rien à exporter.")
    return
  }
  const selection = store.selection
  store.selection = []
  store.exporting = true
  try {
    await nextTick()
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const transparent = exportTransparent.value && format !== "pdf"
    const out = await buildSvg(canvas.value.svg, bounds, { ids, background: transparent ? null : "#ffffff" })
    const name = safeFilename(store.meta.title)
    if (format === "svg") {
      download(new Blob([out.svg], { type: "image/svg+xml" }), `${name}.svg`)
    } else {
      const png = await svgToPngBlob(out, format === "pdf" ? 2 : exportScale.value)
      if (format === "png") download(png, `${name}.png`)
      else if (format === "pdf") download(await pngToPdfBlob(png, out.width, out.height), `${name}.pdf`)
      else {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": png })])
        showToast("Image copiée dans le presse-papiers.")
      }
    }
  } catch (err) {
    console.error(err)
    showToast("L'export a échoué.")
  } finally {
    store.exporting = false
    store.selection = selection
  }
}

function openBoard(id) {
  if (id !== store.meta.id) router.push({ name: "board", params: { id } })
}

async function copyCode() {
  menu.value = null
  const code = await encodeBoard({ title: store.meta.title, background: store.meta.background, items: Object.values(store.items) })
  try {
    await navigator.clipboard.writeText(code)
    showToast("Code du board copié : collez-le dans « Importer » (Mes boards) pour le recréer.")
  } catch {
    window.prompt("Code d'export du board", code)
  }
}

// ------------------------------------------------------------ clipboard

const isTyping = (e) => store.editing || e.target.closest?.("input, textarea, select, [contenteditable]")

function onCopy(e) {
  if (isTyping(e) || !store.selection.length) return
  e.preventDefault()
  const payload = JSON.stringify(store.copyPayload(store.selection))
  e.clipboardData.setData("text/plain", payload)
  try {
    localStorage.setItem("boards.clipboard", payload)
  } catch {
    // ignore
  }
  if (e.type === "cut") store.removeItems(store.selection)
}

function pasteOffset(payload) {
  if (pasteInPlace) return { x: 0, y: 0 }
  const b = union(payload.items.filter((it) => it.type !== "connector").map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h })))
  const p = canvas.value.lastPointer
  const vp = canvas.value.viewport
  if (!b) return { x: 20, y: 20 }
  const target = p && p.x > vp.x && p.y > vp.y && p.x < vp.x + vp.w && p.y < vp.y + vp.h ? p : center(vp)
  return { x: Math.round(target.x - (b.x + b.w / 2)), y: Math.round(target.y - (b.y + b.h / 2)) }
}

function onPaste(e) {
  if (isTyping(e) || store.readOnly) return
  const files = [...(e.clipboardData?.files || [])]
  if (files.length) {
    e.preventDefault()
    addImages(files, canvas.value.lastPointer || canvas.value.worldCenter())
    return
  }
  const text = e.clipboardData?.getData("text/plain") || ""
  e.preventDefault()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    payload = null
  }
  if (payload?.kind === "streetfinder-board" && Array.isArray(payload.items)) {
    store.pastePayload(payload, pasteOffset(payload))
  } else if (text.trim()) {
    // External text becomes a text object (a URL becomes a link)
    const t = text.trim()
    const html = /^https?:\/\/\S+$/.test(t) ? `<a href="${escapeHtml(t)}">${escapeHtml(t)}</a>` : escapeHtml(t).replace(/\n/g, "<br>")
    const p = canvas.value.lastPointer || canvas.value.worldCenter()
    const it = makeItem("text", { x: p.x, y: p.y, text: html, w: 280, h: 24 * Math.min(20, t.split("\n").length) })
    store.addItem(it)
    store.select([it.id])
  }
  pasteInPlace = false
}

function duplicate() {
  if (!store.selection.length) return
  const payload = store.copyPayload(store.selection)
  store.pastePayload(JSON.parse(JSON.stringify(payload)), { x: 24, y: 24 })
}

// ------------------------------------------------------------ keyboard

const TOOL_KEYS = { v: "select", h: "hand", s: "sticky", t: "text", l: "connector", f: "frame" }
const SHAPE_KEYS = { r: "rect", o: "ellipse", d: "diamond" }

function onKeydown(e) {
  if (e.key === "Escape" && (menu.value || help.value || shareOpen.value)) {
    menu.value = null
    help.value = false
    shareOpen.value = false
    return
  }
  if (isTyping(e)) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  const sel = store.selection

  if (mod) {
    if (k === "z") store[e.shiftKey ? "redo" : "undo"]()
    else if (k === "y") store.redo()
    else if (k === "a") store.select(Object.values(store.items).filter((it) => !it.locked).map((it) => it.id))
    else if (k === "d") duplicate()
    else if (k === "g") store[e.shiftKey ? "ungroup" : "group"](sel)
    else if (k === "l" && e.shiftKey) {
      const locked = !store.selectedItems.every((it) => it.locked)
      store.mutate(() => sel.forEach((id) => store.updateItem(id, { locked })))
    } else if (e.code === "BracketRight") store.zOrder(sel, e.shiftKey ? "front" : "forward")
    else if (e.code === "BracketLeft") store.zOrder(sel, e.shiftKey ? "back" : "backward")
    else if (k === "c" && e.altKey) sel[0] && store.copyStyle(sel[0])
    else if (k === "v" && e.altKey) store.pasteStyle(sel)
    else if (k === "v" && e.shiftKey) {
      pasteInPlace = true
      return // the paste event follows
    } else if (k === "f") openSearch()
    else if (k === "0") canvas.value.zoomAt({ x: canvas.value.size.w / 2, y: canvas.value.size.h / 2 }, 1)
    else if (k === "=" || k === "+") canvas.value.zoomBy(1.25)
    else if (k === "-") canvas.value.zoomBy(1 / 1.25)
    else return
    e.preventDefault()
    return
  }

  // Readers: navigation shortcuts only
  const navigation = e.key === "Escape" || e.key === "?" || (e.shiftKey && /^Digit[12]$/.test(e.code)) || k === "v" || k === "h"
  if (store.readOnly && !navigation) return

  if (e.key === "Delete" || e.key === "Backspace") {
    if (sel.length) store.removeItems(sel)
  } else if (e.key === "Escape") {
    toolbar.value?.closeFlyout()
    if (search.open) closeSearch()
    else if (store.tool !== "select") store.tool = "select"
    else store.select([])
  } else if ((e.key === "Enter" || e.key === "F2") && sel.length === 1) {
    const it = store.items[sel[0]]
    if (it && !it.locked && (hasText(it) || it.type === "frame")) store.editing = { id: it.id, selectAll: true }
  } else if (e.key.startsWith("Arrow") && sel.length) {
    const step = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    store.mutate(() => {
      for (const it of store.selectedItems) {
        if (it.locked) continue
        if (it.type === "connector") {
          const patch = {}
          for (const end of ["from", "to"]) if (it[end] && !it[end].id) patch[end] = { x: it[end].x + d[0], y: it[end].y + d[1] }
          store.updateItem(it.id, patch)
        } else {
          store.updateItem(it.id, { x: it.x + d[0], y: it.y + d[1] })
        }
      }
    })
  } else if (e.key === "?") {
    help.value = true
  } else if (e.shiftKey && e.code === "Digit1") {
    fitAll()
  } else if (e.shiftKey && e.code === "Digit2") {
    fitSelection()
  } else if (TOOL_KEYS[k] && !e.altKey) {
    store.tool = TOOL_KEYS[k]
  } else if (SHAPE_KEYS[k] && !e.altKey) {
    store.shapeKind = SHAPE_KEYS[k]
    store.tool = "shape"
  } else if (k === "i" && !e.altKey) {
    pickImage()
  } else {
    return
  }
  e.preventDefault()
}

function textCommand(name, value) {
  canvas.value?.textEditor?.command(name, value)
}

function onBeforeUnload(e) {
  if (store.hasUnsaved()) {
    e.preventDefault()
    e.returnValue = ""
  }
}

function onGlobalPointerDown(e) {
  if (!e.target.closest?.(".menu")) menu.value = null
}

// ------------------------------------------------------------ lifecycle

onMounted(() => {
  // Collaborators see the name of the account
  store.setIdentity({ name: auth.pseudo || store.me.name })
  load()
  window.addEventListener("keydown", onKeydown)
  window.addEventListener("beforeunload", onBeforeUnload)
  window.addEventListener("pointerdown", onGlobalPointerDown, true)
  document.addEventListener("copy", onCopy)
  document.addEventListener("cut", onCopy)
  document.addEventListener("paste", onPaste)
  timers = [
    // Presence heartbeat, and cleanup of collaborators that vanished without a "leave"
    setInterval(() => store.sendPresence(), 10000),
    setInterval(() => {
      for (const [id, p] of Object.entries(store.peers)) if (Date.now() - p.seen > 30000) delete store.peers[id]
    }, 5000),
  ]
})

watch(boardId, (id) => id && load())

onBeforeRouteLeave(() => store.close())

onBeforeUnmount(() => {
  store.close()
  window.removeEventListener("keydown", onKeydown)
  window.removeEventListener("beforeunload", onBeforeUnload)
  window.removeEventListener("pointerdown", onGlobalPointerDown, true)
  document.removeEventListener("copy", onCopy)
  document.removeEventListener("cut", onCopy)
  document.removeEventListener("paste", onPaste)
  timers.forEach(clearInterval)
  document.title = "Delay Lama"
})
</script>

<style scoped lang="scss">
.board-page {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fbfcfe;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 12px;
  background: white;
  border-bottom: 1px solid #e5e9f0;
  z-index: 20;
}

.title {
  min-width: 80px;
  max-width: 320px;
  flex: 0 1 320px;
  font: inherit;
  font-weight: 700;
  font-size: 1.02em;
  color: oklch(0.27 0.02 265);
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 5px 8px;
  background: none;

  &:hover {
    border-color: #e5e9f0;
  }

  &:focus {
    outline: none;
    border-color: #5366ce;
  }
}

.badge {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75em;
  font-weight: 700;
  white-space: nowrap;
  background: #E3F5EB;
  color: #27905C;

  &.view {
    background: #ecf1ff;
    color: #4554b2;
  }
}

.guest {
  font-size: 0.8em;
  color: var(--muted);
  white-space: nowrap;

  a {
    color: var(--accent);
  }
}

.status {
  font-size: 0.78em;
  color: #8a909b;
  white-space: nowrap;

  &.offline {
    color: #cc8013;
  }
}

.spacer {
  flex: 1;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: #424853;
  cursor: pointer;

  &:hover {
    background: #f1f3f6;
    text-decoration: none;
  }

  &.active {
    background: #ecf1ff;
    color: #4554b2;
  }
}

.peers {
  display: flex;
  align-items: center;
  margin-right: 4px;
}

.avatar {
  width: 30px;
  height: 30px;
  margin-left: -6px;
  border-radius: 50%;
  border: 2px solid white;
  color: white;
  font: inherit;
  font-size: 0.72em;
  font-weight: 700;
  cursor: pointer;

  &.following {
    box-shadow: 0 0 0 2px #5366ce;
  }

  &.me {
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    margin-left: 4px;
    cursor: default;
  }
}

.share {
  padding: 0.5rem 0.9rem;
}

.menu {
  position: relative;
}

.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 230px;
  padding: 8px;
  background: white;
  border: 1px solid #e5e9f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(27, 36, 51, 0.14);
  font-size: 0.88em;

  p {
    margin: 6px 6px 2px;
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
    color: #8a909b;
  }

  > button:not(.btn) {
    text-align: left;
    border: 0;
    background: none;
    padding: 6px 8px;
    border-radius: 6px;
    font: inherit;
    cursor: pointer;

    &:hover {
      background: #f1f3f6;
    }

    &.active {
      background: #ecf1ff;
      color: #4554b2;
      font-weight: 600;
    }
  }

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;

    &.disabled {
      opacity: 0.45;
    }

    select {
      margin-left: auto;
      font: inherit;
    }
  }

  .row {
    display: flex;
    gap: 6px;
    padding: 6px 4px 2px;

    .btn {
      flex: 1;
      padding: 0.5rem;
    }
  }

  .link {
    color: #4554b2;
    font-weight: 600;
  }
}

.body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.workspace {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.search {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: white;
  border: 1px solid #e5e9f0;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(27, 36, 51, 0.12);
  color: #5c626c;

  input {
    width: min(260px, 50vw);
    border: 0;
    outline: none;
    font: inherit;
  }

  .count {
    font-size: 0.8em;
    color: #8a909b;
  }

  button {
    border: 0;
    background: none;
    cursor: pointer;
    color: #5c626c;
  }
}

.zoombar {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 8;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: white;
  border: 1px solid #e5e9f0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(27, 36, 51, 0.08);

  button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: #424853;
    cursor: pointer;

    &:hover {
      background: #f1f3f6;
    }

    &.active {
      color: #4554b2;
    }
  }

  input {
    width: 52px;
    text-align: center;
    border: 0;
    font: inherit;
    font-size: 0.85em;
    font-weight: 600;
    color: #424853;
  }
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 40;
  max-width: calc(100% - 32px);
  padding: 10px 16px;
  border-radius: 10px;
  background: #2e333d;
  color: white;
  font-size: 0.88em;
}

.not-found {
  max-width: 600px;
  margin: 15vh auto;
  padding: 0 16px;
  text-align: center;

  .btn:hover {
    color: #fff;
    text-decoration: none;
  }
}

@media (max-width: 640px) {
  .status,
  .peers .avatar:not(.me) {
    display: none;
  }

  .share {
    padding: 0.5rem;
    font-size: 0;

    svg {
      width: 18px;
      height: 18px;
    }
  }

  .zoombar {
    bottom: 72px;
  }
}
</style>

<style lang="scss">
// Board texts (canvas and editing overlay) take the color chosen for their object:
// the site-wide colors of b / strong / a must not override it.
.board-page .workspace {
  b,
  strong,
  a {
    color: inherit;
  }
}
</style>
