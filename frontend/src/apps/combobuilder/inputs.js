// Combo steps: { motion: [numpad...], buttons: ["LP" | "P" | ...], label }
// Directions use the numpad notation seen from a character facing right (6 = forward).
// No timing for now: a step only checks which directions and buttons were used.
import { ARROWS } from "@/apps/inputbreaker/dp"

const ARROW_TO_NUMPAD = { "↙": 1, "↓": 2, "↘": 3, "←": 4, "→": 6, "↖": 7, "↑": 8, "↗": 9 }
const BUTTON_TOKENS = /\b(LP|MP|HP|LK|MK|HK|P|K)\b/g
const PUNCHES = ["LP", "MP", "HP"]
const KICKS = ["LK", "MK", "HK"]

// Shortcuts accepted by the game for some motions (leverless / SOCD, see inputbreaker/dp.js)
const ALTERNATIVES = {
  "6,2,3": [[6, 3, 6], [6, 3, 9]],
}

/**
 * Steps of a move command: "↓↘→ + LP > → + P" gives two steps.
 * Context in parentheses ("(During a jump)") is ignored, a charge "[←]→" becomes ← →.
 */
export function parseCommand(command, label = "") {
  const steps = []
  for (const part of command.split(">")) {
    const text = part.replace(/\([^)]*\)/g, " ").replace(/[[\]]/g, "")
    const motion = [...text].map((c) => ARROW_TO_NUMPAD[c]).filter(Boolean)
    const buttons = text.replace(/[↙↓↘←→↖↑↗]/g, " ").match(BUTTON_TOKENS) || []
    if (motion.length || buttons.length) steps.push({ motion, buttons, label })
  }
  return steps
}

export function formatMotion(motion) {
  return motion.map((d) => ARROWS[d]).join(" ")
}

export function formatStep(step) {
  return [formatMotion(step.motion), step.buttons.join("+")].filter(Boolean).join(" + ")
}

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/** Every requested button is matched by a distinct pressed one, and nothing extra is pressed. */
export function buttonsMatch(expected, pressed) {
  if (expected.length !== pressed.length) return false
  const left = [...pressed]
  // Specific buttons first, generic P / K afterwards
  const ordered = [...expected].sort((a, b) => b.length - a.length)
  for (const token of ordered) {
    const family = token === "P" ? PUNCHES : token === "K" ? KICKS : [token]
    const i = left.findIndex((b) => family.includes(b))
    if (i === -1) return false
    left.splice(i, 1)
  }
  return true
}

function isSubsequence(needle, haystack) {
  let i = 0
  for (const d of haystack) if (d === needle[i]) i++
  return i === needle.length
}

/**
 * Was the motion of a step done?
 * changes: direction changes since the previous step (5 = neutral), held: direction at the press.
 */
export function motionMatches(motion, changes, held) {
  if (!motion.length) return ![1, 2, 3].includes(held) // a standing attack, not a crouching one
  if (motion.length === 1) {
    const d = motion[0]
    // Any down direction crouches, any up direction jumps
    if (d === 2) return [1, 2, 3].includes(held)
    if (d === 8) return [7, 8, 9].includes(held)
    return held === d
  }
  const candidates = [motion, ...(ALTERNATIVES[motion.join(",")] || [])]
  return candidates.some((m) => isSubsequence(m, changes))
}

/** Motion recorded from the controller: the directions used since the previous step. */
export function recordedMotion(changes, held) {
  const dirs = []
  for (const d of changes) if (d !== 5 && d !== dirs[dirs.length - 1]) dirs.push(d)
  // A single direction (or one still held since the previous step) is a command normal
  // or a crouching attack (↓ + MK): what counts is the direction held at the press
  if (dirs.length <= 1) return held === 5 ? [] : [held]
  return dirs
}

/** Move of the character matching a recorded step, to label it ("Hadoken"). */
export function findMove(step, moves) {
  let generic = null
  for (const move of moves) {
    const parsed = parseCommand(move.command)
    if (parsed.length !== 1 || /\(/.test(move.command)) continue
    const [s] = parsed
    if (!sameList(s.motion, step.motion)) continue
    if (sameList(s.buttons, step.buttons)) return move
    if (!generic && buttonsMatch(s.buttons, step.buttons)) generic = move
  }
  return generic
}
