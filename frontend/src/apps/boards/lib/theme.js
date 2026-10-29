// Dark mode of the board editor (a preference of the viewer, not of the board).
// Object colors are kept; only dark ink drawn straight on the canvas (free texts, arrows,
// shapes without fill, frame titles) is lightened to stay readable. Exports keep the light rendering.
import { reactive } from "vue"

export const boardTheme = reactive({ dark: false, items: {} })

const KEY = "boards.theme"

export function loadDark() {
  try {
    return localStorage.getItem(KEY) === "dark"
  } catch {
    return false
  }
}

export function saveDark(dark) {
  try {
    localStorage.setItem(KEY, dark ? "dark" : "light")
  } catch {
    // Private browsing: the choice lasts for the session
  }
}

const rgb = (hex) => {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

const luminance = ([r, g, b]) => {
  const ch = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** Light color (text drawn on a dark background). */
export function isLight(color) {
  return !!color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) && luminance(rgb(color)) > 0.4
}

/** Dark color (a background on which light icons read). */
export function isDark(color) {
  return !!color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) && luminance(rgb(color)) <= 0.4
}

const cache = new Map()

/** Color to draw `color` with, over `fill` (no fill: the canvas). */
export function ink(color, fill) {
  if (!boardTheme.dark || !color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return color
  if (fill && fill !== "transparent" && fill !== "none") return color
  if (!cache.has(color)) {
    const c = rgb(color)
    // Dark ink is mixed with white, keeping a hint of its hue
    const out = luminance(c) < 0.3 ? `#${c.map((v) => Math.round(v + (240 - v) * 0.78).toString(16).padStart(2, "0")).join("")}` : color
    cache.set(color, out)
  }
  return cache.get(color)
}

const WHITE = new Set(["#fff", "#ffffff", "white"])

/** Fill of a frame: a white frame takes a dark tint in dark mode, like the canvas. */
export function frameFill(fill) {
  return boardTheme.dark && (!fill || WHITE.has(fill.toLowerCase())) ? "#24272e" : fill || "#ffffff"
}

/** What is painted under an object without fill: its frame (if colored), or the canvas (null). */
export function backdropOf(item) {
  const frame = item?.parent && boardTheme.items[item.parent]
  return frame ? frameFill(frame.style?.fill) : boardTheme.dark ? null : "#ffffff"
}

/** Color actually painted under the text of an object: its fill, otherwise its frame, otherwise the canvas. */
export function surfaceOf(item, fill = item?.style?.fill) {
  if (fill && fill !== "transparent" && fill !== "none") return WHITE.has(fill.toLowerCase()) ? "#ffffff" : fill
  return backdropOf(item) || canvasColor()
}

/** Ink of an object: over its own fill, otherwise over its frame or the canvas. */
export function inkOf(color, item, fill = item?.style?.fill) {
  if (!boardTheme.dark) return color
  if (fill && fill !== "transparent" && fill !== "none") return color
  const under = backdropOf(item)
  return under && under !== "#24272e" ? color : ink(color)
}

/** Canvas background, for the parts of objects painted "like the background" (hollow arrow heads). */
export const canvasColor = () => (boardTheme.dark ? "#1b1d22" : "#ffffff")
