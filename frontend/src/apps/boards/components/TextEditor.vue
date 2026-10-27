<template>
  <!-- DOM overlay positioned over the canvas while a text is being edited -->
  <div v-if="item" class="text-editor" :style="wrapperStyle" @pointerdown.stop @dblclick.stop @wheel.stop>
    <input v-if="mode !== 'rich'" ref="input" v-model="plain" class="plain" :style="plainStyle"
      @keydown.stop="onPlainKey" @blur="finish()" />
    <div v-else :style="textBoxStyle(item)" :class="{ sticky: item.type === 'sticky' }">
      <div ref="editor" contenteditable="true" :style="textContentStyle(item)" @input="onInput" @keydown.stop="onKey"
        @paste="onPaste" @blur="finish()"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { FONTS } from "../lib/defaults"
import { connectorGeometry, pointAt } from "../lib/geometry"
import { plainText, sanitize } from "../lib/sanitize"
import { neededHeight, textBoxStyle, textContentStyle } from "../lib/text"
import { useBoardStore } from "../store"

const store = useBoardStore()
const editor = ref(null)
const input = ref(null)
const plain = ref("")

const item = computed(() => (store.editing ? store.items[store.editing.id] : null))
// rich: shapes / stickies / texts, title: frame title, label: connector label
const mode = computed(() => {
  if (!item.value) return null
  if (item.value.type === "frame") return "title"
  if (item.value.type === "connector") return "label"
  return "rich"
})

const anchor = computed(() => {
  const it = item.value
  if (mode.value === "rich") return { x: it.x, y: it.y }
  if (mode.value === "title") return { x: it.x, y: it.y - 30 }
  const label = it.labels?.[store.editing.label]
  const p = pointAt(connectorGeometry(it, store.items).samples, label?.t ?? 0.5)
  return { x: p.x - 80, y: p.y - 14 }
})

const wrapperStyle = computed(() => ({
  transform: `translate(${anchor.value.x * store.view.zoom + store.view.ox}px, ${anchor.value.y * store.view.zoom + store.view.oy}px) scale(${store.view.zoom})`,
}))

const plainStyle = computed(() => ({
  fontFamily: FONTS.sans,
  fontSize: mode.value === "title" ? "15px" : "14px",
  fontWeight: mode.value === "title" ? 600 : 400,
  width: mode.value === "title" ? `${Math.max(120, item.value.w)}px` : "160px",
  textAlign: mode.value === "label" ? "center" : "left",
}))

let started = null

watch(
  () => store.editing && `${store.editing.id}:${store.editing.label ?? ""}`,
  async (key, old) => {
    if (old) finish(old)
    if (!key) return
    started = key
    store.begin() // the whole edit is a single undo step
    await nextTick()
    if (mode.value === "rich") {
      editor.value.innerHTML = sanitize(item.value.text)
      editor.value.focus()
      const range = document.createRange()
      range.selectNodeContents(editor.value)
      if (!store.editing.selectAll) range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      document.execCommand("styleWithCSS", false, false)
      autoSize()
    } else {
      plain.value = mode.value === "title" ? item.value.text : item.value.labels?.[store.editing.label]?.text || ""
      input.value.focus()
      input.value.select()
    }
  },
  { immediate: true },
)

function onInput(e) {
  markdownShortcuts(e)
  store.updateItem(item.value.id, { text: editor.value.innerHTML })
  autoSize()
}

// Shapes grow to contain their text; free texts take exactly the height of their content
function autoSize() {
  const it = item.value
  if (!it || !editor.value || it.type === "sticky") return
  for (let i = 0; i < 3; i++) {
    const h = neededHeight(item.value, editor.value.offsetHeight)
    if (it.type === "text" ? h !== it.h : h > it.h) store.updateItem(it.id, { h: Math.max(h, 24) })
    else break
  }
}

// Light Markdown: "- " / "* " start a bullet list, "1. " a numbered one, **text** turns bold
function markdownShortcuts(e) {
  if (e.inputType !== "insertText") return
  const sel = window.getSelection()
  const node = sel.anchorNode
  if (!node || node.nodeType !== Node.TEXT_NODE) return
  const before = node.textContent.slice(0, sel.anchorOffset)
  const inList = node.parentElement?.closest("li")

  if (e.data === " " && !inList && /^(\s*)([-*]|1\.)\s$/.test(before)) {
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, sel.anchorOffset)
    range.deleteContents()
    document.execCommand(before.trim() === "1." ? "insertOrderedList" : "insertUnorderedList")
  } else if (e.data === "*") {
    const m = before.match(/\*\*([^*]+)\*\*$/)
    if (!m) return
    const range = document.createRange()
    range.setStart(node, sel.anchorOffset - m[0].length)
    range.setEnd(node, sel.anchorOffset)
    sel.removeAllRanges()
    sel.addRange(range)
    document.execCommand("insertHTML", false, `<b>${m[1].replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</b>&#8203;`)
  }
}

function onPaste(e) {
  // External rich content is reduced to plain text
  e.preventDefault()
  document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))
}

function onKey(e) {
  if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
    e.preventDefault()
    editor.value.blur()
  }
}

function onPlainKey(e) {
  if (e.key === "Escape" || e.key === "Enter") {
    e.preventDefault()
    input.value.blur()
  }
}

function finish(key = started) {
  if (!key || key !== started) return
  started = null
  const [id, labelIndex] = key.split(":")
  const it = store.items[id]
  if (it) {
    if (it.type === "frame") {
      store.updateItem(id, { text: plain.value.trim() || "Cadre" })
    } else if (it.type === "connector") {
      const labels = (it.labels || []).map((l) => ({ ...l }))
      const i = Number(labelIndex)
      if (plain.value.trim()) labels[i] = { ...labels[i], text: plain.value.trim() }
      else labels.splice(i, 1)
      store.updateItem(id, { labels })
    } else if (it.type === "text" && !plainText(it.text).trim()) {
      store.removeItems([id])
    } else {
      store.updateItem(id, { text: sanitize(it.text) })
    }
  }
  store.commit()
  if (store.editing && `${store.editing.id}:${store.editing.label ?? ""}` === key) store.editing = null
}

onBeforeUnmount(() => finish())

/** Rich text command from the properties bar (focus stays in the editor). */
function command(name, value) {
  if (!editor.value) return
  editor.value.focus()
  if (name === "code") {
    const text = window.getSelection().toString()
    if (text) document.execCommand("insertHTML", false, `<code>${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</code>`)
  } else {
    document.execCommand(name, false, value)
  }
  onInput({})
}

defineExpose({ command })
</script>

<style scoped>
.text-editor {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  z-index: 5;
}

[contenteditable] {
  cursor: text;
  caret-color: #4554b2;
}

.plain {
  border: 1.5px solid #5366ce;
  border-radius: 6px;
  padding: 3px 6px;
  outline: none;
  background: white;
  color: #2e333d;
  box-sizing: border-box;
}
</style>
