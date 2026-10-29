<template>
  <!-- DOM overlay positioned over the canvas while a text is being edited -->
  <div v-if="item" class="text-editor" :style="wrapperStyle" @pointerdown.stop @dblclick.stop @wheel.stop>
    <input v-if="mode !== 'rich'" ref="input" v-model="plain" class="plain" :style="plainStyle"
      @keydown.stop="onPlainKey" @blur="finish()" />
    <div v-else :style="[textBoxStyle(box), cell ? { background: surface } : null]" :class="{ sticky: item.type === 'sticky', cell: !!cell }">
      <div ref="editor" contenteditable="true" :style="textContentStyle(box)" @input="onInput" @keydown.stop="onKey" @mousedown="onEditorMouseDown"
        @paste="onPaste" @copy="onCopy" @cut="onCopy" @blur="finish()"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { FONTS } from "../lib/defaults"
import { pointAt } from "../lib/geometry"
import { plainText, sanitize, textWithIcons } from "../lib/sanitize"
import { neededHeight, textBoxStyle, textContentStyle } from "../lib/text"
import { iconsFor } from "../lib/inputs"
import { surfaceOf } from "../lib/theme"
import { useBoardStore } from "../store"
import { cellBox, growCell, insertRow, isCovered, setCellText } from "../lib/table"

const store = useBoardStore()
const editor = ref(null)
const input = ref(null)
const plain = ref("")

const item = computed(() => (store.editing ? store.items[store.editing.id] : null))
// Table cell being edited ([row, col]); the cell is then laid out like a small text object
const cell = computed(() => (item.value?.type === "table" ? store.editing.cell || null : null))
const box = computed(() => (cell.value ? cellBox(item.value, ...cell.value) : item.value))
const editKey = (e) => e && `${e.id}:${e.label ?? ""}:${e.cell ? e.cell.join("-") : ""}`
// rich: shapes / stickies / texts, title: frame title, label: connector label
const mode = computed(() => {
  if (!item.value) return null
  if (item.value.type === "frame") return "title"
  if (item.value.type === "connector") return "label"
  return "rich"
})

const anchor = computed(() => {
  const it = item.value
  if (mode.value === "rich") return { x: box.value.x, y: box.value.y }
  if (mode.value === "title") return { x: it.x, y: it.y - 30 }
  const label = it.labels?.[store.editing.label]
  const p = pointAt(store.routeOf(it).samples, label?.t ?? 0.5)
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
  () => editKey(store.editing),
  async (key, old) => {
    if (old) finish(old)
    if (!key) return
    started = key
    store.begin() // the whole edit is a single undo step
    await nextTick()
    if (mode.value === "rich") {
      editor.value.innerHTML = iconsFor(sanitize(cell.value ? item.value.cells[cell.value[0]][cell.value[1]].text : item.value.text), surface.value)
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
  if (cell.value) store.updateItem(item.value.id, setCellText(item.value, ...cell.value, editor.value.innerHTML))
  else store.updateItem(item.value.id, { text: editor.value.innerHTML })
  autoSize()
}

// Shapes grow to contain their text; free texts take exactly the height of their content
function autoSize() {
  const it = item.value
  if (!it || !editor.value || it.type === "sticky") return
  // A cell makes its row taller when its text needs it
  if (cell.value) {
    const patch = growCell(it, ...cell.value, neededHeight(box.value, editor.value.offsetHeight))
    if (patch) store.updateItem(it.id, patch)
    return
  }
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
  // External rich content is reduced to plain text; input icons (copied from a board) are kept
  e.preventDefault()
  const html = e.clipboardData.getData("text/html")
  if (html && /data-input=/.test(html)) {
    insertAtCaret(iconsFor(textWithIcons(html), surface.value))
    onInput({})
  } else {
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))
  }
}

// Copy / cut: clean icons in the HTML (without the notation block) and a readable plain text ("↓↘→HP")
function onCopy(e) {
  const sel = window.getSelection()
  if (!sel.rangeCount || sel.isCollapsed) return
  const box = document.createElement("div")
  box.appendChild(sel.getRangeAt(0).cloneContents())
  if (!box.querySelector("[data-input], [data-input-chip]")) return
  e.preventDefault()
  const html = sanitize(box.innerHTML)
  e.clipboardData.setData("text/html", html)
  e.clipboardData.setData("text/plain", plainText(html))
  if (e.type === "cut") {
    sel.getRangeAt(0).deleteContents()
    onInput({})
  }
}

// Tab / Shift+Tab: next / previous cell; Tab on the last cell adds a row, like a spreadsheet
function moveCell(back) {
  const it = item.value
  const [r, c] = cell.value
  const cols = it.colFr.length, rows = it.rowFr.length
  let index = r * cols + c + (back ? -1 : 1)
  // Cells hidden by a merged area are skipped
  while (index >= 0 && index < rows * cols && isCovered(it, Math.floor(index / cols), index % cols)) index += back ? -1 : 1
  if (index < 0) return
  if (index >= rows * cols) {
    store.updateItem(it.id, insertRow(it, rows))
    index = rows * cols
  }
  store.editing = { id: it.id, cell: [Math.floor(index / cols), index % cols] }
}

// Input icon (with its notation) right before / after the caret, if any. The browser does not
// delete these non-editable blocks reliably, so Backspace / Delete remove them here.
// Nothing visible may separate the icon from the caret (text, line break, start of a line);
// formatting tags (<b>, <i>...) and empty text nodes in between do not count.
function chipNextToCaret(back) {
  const sel = window.getSelection()
  if (!sel.rangeCount || !sel.isCollapsed) return null
  const caret = sel.getRangeAt(0)
  if (!editor.value.contains(caret.startContainer)) return null
  // Caret stuck inside the icon (after a click on it)
  const inside = caret.startContainer.parentElement?.closest("[data-input-chip]")
  if (inside && editor.value.contains(inside)) return inside

  // Nearest icon on the right side of the caret (comparePoint: -1 before the caret, 1 after)
  const index = (node) => [...node.parentNode.childNodes].indexOf(node)
  const chips = [...editor.value.querySelectorAll("[data-input-chip]")]
  const chip = back
    ? chips.reverse().find((c) => caret.comparePoint(c.parentNode, index(c) + 1) <= 0)
    : chips.find((c) => caret.comparePoint(c.parentNode, index(c)) >= 0)
  if (!chip) return null
  const between = document.createRange()
  if (back) {
    between.setStartAfter(chip)
    between.setEnd(caret.startContainer, caret.startOffset)
  } else {
    between.setStart(caret.startContainer, caret.startOffset)
    between.setEndBefore(chip)
  }
  const gap = between.cloneContents()
  const visible = gap.textContent.replace(/\u200b/g, "") !== "" || gap.querySelector("br, div, p, li, ul, ol, img")
  return visible ? null : chip
}

function removeChip(chip) {
  // The caret takes the place of the icon
  const sel = window.getSelection()
  const range = document.createRange()
  range.setStartBefore(chip)
  range.collapse(true)
  chip.remove()
  sel.removeAllRanges()
  sel.addRange(range)
}

function onKey(e) {
  if ((e.key === "Backspace" || e.key === "Delete") && !e.ctrlKey && !e.metaKey) {
    const chip = chipNextToCaret(e.key === "Backspace")
    if (chip) {
      e.preventDefault()
      removeChip(chip)
      onInput({})
      return
    }
  }
  if (e.key === "Tab" && cell.value) {
    e.preventDefault()
    moveCell(e.shiftKey)
    return
  }
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
  const [id, labelIndex, cellKey] = key.split(":")
  const it = store.items[id]
  if (it) {
    if (it.type === "table" && cellKey) {
      const [r, c] = cellKey.split("-").map(Number)
      const current = it.cells[r]?.[c]
      if (current) store.updateItem(id, setCellText(it, r, c, sanitize(current.text)))
    } else if (it.type === "frame") {
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
  if (store.editing && editKey(store.editing) === key) store.editing = null
}

// Click on an input icon: the caret goes right before or after it (the side clicked),
// instead of wherever the browser puts it next to a non-editable block
function onEditorMouseDown(e) {
  const chip = e.target.closest?.("[data-input-chip]")
  if (!chip || !editor.value.contains(chip) || e.shiftKey) return
  e.preventDefault()
  editor.value.focus()
  const b = chip.getBoundingClientRect()
  const range = document.createRange()
  if (e.clientX < b.left + b.width / 2) range.setStartBefore(chip)
  else range.setStartAfter(chip)
  range.collapse(true)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

// The caret never stays inside an input icon (a click on it, arrow keys): it goes right after it,
// where typing and Backspace behave normally
function onSelectionChange() {
  const sel = window.getSelection()
  if (!editor.value || !sel.rangeCount || !sel.isCollapsed) return
  const chip = sel.anchorNode?.parentElement?.closest("[data-input-chip]") || (sel.anchorNode?.nodeType === Node.ELEMENT_NODE && sel.anchorNode.closest("[data-input-chip]"))
  if (!chip || !editor.value.contains(chip)) return
  const range = document.createRange()
  range.setStartAfter(chip)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}
document.addEventListener("selectionchange", onSelectionChange)

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", onSelectionChange)
  finish()
})

// Color under the edited text (icons variant, background of an edited cell)
const surface = computed(() => box.value && surfaceOf(box.value.source || box.value, box.value.type === "text" ? null : box.value.style?.fill))

// Inserts HTML and puts the caret after it (execCommand leaves it before a non-editable icon,
// so the next icon would be inserted in front of the previous one)
function insertAtCaret(html) {
  const sel = window.getSelection()
  let range = sel.rangeCount ? sel.getRangeAt(0) : null
  if (!range || !editor.value.contains(range.commonAncestorContainer)) {
    range = document.createRange()
    range.selectNodeContents(editor.value)
    range.collapse(false)
  }
  range.deleteContents()
  const frag = range.createContextualFragment(html)
  const last = frag.lastChild
  if (!last) return
  range.insertNode(frag)
  range.setStartAfter(last)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Rich text command from the properties bar (focus stays in the editor). */
function command(name, value) {
  if (!editor.value) return
  editor.value.focus()
  if (name === "code") {
    const text = window.getSelection().toString()
    if (text) document.execCommand("insertHTML", false, `<code>${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</code>`)
  } else if (name === "insertHTML") {
    insertAtCaret(iconsFor(value, surface.value))
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
  caret-color: var(--accent-hover);
}

.cell {
  box-shadow: 0 0 0 2px var(--accent);
}

.plain {
  border: 1.5px solid var(--accent);
  border-radius: 6px;
  padding: 3px 6px;
  outline: none;
  background: var(--surface);
  color: var(--text);
  box-sizing: border-box;
}
</style>
