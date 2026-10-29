// SF6 input notation icons, inserted as inline images in rich text.
// Only these icons pass the sanitizer: an image is identified by its key, never by its src.
// Two sets: public/inputs/dark (dark ink, for light backgrounds, stored by default)
// and public/inputs/light (for dark backgrounds), picked at render time from the text color.
import { ARROWS } from "@/apps/inputbreaker/dp"
import { isDark } from "./theme"

// notation: short name shown in the palette (numpad for directions)
const dir = (n) => ({ key: n === 5 ? "neutral" : `dir_${n}`, alt: ARROWS[n], notation: String(n), label: n === 5 ? "Neutre" : `${ARROWS[n]} (${n})` })

// Numpad layout, as on the stick
export const DIRECTIONS = [7, 8, 9, 4, 5, 6, 1, 2, 3].map(dir)
export const CLASSIC = [
  { key: "lp", alt: "LP", label: "Light Punch" },
  { key: "mp", alt: "MP", label: "Medium Punch" },
  { key: "hp", alt: "HP", label: "Heavy Punch" },
  { key: "p_any", alt: "P", label: "Punch (n'importe lequel)" },
  { key: "lk", alt: "LK", label: "Light Kick" },
  { key: "mk", alt: "MK", label: "Medium Kick" },
  { key: "hk", alt: "HK", label: "Heavy Kick" },
  { key: "k_any", alt: "K", label: "Kick (n'importe lequel)" },
]
export const MODERN = [
  { key: "m_l", alt: "L", label: "Light (moderne)" },
  { key: "m_m", alt: "M", label: "Medium (moderne)" },
  { key: "m_h", alt: "H", label: "Heavy (moderne)" },
  { key: "m_sp", alt: "SP", label: "Special (moderne)" },
  { key: "m_a", alt: "A", label: "Auto (moderne)" },
  { key: "m_di", alt: "DI", label: "Drive Impact" },
  { key: "m_parry", alt: "Parry", notation: "DP", label: "Drive Parry" },
]
export const DRIVE = [
  { key: "drive_rush", alt: "DR", label: "Drive Rush" },
  { key: "drive_rush_cancel", alt: "DRC", label: "Drive Rush Cancel" },
]
export const SUPERS = [1, 2, 3].map((n) => ({ key: `super_${n}`, alt: `SA${n}`, notation: `SA${n}`, label: `Super Art ${n}` }))
// Dragon punch (→↓↘ + punch) in one icon; wider than the others (ratio = width / height)
export const DRAGON = [
  { key: "dp_lp", alt: "DP+LP", notation: "623LP", label: "Dragon punch LP", ratio: 122 / 64 },
  { key: "dp_mp", alt: "DP+MP", notation: "623MP", label: "Dragon punch MP", ratio: 122 / 64 },
  { key: "dp_hp", alt: "DP+HP", notation: "623HP", label: "Dragon punch HP", ratio: 122 / 64 },
  { key: "dp_ex", alt: "DP+PP", notation: "623PP", label: "Dragon punch EX (2 poings)", ratio: 140 / 64 },
]

export const INPUT_ICONS = Object.fromEntries([...DIRECTIONS, ...CLASSIC, ...MODERN, ...DRIVE, ...SUPERS, ...DRAGON].map((i) => [i.key, i]))

// Keys of earlier versions of the icon set, still found in saved boards
const RENAMED = { p: "p_any", k: "k_any", m_dp: "m_parry" }

/** Current key of an icon (null if unknown). */
export const inputKey = (key) => (INPUT_ICONS[key] ? key : RENAMED[key] || null)

export const inputSrc = (key, variant = "dark") => `/inputs/${variant}/${key}.svg`

export const VARIANTS = ["dark", "light"]

// Icon with its notation underneath (rendering only: the stored text keeps the bare image).
// Its baseline is the bottom of the icon, so the icon sits on the text line like before.
const CHIP = "display:inline-flex;flex-direction:column;align-items:center;vertical-align:-0.38em;line-height:1"
// Its color follows the background, like the icon set (the text color may not suit it)
const CAPTION = "font-size:0.55em;font-weight:700;line-height:1.15;white-space:nowrap"
const CAPTION_COLOR = { dark: "#5c626c", light: "#c4c9d3" }

/**
 * Icons of rich text drawn over `background`, each with its notation underneath.
 * The light set goes on a dark background; icons inserted with a forced set (data-variant) keep it.
 * The block is not editable: in the editor it is deleted at once.
 */
export function iconsFor(html, background) {
  if (!html) return html
  const light = isDark(background)
  return html.replace(/<img [^>]*data-input="([a-z0-9_]+)"[^>]*>/g, (tag, key) => {
    const icon = INPUT_ICONS[key]
    const img = light && !tag.includes("data-variant=") ? tag.replace('src="/inputs/dark/', 'src="/inputs/light/') : tag
    const caption = `${CAPTION};color:${CAPTION_COLOR[light ? "light" : "dark"]}`
    return `<span data-input-chip="" contenteditable="false" style="${CHIP}">${img}<span style="${caption}">${icon ? icon.notation || icon.alt : ""}</span></span>`
  })
}

// Inline styles (not CSS classes) so that exported SVG/PNG render the same way.
// A fixed width lays the text out right before the image is decoded.
const inputStyle = (ratio = 1) => `height:1.4em;width:${+(1.4 * ratio).toFixed(3)}em;vertical-align:-0.38em;margin:0 0.03em`

/** HTML of an icon; `variant` ("dark" / "light") forces its set, otherwise it follows the text color. */
export function inputHtml(key, variant = null) {
  const icon = INPUT_ICONS[inputKey(key)]
  if (!icon) return ""
  const forced = VARIANTS.includes(variant) ? variant : null
  return `<img src="${inputSrc(icon.key, forced || "dark")}" alt="${icon.alt}" data-input="${icon.key}"${forced ? ` data-variant="${forced}"` : ""} draggable="false" style="${inputStyle(icon.ratio)}">`
}

const PUNCHES = ["LP", "MP", "HP"]

/** Icons of a step captured from the controller: motion (numpad, facing right) then buttons. */
export function stepHtml(motion, buttons, variant = null) {
  // →↓↘ + punch(es): the dragon punch icon
  if (motion.join("") === "623" && buttons.length && buttons.every((b) => PUNCHES.includes(b))) {
    return inputHtml(buttons.length > 1 ? "dp_ex" : `dp_${buttons[0].toLowerCase()}`, variant)
  }
  const keys = [...motion.map((n) => dir(n).key), ...buttons.map((b) => b.toLowerCase())]
  return keys.map((k) => inputHtml(k, variant)).join("")
}
