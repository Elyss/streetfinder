// Catalog, palette and default styles of the board objects.

export const GRID = 20

// Harmonised palette: ~10 hues in 3 nuances, so that every diagram looks clean by default
export const PALETTE = [
  { name: "Gris", light: "#f1f3f6", mid: "#c5cad3", dark: "#424853" },
  { name: "Rouge", light: "#fde4e1", mid: "#f4a39a", dark: "#c62525" },
  { name: "Orange", light: "#fdebd8", mid: "#f6bd84", dark: "#c2650f" },
  { name: "Jaune", light: "#fff4c2", mid: "#f8d86a", dark: "#9a7400" },
  { name: "Vert", light: "#e1f5e9", mid: "#93d6ad", dark: "#27905c" },
  { name: "Turquoise", light: "#dcf4f3", mid: "#86d3cf", dark: "#13837d" },
  { name: "Bleu", light: "#e2ecfd", mid: "#9bbcf3", dark: "#2f62c9" },
  { name: "Indigo", light: "#ecf1ff", mid: "#b3bff0", dark: "#4554b2" },
  { name: "Violet", light: "#f1e6fb", mid: "#c9a3ec", dark: "#7a3fb8" },
  { name: "Rose", light: "#fce4f0", mid: "#f2a3c8", dark: "#b8336f" },
]
export const NEUTRALS = ["#ffffff", "#2e333d", "transparent"]

export const STICKY_COLORS = [
  "#fff2a8", "#ffd9a8", "#ffc4c0", "#f9c9e4", "#ddd0ff",
  "#c6d9ff", "#bfeefa", "#c9f2d0", "#e6e8eb", "#ffffff",
]

export const SHAPES = [
  { key: "rect", label: "Rectangle" },
  { key: "rounded", label: "Rectangle arrondi" },
  { key: "ellipse", label: "Ellipse" },
  { key: "diamond", label: "Losange" },
  { key: "triangle", label: "Triangle" },
  { key: "parallelogram", label: "Parallélogramme" },
  { key: "hexagon", label: "Hexagone" },
  { key: "cylinder", label: "Cylindre" },
  { key: "document", label: "Document" },
  { key: "cloud", label: "Nuage" },
  { key: "star", label: "Étoile" },
]

export const FLOWCHART_SHAPES = [
  { key: "pill", label: "Début / fin" },
  { key: "rect", label: "Processus" },
  { key: "diamond", label: "Décision" },
  { key: "parallelogram", label: "Entrée / sortie" },
  { key: "subprocess", label: "Sous-processus" },
  { key: "offpage", label: "Renvoi de page" },
]

export const SHAPE_LABELS = Object.fromEntries(
  [...FLOWCHART_SHAPES, ...SHAPES].map((s) => [s.key, s.label]),
)

export const FONT_SIZES = { s: 12, m: 16, l: 24, xl: 36 }
export const FONT_SIZE_LABELS = { s: "Petit", m: "Moyen", l: "Grand", xl: "Très grand" }

export const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  hand: '"Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive',
  mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
}
export const FONT_LABELS = { sans: "Standard", hand: "Manuscrite", mono: "Monospace" }

export const CAPS = [
  { key: "none", label: "Aucune" },
  { key: "arrow", label: "Flèche pleine" },
  { key: "open", label: "Flèche ouverte" },
  { key: "circle", label: "Cercle" },
  { key: "diamond", label: "Losange" },
  { key: "bar", label: "Barre" },
  { key: "one", label: "Un (‖)" },
  { key: "many", label: "Plusieurs (patte d'oie)" },
  { key: "one-many", label: "Un ou plusieurs" },
  { key: "zero-many", label: "Zéro ou plusieurs" },
]

export const STROKE_WIDTHS = [1, 2, 3, 5]

const DEFAULT_STYLES = {
  shape: {
    fill: "#ecf1ff", stroke: "#4554b2", strokeWidth: 2, strokeStyle: "solid",
    textColor: "#2e333d", fontSize: "m", font: "sans", align: "center", valign: "middle",
    opacity: 1, shadow: false,
  },
  sticky: {
    fill: "#fff2a8", textColor: "#2e333d", fontSize: "l", font: "sans",
    align: "center", valign: "middle", showAuthor: false,
  },
  text: { textColor: "#2e333d", fontSize: "m", font: "sans", align: "left", valign: "top" },
  frame: { fill: "#ffffff", stroke: "#c5cad3", textColor: "#5c626c" },
  image: { radius: 0, opacity: 1 },
  connector: {
    stroke: "#424853", strokeWidth: 2, strokeStyle: "solid", route: "elbow",
    rounded: true, startCap: "none", endCap: "arrow", textColor: "#2e333d",
  },
}

export const DEFAULT_SIZES = {
  shape: { w: 160, h: 80 },
  sticky: { w: 160, h: 160 },
  text: { w: 200, h: 32 },
  frame: { w: 640, h: 420 },
  image: { w: 320, h: 240 },
}

export const hasText = (it) => ["shape", "sticky", "text"].includes(it.type)

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

// The last style used is remembered per object type and applied to new objects.
export function lastStyle(type) {
  try {
    return JSON.parse(localStorage.getItem(`boards.style.${type}`)) || {}
  } catch {
    return {}
  }
}

export function rememberStyle(type, patch) {
  try {
    localStorage.setItem(`boards.style.${type}`, JSON.stringify({ ...lastStyle(type), ...patch }))
  } catch {
    // storage unavailable: nothing to remember
  }
}

export function makeItem(type, props = {}) {
  const size = DEFAULT_SIZES[type] || {}
  const item = {
    id: newId(),
    type,
    x: 0,
    y: 0,
    ...size,
    z: Date.now() / 1000,
    text: "",
    parent: null,
    group: null,
    locked: false,
    ...props,
    style: { ...DEFAULT_STYLES[type], ...lastStyle(type), ...props.style },
  }
  if (type === "shape" && !item.shape) item.shape = "rect"
  if (type === "frame" && !item.text) item.text = "Cadre"
  if (type === "connector") {
    delete item.w
    delete item.h
    item.labels ??= []
  }
  return item
}

export function fontSizeOf(style) {
  return FONT_SIZES[style?.fontSize] || FONT_SIZES.m
}

export function dashArray(style, width) {
  if (style === "dashed") return `${width * 4} ${width * 3}`
  if (style === "dotted") return `0 ${width * 2.2}`
  return null
}
