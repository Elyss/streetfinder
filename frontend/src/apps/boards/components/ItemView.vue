<template>
  <g :transform="`translate(${item.x} ${item.y})`" :data-id="item.id" :opacity="style.opacity ?? 1">
    <!-- Frame: the body lets clicks through to the canvas (marquee), the title and border select it -->
    <template v-if="item.type === 'frame'">
      <rect :width="item.w" :height="item.h" rx="8" :fill="frameFill(style.fill)" data-frame-body />
      <rect :width="item.w" :height="item.h" rx="8" fill="none" :stroke="style.stroke || '#c5cad3'" stroke-width="1.5" style="pointer-events: stroke" />
      <text x="2" y="-10" font-size="15" font-weight="600" :fill="inkOf(style.textColor || '#5c626c', null)" :font-family="FONTS.sans" data-frame-title>
        {{ editingTitle ? "" : item.text || "Cadre" }}
      </text>
    </template>

    <template v-else-if="item.type === 'shape'">
      <path :d="outline.d" :fill="style.fill" :stroke="inkOf(style.stroke, item)" :stroke-width="style.strokeWidth"
        :stroke-dasharray="dashArray(style.strokeStyle, style.strokeWidth)" stroke-linejoin="round"
        stroke-linecap="round" :filter="style.shadow ? 'url(#sf-shadow)' : null" />
      <path v-if="outline.decor" :d="outline.decor" fill="none" :stroke="inkOf(style.stroke, item)" :stroke-width="style.strokeWidth" />
    </template>

    <template v-else-if="item.type === 'sticky'">
      <rect :width="item.w" :height="item.h" rx="3" :fill="style.fill" filter="url(#sf-sticky-shadow)" />
      <text v-if="style.showAuthor && item.author" x="10" :y="item.h - 8" font-size="10" fill="rgba(0,0,0,.45)" :font-family="FONTS.sans">
        {{ item.author }}
      </text>
    </template>

    <template v-else-if="item.type === 'text'">
      <rect :width="item.w" :height="item.h" fill="transparent" />
    </template>

    <template v-else-if="item.type === 'image'">
      <clipPath v-if="style.radius" :id="`clip-${item.id}`">
        <rect :width="item.w" :height="item.h" :rx="style.radius" />
      </clipPath>
      <rect :width="item.w" :height="item.h" fill="#f1f3f6" />
      <image :href="src" :width="item.w" :height="item.h" preserveAspectRatio="xMidYMid slice"
        :clip-path="style.radius ? `url(#clip-${item.id})` : null" />
    </template>

    <!-- Table: cell backgrounds, grid, cell texts; borders draggable once selected -->
    <template v-else-if="item.type === 'table'">
      <rect :width="item.w" :height="item.h" :fill="style.fill || '#fff'" />
      <template v-for="v in cellsShown" :key="'f' + v.r + ':' + v.c">
        <rect v-if="cellFill(item, v.r, v.c)" :x="v.x" :y="v.y" :width="v.w" :height="v.h" :fill="cellFill(item, v.r, v.c)" />
      </template>
      <path :d="gridPath" fill="none" :stroke="style.stroke || '#c5cad3'" stroke-width="1" />
      <rect :width="item.w" :height="item.h" fill="none" :stroke="style.stroke || '#c5cad3'" stroke-width="1.5" />
      <template v-for="v in cellsShown" :key="'t' + v.r + ':' + v.c">
        <foreignObject v-if="v.cell.text && !(editingCell && editingCell[0] === v.r && editingCell[1] === v.c)"
          :x="v.x" :y="v.y" :width="v.w" :height="v.h" style="pointer-events: none">
          <div xmlns="http://www.w3.org/1999/xhtml" :style="textBoxStyle(cellBox(item, v.r, v.c))">
            <div :style="textContentStyle(cellBox(item, v.r, v.c))" v-html="iconsFor(sanitize(v.cell.text), surfaceOf(item, cellBox(item, v.r, v.c).style.fill))"></div>
          </div>
        </foreignObject>
      </template>
      <template v-if="selected && !item.locked">
        <rect v-for="i in item.colFr.length - 1" :key="'bc' + i" :data-table-border="`col:${i - 1}`"
          :x="layout.xs[i] - 4" y="0" width="8" :height="item.h" fill="transparent" style="cursor: col-resize" />
        <rect v-for="i in item.rowFr.length - 1" :key="'br' + i" :data-table-border="`row:${i - 1}`"
          x="0" :y="layout.ys[i] - 4" :width="item.w" height="8" fill="transparent" style="cursor: row-resize" />
      </template>
    </template>

    <!-- Link to another board: clickable chip under the object -->
    <g v-if="item.boardLink" :transform="`translate(0 ${item.h + 8})`" :data-board-link="item.boardLink.id" style="cursor: pointer">
      <title>Ouvrir le board « {{ item.boardLink.title }} »</title>
      <rect :width="linkWidth" height="24" rx="12" fill="#ecf1ff" stroke="#5366ce" stroke-width="1.2" />
      <path d="M11 8h-3v9h9v-3M13 7h5v5M18 7l-7 7" fill="none" stroke="#4554b2" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      <text x="26" y="16.5" font-size="12" font-weight="600" fill="#4554b2" :font-family="FONTS.sans">{{ linkLabel }}</text>
    </g>

    <foreignObject v-if="showText" :width="item.w" :height="item.h" style="pointer-events: none; overflow: visible">
      <div xmlns="http://www.w3.org/1999/xhtml" :style="textBoxStyle(item)">
        <div ref="content" :style="textContentStyle(item, fontScale)" v-html="html"></div>
      </div>
    </foreignObject>
  </g>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from "vue"
import { FONTS, dashArray, hasText } from "../lib/defaults"
import { shapePath } from "../lib/geometry"
import { cellBox, cellFill, gridPath as tableGrid, tableLayout, visibleCells } from "../lib/table"
import { sanitize } from "../lib/sanitize"
import { textBoxStyle, textContentStyle } from "../lib/text"
import { mediaUrl } from "../lib/api"
import { frameFill, inkOf, surfaceOf } from "../lib/theme"
import { iconsFor } from "../lib/inputs"

const props = defineProps({
  item: { type: Object, required: true },
  editing: { type: Boolean, default: false },
  // Tables: cell being edited ([row, col]) and selection (shows the draggable borders)
  editingCell: { type: Array, default: null },
  selected: { type: Boolean, default: false },
})

const content = ref(null)
const fontScale = ref(1)

const style = computed(() => props.item.style || {})
const outline = computed(() => shapePath(props.item.shape, props.item.w, props.item.h))
// Input icons in the variant matching the text color
const html = computed(() => iconsFor(sanitize(props.item.text), surfaceOf(props.item, props.item.type === "text" ? null : style.value.fill)))
const src = computed(() => mediaUrl(props.item.src))
const showText = computed(() => hasText(props.item) && !props.editing && props.item.text)
const linkLabel = computed(() => {
  const t = props.item.boardLink?.title || "Board"
  return t.length > 34 ? `${t.slice(0, 33)}…` : t
})
const linkWidth = computed(() => Math.round(linkLabel.value.length * 6.8 + 38))
const layout = computed(() => (props.item.type === "table" ? tableLayout(props.item) : null))
const gridPath = computed(() => (props.item.type === "table" ? tableGrid(props.item) : ""))
// Cells drawn (merged areas as one cell)
const cellsShown = computed(() => (props.item.type === "table" ? visibleCells(props.item) : []))
const editingTitle = computed(() => props.item.type === "frame" && props.editing)

// Sticky notes: the text shrinks to fit instead of overflowing
async function fit() {
  if (props.item.type !== "sticky") return
  fontScale.value = 1
  await nextTick()
  for (let i = 0; i < 6 && content.value; i++) {
    const avail = props.item.h - 28
    const needed = content.value.scrollHeight
    if (needed <= avail || fontScale.value < 0.3) break
    fontScale.value *= Math.max(0.5, Math.sqrt(avail / needed)) * 0.97
    await nextTick()
  }
}

onMounted(fit)
watch(() => [props.item.text, props.item.w, props.item.h, style.value.fontSize, props.editing], fit)
</script>
