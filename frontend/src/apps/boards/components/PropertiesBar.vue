<template>
  <!-- Contextual bar floating above the selection: only the options relevant to the selected objects -->
  <div v-if="visible" ref="bar" class="props-bar" :style="position" @pointerdown.stop @mousedown="editingRich && $event.preventDefault()">
    <!-- Rich text while editing -->
    <template v-if="editingRich">
      <button v-for="c in TEXT_COMMANDS" :key="c.cmd" type="button" :title="c.label" @click="emit('command', c.cmd)">
        <Icon :name="c.icon" />
      </button>
      <button type="button" title="Lien" @click="addLink"><Icon name="link" /></button>
      <div class="menu">
        <button type="button" title="Notation SF6 (icônes, manette)" :class="{ active: open === 'inputs' }" @click="toggle('inputs')">
          <Icon name="gamepad" />
        </button>
        <!-- Always above the bar, away from the edited text; scrolls when the room above is short -->
        <div v-if="open === 'inputs'" class="popover up palette" :style="{ maxHeight: `${paletteRoom}px` }">
          <InputPalette @insert="(html) => emit('command', 'insertHTML', html)" />
        </div>
      </div>
      <span class="sep"></span>
    </template>

    <template v-if="!editing || editingRich">
      <!-- Shape type -->
      <div v-if="allShapes" class="menu">
        <button type="button" class="wide" title="Type de forme" @click="toggle('shape')">
          {{ SHAPE_LABELS[first.shape] || "Forme" }} ▾
        </button>
        <div v-if="open === 'shape'" class="popover list shapes">
          <button v-for="s in shapeChoices" :key="s.key" type="button" :class="{ active: first.shape === s.key }"
            @click="store.changeShape(ids, s.key); open = null">
            <!-- Thumbnail in the colors of the selected shape -->
            <svg class="thumb" viewBox="-2 -2 34 24" width="34" height="24" aria-hidden="true">
              <path :d="shapePath(s.key, 30, 20).d" :fill="thumbFill" :stroke="thumbStroke" stroke-width="1.5" stroke-linejoin="round" />
              <path v-if="shapePath(s.key, 30, 20).decor" :d="shapePath(s.key, 30, 20).decor" fill="none" :stroke="thumbStroke" stroke-width="1.5" />
            </svg>
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Fill -->
      <div v-if="has('shape', 'sticky', 'frame') && !has('connector', 'image', 'text')" class="menu">
        <button type="button" title="Couleur de fond" @click="toggle('fill')">
          <span class="chip" :class="{ none: first.style?.fill === 'transparent' }" :style="{ background: first.style?.fill }"></span>
        </button>
        <div v-if="open === 'fill'" class="popover">
          <ColorPicker :value="first.style?.fill" :sticky="onlyType === 'sticky'" @pick="(c) => setStyle({ fill: c }, 'shape', 'sticky', 'frame')" />
        </div>
      </div>

      <!-- Border / line -->
      <div v-if="has('shape', 'connector', 'frame') && !has('sticky', 'text', 'image')" class="menu">
        <button type="button" :title="onlyType === 'connector' ? 'Trait' : 'Bordure'" @click="toggle('stroke')">
          <span class="chip ring" :style="{ borderColor: first.style?.stroke }"></span>
        </button>
        <div v-if="open === 'stroke'" class="popover">
          <ColorPicker :value="first.style?.stroke" :tones="['mid', 'dark']" @pick="(c) => setStyle({ stroke: c }, 'shape', 'connector', 'frame')" />
          <div v-if="!has('frame')" class="options">
            <button v-for="w in STROKE_WIDTHS" :key="w" type="button" :class="{ active: first.style?.strokeWidth === w }"
              :title="`Épaisseur ${w}`" @click="setStyle({ strokeWidth: w }, 'shape', 'connector')">
              <svg width="22" height="14"><line x1="2" y1="7" x2="20" y2="7" stroke="currentColor" :stroke-width="w" /></svg>
            </button>
            <span class="sep"></span>
            <button v-for="s in ['solid', 'dashed', 'dotted']" :key="s" type="button" :class="{ active: (first.style?.strokeStyle || 'solid') === s }"
              :title="{ solid: 'Plein', dashed: 'Tirets', dotted: 'Pointillés' }[s]" @click="setStyle({ strokeStyle: s }, 'shape', 'connector')">
              <svg width="22" height="14"><line x1="2" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="2"
                :stroke-dasharray="s === 'dashed' ? '5 3' : s === 'dotted' ? '0 4' : null" stroke-linecap="round" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Connector -->
      <template v-if="onlyType === 'connector'">
        <div class="menu">
          <button type="button" class="wide" title="Type de tracé" @click="toggle('route')">
            {{ { straight: "Droit", elbow: "Coudé", curve: "Courbe" }[first.style?.route || "elbow"] }} ▾
          </button>
          <div v-if="open === 'route'" class="popover list">
            <button v-for="(label, r) in { straight: 'Droit', elbow: 'Coudé', curve: 'Courbe' }" :key="r" type="button"
              :class="{ active: (first.style?.route || 'elbow') === r }" @click="setStyle({ route: r }, 'connector'); open = null">{{ label }}</button>
            <label class="check"><input type="checkbox" :checked="first.style?.rounded !== false"
              @change="setStyle({ rounded: $event.target.checked }, 'connector')" /> Coins arrondis</label>
          </div>
        </div>
        <div v-for="end in ['startCap', 'endCap']" :key="end" class="menu">
          <button type="button" class="wide" :title="end === 'startCap' ? 'Extrémité de départ' : 'Extrémité d\'arrivée'" @click="toggle(end)">
            {{ end === "startCap" ? "Départ" : "Arrivée" }} : {{ CAPS.find((c) => c.key === (first.style?.[end] || "none"))?.label }} ▾
          </button>
          <div v-if="open === end" class="popover list">
            <button v-for="c in CAPS" :key="c.key" type="button" :class="{ active: (first.style?.[end] || 'none') === c.key }"
              @click="setStyle({ [end]: c.key }, 'connector'); open = null">{{ c.label }}</button>
          </div>
        </div>
        <button type="button" title="Inverser le sens" @click="swapDirection"><Icon name="swap" /></button>
      </template>

      <!-- Text -->
      <template v-if="has('shape', 'sticky', 'text', 'table') && !has('connector', 'image', 'frame')">
        <span class="sep"></span>
        <div class="menu">
          <button type="button" class="wide" title="Taille du texte" @click="toggle('size')">{{ FONT_SIZE_LABELS[first.style?.fontSize || "m"] }} ▾</button>
          <div v-if="open === 'size'" class="popover list">
            <button v-for="(label, k) in FONT_SIZE_LABELS" :key="k" type="button" :class="{ active: (first.style?.fontSize || 'm') === k }"
              @click="setStyle({ fontSize: k }, 'shape', 'sticky', 'text', 'table'); open = null">{{ label }}</button>
            <span class="sep-h"></span>
            <button v-for="(label, k) in FONT_LABELS" :key="k" type="button" :class="{ active: (first.style?.font || 'sans') === k }"
              :style="{ fontFamily: FONTS[k] }" @click="setStyle({ font: k }, 'shape', 'sticky', 'text', 'table'); open = null">{{ label }}</button>
          </div>
        </div>
        <div class="menu">
          <button type="button" title="Alignement du texte" @click="toggle('align')">
            <Icon name="align" />
          </button>
          <div v-if="open === 'align'" class="popover options">
            <button v-for="a in ['left', 'center', 'right']" :key="a" type="button" :class="{ active: (first.style?.align || 'center') === a }"
              :title="{ left: 'Gauche', center: 'Centre', right: 'Droite' }[a]" @click="setStyle({ align: a }, 'shape', 'sticky', 'text', 'table')">
              {{ { left: "⟸", center: "≡", right: "⟹" }[a] }}
            </button>
            <span class="sep"></span>
            <button v-for="v in ['top', 'middle', 'bottom']" :key="v" type="button" :class="{ active: (first.style?.valign || 'middle') === v }"
              :title="{ top: 'Haut', middle: 'Milieu', bottom: 'Bas' }[v]" @click="setStyle({ valign: v }, 'shape', 'sticky', 'text', 'table')">
              {{ { top: "⤒", middle: "↕", bottom: "⤓" }[v] }}
            </button>
          </div>
        </div>
        <div class="menu">
          <button type="button" title="Couleur du texte" @click="toggle('textColor')">
            <span class="text-a" :style="{ borderColor: first.style?.textColor }">A</span>
          </button>
          <div v-if="open === 'textColor'" class="popover">
            <ColorPicker :value="first.style?.textColor" :tones="['dark']" @pick="(c) => setStyle({ textColor: c }, 'shape', 'sticky', 'text', 'table', 'connector', 'frame')" />
          </div>
        </div>
      </template>

      <!-- Table -->
      <template v-if="onlyType === 'table' && items.length === 1">
        <div class="menu">
          <button type="button" class="wide" title="Lignes et colonnes" @click="toggle('table')">Tableau ▾</button>
          <div v-if="open === 'table'" class="popover list">
            <template v-if="cellArea">
              <p class="popover-title">{{ cellArea.rs * cellArea.cs > 1 ? `Cellules (${cellArea.rs} × ${cellArea.cs})` : "Cellule" }}</p>
              <button type="button" :disabled="!canMerge" @click="mergeArea">Fusionner les cellules</button>
              <button type="button" :disabled="!mergedInArea.length" @click="splitArea">Séparer les cellules</button>
              <p v-if="!canMerge && !mergedInArea.length" class="popover-hint wrap">Maj + clic (ou Maj + glisser) sur d'autres cellules pour en sélectionner plusieurs.</p>
              <span class="sep-h"></span>
            </template>
            <template v-for="axis in ['col', 'row']" :key="axis">
              <template v-if="tableTarget[axis] !== undefined">
                <p class="popover-title">{{ axis === "col" ? "Colonne" : "Ligne" }} {{ tableTarget[axis] + 1 }}</p>
                <button v-for="op in LINE_OPS[axis]" :key="op.op" type="button" :disabled="!lineOpAllowed(axis, op.op)"
                  @click="tableEdit(op.op, axis)">{{ op.label }}</button>
                <span class="sep-h"></span>
              </template>
            </template>
            <template v-if="tableTarget.col === undefined && tableTarget.row === undefined">
              <button type="button" @click="tableEdit('append', 'row')">Ajouter une ligne à la fin</button>
              <button type="button" @click="tableEdit('append', 'col')">Ajouter une colonne à la fin</button>
              <p class="popover-hint wrap">Clique la poignée d'une colonne (au-dessus) ou d'une ligne (à gauche) pour insérer, déplacer ou supprimer à cet endroit. Les « + » insèrent entre deux.</p>
              <span class="sep-h"></span>
            </template>
            <label class="check"><input type="checkbox" :checked="!!first.style?.header"
              @change="setStyle({ header: $event.target.checked }, 'table')" /> Ligne d'en-tête</label>
          </div>
        </div>
        <div class="menu">
          <button type="button" :title="cellArea ? 'Couleur des cellules' : 'Couleur du tableau'" @click="toggle('tableFill')">
            <span class="chip" :style="{ background: cellArea ? cellColor : first.style?.fill }"></span>
          </button>
          <div v-if="open === 'tableFill'" class="popover">
            <ColorPicker :value="cellArea ? cellColor : first.style?.fill" :tones="['light', 'mid']" @pick="pickTableFill" />
          </div>
        </div>
        <div class="menu">
          <button type="button" title="Couleur des bordures" @click="toggle('tableStroke')">
            <span class="chip ring" :style="{ borderColor: first.style?.stroke }"></span>
          </button>
          <div v-if="open === 'tableStroke'" class="popover">
            <ColorPicker :value="first.style?.stroke" :tones="['mid', 'dark']" @pick="(c) => setStyle({ stroke: c }, 'table')" />
          </div>
        </div>
      </template>

      <!-- Image -->
      <button v-if="onlyType === 'image'" type="button" class="wide" title="Coins arrondis"
        @click="setStyle({ radius: first.style?.radius ? 0 : 16 }, 'image')">
        {{ first.style?.radius ? "Coins droits" : "Coins arrondis" }}
      </button>

      <!-- Multi-selection -->
      <template v-if="nodeIds.length > 1">
        <span class="sep"></span>
        <div class="menu">
          <button type="button" class="wide" title="Aligner et distribuer" @click="toggle('arrange')">Aligner ▾</button>
          <div v-if="open === 'arrange'" class="popover list">
            <button v-for="(label, k) in ALIGNS" :key="k" type="button" @click="store.align(nodeIds, k)">{{ label }}</button>
            <span class="sep-h"></span>
            <button type="button" :disabled="nodeIds.length < 3" @click="store.distribute(nodeIds, 'h')">Distribuer horizontalement</button>
            <button type="button" :disabled="nodeIds.length < 3" @click="store.distribute(nodeIds, 'v')">Distribuer verticalement</button>
            <button type="button" @click="store.matchSize(nodeIds)">Harmoniser les tailles</button>
          </div>
        </div>
        <button v-if="!grouped" type="button" title="Grouper (Ctrl+G)" @click="store.group(ids)"><Icon name="group" /></button>
      </template>
      <button v-if="grouped" type="button" class="wide" title="Dégrouper (Ctrl+Maj+G)" @click="store.ungroup(ids)">Dégrouper</button>

      <!-- Link to another board -->
      <div v-if="linkable" class="menu">
        <button type="button" :class="{ active: !!first.boardLink }" title="Lien vers un board" @click="toggleBoardLinks">
          <Icon name="board" />
        </button>
        <div v-if="open === 'boardLink'" class="popover list board-links">
          <p class="popover-title">Lien vers un board</p>
          <p v-if="boards === null" class="popover-hint">Chargement…</p>
          <p v-else-if="!boards.length" class="popover-hint">Aucun autre board.</p>
          <button v-for="b in boards" :key="b.id" type="button" :class="{ active: first.boardLink?.id === b.id }"
            :title="b.owner_name ? `Board de ${b.owner_name}` : null" @click="setBoardLink(b)">{{ b.title }}</button>
          <template v-if="first.boardLink">
            <span class="sep-h"></span>
            <button type="button" @click="setBoardLink(null)">Retirer le lien</button>
          </template>
        </div>
      </div>

      <!-- Arrange / misc -->
      <span class="sep"></span>
      <div class="menu">
        <button type="button" title="Plus d'options" @click="toggle('more')"><Icon name="more" /></button>
        <div v-if="open === 'more'" class="popover list right">
          <button type="button" @click="store.zOrder(ids, 'front')">Premier plan</button>
          <button type="button" @click="store.zOrder(ids, 'forward')">Avancer</button>
          <button type="button" @click="store.zOrder(ids, 'backward')">Reculer</button>
          <button type="button" @click="store.zOrder(ids, 'back')">Arrière-plan</button>
          <span class="sep-h"></span>
          <label v-if="onlyType === 'shape'" class="check"><input type="checkbox" :checked="!!first.style?.shadow"
            @change="setStyle({ shadow: $event.target.checked }, 'shape')" /> Ombre</label>
          <label v-if="onlyType === 'sticky'" class="check"><input type="checkbox" :checked="!!first.style?.showAuthor"
            @change="setStyle({ showAuthor: $event.target.checked }, 'sticky')" /> Afficher l'auteur</label>
          <label v-if="has('shape', 'image')" class="check range">Opacité
            <input type="range" min="0.1" max="1" step="0.05" :value="first.style?.opacity ?? 1"
              @input="setStyle({ opacity: Number($event.target.value) }, 'shape', 'image')" /></label>
          <button type="button" @click="store.copyStyle(first.id)">Copier le style</button>
          <button type="button" @click="store.pasteStyle(ids)">Coller le style</button>
        </div>
      </div>
      <button type="button" :title="allLocked ? 'Déverrouiller' : 'Verrouiller'" @click="toggleLock">
        <Icon :name="allLocked ? 'lock' : 'unlock'" />
      </button>
      <button type="button" title="Supprimer (Suppr)" @click="store.removeItems(ids)"><Icon name="trash" /></button>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue"
import Icon from "@/components/Icon.vue"
import ColorPicker from "./ColorPicker.vue"
import {
  CAPS, FLOWCHART_SHAPES, FONT_LABELS, FONT_SIZE_LABELS, FONTS, SHAPE_LABELS, SHAPES, STROKE_WIDTHS,
} from "../lib/defaults"
import { useBoardStore } from "../store"
import { boardsApi } from "../lib/api"
import InputPalette from "./InputPalette.vue"
import { cellFill, cellRange, cellRect, insertCol, insertRow, mergeCells, moveLine, removeCol, removeRow } from "../lib/table"
import { shapePath } from "../lib/geometry"

const props = defineProps({
  canvasSize: { type: Object, required: true },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(["command"])

const store = useBoardStore()
const bar = ref(null)
const open = ref(null)
const barWidth = ref(300)

const TEXT_COMMANDS = [
  { cmd: "bold", icon: "bold", label: "Gras (Ctrl+B)" },
  { cmd: "italic", icon: "italic", label: "Italique (Ctrl+I)" },
  { cmd: "underline", icon: "underline", label: "Souligné (Ctrl+U)" },
  { cmd: "strikeThrough", icon: "strike", label: "Barré" },
  { cmd: "code", icon: "code", label: "Code" },
  { cmd: "insertUnorderedList", icon: "list", label: "Liste à puces" },
  { cmd: "insertOrderedList", icon: "olist", label: "Liste numérotée" },
]
const ALIGNS = { left: "Aligner à gauche", center: "Centrer horizontalement", right: "Aligner à droite", top: "Aligner en haut", middle: "Centrer verticalement", bottom: "Aligner en bas" }

const items = computed(() => store.selectedItems)
const ids = computed(() => items.value.map((it) => it.id))
const nodeIds = computed(() => items.value.filter((it) => it.type !== "connector").map((it) => it.id))
const first = computed(() => items.value[0] || {})
const types = computed(() => new Set(items.value.map((it) => it.type)))
const onlyType = computed(() => (types.value.size === 1 ? [...types.value][0] : null))
const has = (...t) => t.some((x) => types.value.has(x))
const allShapes = computed(() => onlyType.value === "shape")
const allLocked = computed(() => items.value.length > 0 && items.value.every((it) => it.locked))
const grouped = computed(() => items.value.length > 1 && items.value.every((it) => it.group && it.group === items.value[0].group))
const editing = computed(() => store.editing)

// Table: cell being edited, target of the row / column operations and of the cell color
const currentCell = computed(() => (editing.value?.cell && editing.value.id === first.value.id ? editing.value.cell : null))
// Cells targeted by merge / split / color: the range picked with Maj + clic, or the cell being edited
const cellArea = computed(() => {
  const t = store.tableSel
  const it = first.value
  if (t?.axis === "cells" && t.id === it.id) {
    const a = cellRange(it, t.from, t.to)
    return a.r + a.rs <= it.rowFr.length && a.c + a.cs <= it.colFr.length ? a : null
  }
  if (!currentCell.value) return null
  const box = cellRect(it, ...currentCell.value)
  return { r: box.r, c: box.c, rs: box.rs, cs: box.cs }
})
const cellColor = computed(() => (cellArea.value ? cellFill(first.value, cellArea.value.r, cellArea.value.c) || first.value.style?.fill : null))
const mergedInArea = computed(() => {
  const a = cellArea.value
  return a ? (first.value.merges || []).filter((m) => m.r >= a.r && m.r + m.rs <= a.r + a.rs && m.c >= a.c && m.c + m.cs <= a.c + a.cs) : []
})
// Already a single merged area: nothing more to merge
const canMerge = computed(() => {
  const a = cellArea.value
  if (!a || a.rs * a.cs < 2) return false
  const m = mergedInArea.value
  return !(m.length === 1 && m[0].rs === a.rs && m[0].cs === a.cs)
})

function mergeArea() {
  const a = cellArea.value
  const patch = mergeCells(first.value, [a.r, a.c], [a.r + a.rs - 1, a.c + a.cs - 1])
  if (!patch) return
  store.updateItem(first.value.id, patch)
  store.tableSel = { id: first.value.id, axis: "cells", from: [a.r, a.c], to: [a.r, a.c] }
}

function splitArea() {
  const inside = new Set(mergedInArea.value)
  store.updateItem(first.value.id, { merges: (first.value.merges || []).filter((m) => !inside.has(m)).map((m) => ({ ...m })) })
}

// Target of the row / column operations: the cell being edited, or the column / row picked with its grip
const tableTarget = computed(() => {
  if (currentCell.value) return { row: currentCell.value[0], col: currentCell.value[1] }
  if (cellArea.value) return { row: cellArea.value.r, col: cellArea.value.c }
  const t = store.tableSel
  return t && t.id === first.value.id ? { [t.axis]: t.index } : {}
})

const LINE_OPS = {
  col: [
    { op: "before", label: "Insérer une colonne à gauche" },
    { op: "after", label: "Insérer une colonne à droite" },
    { op: "back", label: "Déplacer vers la gauche" },
    { op: "forward", label: "Déplacer vers la droite" },
    { op: "remove", label: "Supprimer la colonne" },
  ],
  row: [
    { op: "before", label: "Insérer une ligne au-dessus" },
    { op: "after", label: "Insérer une ligne en dessous" },
    { op: "back", label: "Déplacer vers le haut" },
    { op: "forward", label: "Déplacer vers le bas" },
    { op: "remove", label: "Supprimer la ligne" },
  ],
}

const lineCount = (axis) => (axis === "col" ? first.value.colFr : first.value.rowFr).length

function lineOpAllowed(axis, op) {
  const i = tableTarget.value[axis]
  if (op === "back") return i > 0
  if (op === "forward") return i < lineCount(axis) - 1
  if (op === "remove") return lineCount(axis) > 1
  return true
}

function tableEdit(op, axis) {
  const it = first.value
  const i = op === "append" ? lineCount(axis) : tableTarget.value[axis]
  const insert = axis === "col" ? insertCol : insertRow
  const remove = axis === "col" ? removeCol : removeRow
  // Index of the target line once the operation is done (null: it is gone)
  const plan = {
    append: () => [insert(it, i), i],
    before: () => [insert(it, i), i],
    after: () => [insert(it, i + 1), i + 1],
    back: () => [moveLine(it, axis, i, i - 1), i - 1],
    forward: () => [moveLine(it, axis, i, i + 1), i + 1],
    remove: () => [remove(it, i), null],
  }[op]
  const [patch, index] = plan()
  if (!patch) return
  const cell = currentCell.value
  store.updateItem(it.id, patch)
  if (cell) {
    // Keep editing the same cell, wherever it went
    const k = axis === "row" ? 0 : 1
    const next = [...cell]
    if (op === "remove") return (store.editing = null)
    if (op === "before" || op === "append") next[k] = cell[k] + (op === "before" ? 1 : 0)
    if (op === "back" || op === "forward") next[k] = index
    store.editing = { id: it.id, cell: next }
  } else {
    store.tableSel = index === null ? null : { id: it.id, axis, index }
  }
}

function pickTableFill(color) {
  const a = cellArea.value
  if (!a) return setStyle({ fill: color }, "table")
  const it = first.value
  const fill = color === "transparent" ? null : color
  const cells = it.cells.map((row) => row.map((cell) => ({ ...cell })))
  for (let r = a.r; r < a.r + a.rs; r++) for (let c = a.c; c < a.c + a.cs; c++) cells[r][c].fill = fill
  store.updateItem(it.id, { cells })
}

const shapeChoices = [...SHAPES, ...FLOWCHART_SHAPES.filter((f) => !SHAPES.some((x) => x.key === f.key))]
const shownColor = (color, fallback) => (!color || color === "transparent" ? fallback : color)
const thumbFill = computed(() => shownColor(first.value.style?.fill, "#ecf1ff"))
const thumbStroke = computed(() => shownColor(first.value.style?.stroke, "#4554b2"))
// A single object (not a connector or a frame) can link to another board
const linkable = computed(() => items.value.length === 1 && !["connector", "frame"].includes(first.value.type))
const boards = ref(null)

async function toggleBoardLinks() {
  toggle("boardLink")
  if (open.value !== "boardLink") return
  boards.value = null
  try {
    boards.value = (await boardsApi.list()).filter((b) => b.id !== store.meta.id)
  } catch {
    boards.value = []
  }
}

function setBoardLink(board) {
  store.updateItem(first.value.id, { boardLink: board ? { id: board.id, title: board.title } : null })
  open.value = null
}
const editingRich = computed(() => {
  const it = editing.value && store.items[editing.value.id]
  return it && ["shape", "sticky", "text", "table"].includes(it.type)
})

const visible = computed(() => items.value.length > 0 && !props.busy && (!editing.value || editingRich.value))

// Room above the bar for the notation palette (the bar top, minus the popover gap and a margin)
const paletteRoom = computed(() => Math.max(90, parseFloat(position.value.top || 0) - 16))

const position = computed(() => {
  const b = store.boundsOf(ids.value)
  if (!b) return {}
  const { zoom, ox, oy } = store.view
  // A selected table has its column grips and "+" above it
  const top = b.y * zoom + oy - (onlyType.value === "table" && items.value.length === 1 ? 82 : 56)
  const below = (b.y + b.h) * zoom + oy + 16
  const cx = (b.x + b.w / 2) * zoom + ox
  const left = Math.max(8, Math.min(props.canvasSize.w - barWidth.value - 8, cx - barWidth.value / 2))
  return { left: `${left}px`, top: `${top < 64 ? Math.min(below, props.canvasSize.h - 60) : top}px` }
})

watch(ids, () => (open.value = null))
// A column / row picked with its grip: its operations right away
watch(() => store.tableSel, (t) => {
  if (t) open.value = "table"
  else if (open.value === "table" && !currentCell.value) open.value = null
})
watch([visible, ids, editingRich, open], async () => {
  await nextTick()
  if (bar.value) barWidth.value = bar.value.offsetWidth
})

function toggle(name) {
  open.value = open.value === name ? null : name
}

function setStyle(style, ...forTypes) {
  store.updateStyle(items.value.filter((it) => forTypes.includes(it.type)).map((it) => it.id), style)
}

function toggleLock() {
  const locked = !allLocked.value
  store.mutate(() => ids.value.forEach((id) => store.updateItem(id, { locked })))
}

function swapDirection() {
  store.mutate(() => {
    for (const it of items.value) {
      store.updateItem(it.id, {
        from: it.to, to: it.from,
        style: { startCap: it.style?.endCap || "none", endCap: it.style?.startCap || "none" },
        labels: (it.labels || []).map((l) => ({ ...l, t: 1 - (l.t ?? 0.5) })),
      })
    }
  })
}

function addLink() {
  const url = window.prompt("Adresse du lien (https://…)")
  if (url && /^(https?:|mailto:)/i.test(url.trim())) emit("command", "createLink", url.trim())
}

defineExpose({ close: () => (open.value = null) })
</script>

<style scoped lang="scss">
.props-bar {
  position: absolute;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(27, 36, 51, 0.12);
  white-space: nowrap;
  font-size: 0.85rem;

  button {
    height: 30px;
    min-width: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--surface-2);
    }

    &.active {
      background: var(--accent-soft);
      color: var(--accent-hover);
    }

    &.wide {
      padding: 0 8px;
    }

    &:disabled {
      opacity: 0.4;
    }
  }
}

.sep {
  width: 1px;
  align-self: stretch;
  margin: 4px 3px;
  background: var(--border);
}

.sep-h {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}

.menu {
  position: relative;
}

.popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 2;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(27, 36, 51, 0.14);

  &.right {
    left: auto;
    right: 0;
  }

  &.up {
    top: auto;
    bottom: calc(100% + 8px);
  }

  &.palette {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &.list {
    display: flex;
    flex-direction: column;
    min-width: 190px;
    padding: 4px;

    button {
      justify-content: flex-start;
      padding: 0 10px;
    }
  }

  &.options,
  .options {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 8px;
  }

  &.options {
    padding: 4px;
  }
}

.board-links {
  max-height: 320px;
  overflow-y: auto;

  button {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 260px;
    display: block !important;
    text-align: left;
    line-height: 30px;
  }
}

.popover-title {
  margin: 4px 10px 4px;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
}

.popover-hint {
  margin: 4px 10px 8px;
  color: var(--muted);

  &.wrap {
    max-width: 230px;
    white-space: normal;
    line-height: 1.35;
  }
}

.shapes {
  max-height: min(420px, 60vh);
  overflow-y: auto;

  button {
    gap: 10px !important;
  }

  .thumb {
    flex-shrink: 0;
  }
}

.check {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;

  &.range input {
    flex: 1;
  }
}

.chip {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.15);

  &.ring {
    background: none;
    border: 3px solid;
    box-sizing: border-box;
  }

  &.none {
    background: linear-gradient(135deg, var(--surface) 45%, var(--danger) 45%, var(--danger) 55%, var(--surface) 55%) !important;
  }
}

.text-a {
  font-weight: 700;
  border-bottom: 3px solid;
  line-height: 1.1;
  padding: 0 2px;
}
</style>
