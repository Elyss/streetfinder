// Dragon Punch (→↓↘ + P, "623") detection with the leniency of Street Fighter 6:
// - neutral between the directions is fine (6 5 2 3)
// - a ↘ before the ↓ is fine (6 3 2 3, typical on a leverless controller)
// - ending on → is fine (6 2 3 6), the button only has to come within the buffer after the ↘
// - leverless shortcut → ↘ → (6 3 6), and its SOCD version: ↑ added while ↓ is held, which the
//   controller resolves to → (neutral SOCD, 6 3 6) or ↗ (up priority / last input, 6 3 9)
// - the whole motion has to fit in a time window, and the button must follow the end of the motion closely
// The exact SF6 windows are not published by Capcom, so they are settings with sensible defaults.

export const FRAME_MS = 1000 / 60

export const DEFAULT_SETTINGS = {
  motionFrames: 10, // max frames from the first → to the end of the motion
  bufferFrames: 5, // max frames between the end of the motion and the button
  button: "punch", // punch, kick or any
  facing: "right",
}

export const ARROWS = { 1: "↙", 2: "↓", 3: "↘", 4: "←", 5: "N", 6: "→", 7: "↖", 8: "↑", 9: "↗" }

// Directions seen from the other side
const MIRROR = { 1: 3, 3: 1, 4: 6, 6: 4, 7: 9, 9: 7 }

export const normalizeDirection = (numpad, facing) => (facing === "left" ? MIRROR[numpad] ?? numpad : numpad)

const frames = (ms) => Math.round(ms / FRAME_MS)

// Index of the last input before `before` (exclusive) whose direction is one of `numpads`, or -1
const lastIndex = (inputs, numpads, before) => {
  for (let i = before - 1; i >= 0; i--) {
    if (numpads.includes(inputs[i].numpad)) return i
  }
  return -1
}

// Accepted motions. find() returns the indices of the first and last direction of the motion, or null.
const MOTIONS = [
  {
    variant: "standard",
    find: (inputs, before) => {
      const i3 = lastIndex(inputs, [3], before)
      const i2 = lastIndex(inputs, [2], i3)
      const i6 = lastIndex(inputs, [6], i2)
      return i3 === -1 || i2 === -1 || i6 === -1 ? null : { start: i6, middle: [i2], end: i3 }
    },
  },
  {
    variant: "shortcut",
    find: (inputs, before) => {
      const iEnd = lastIndex(inputs, [6, 9], before)
      const i3 = lastIndex(inputs, [3], iEnd)
      const i6 = lastIndex(inputs, [6], i3)
      return iEnd === -1 || i3 === -1 || i6 === -1 ? null : { start: i6, middle: [i3], end: iEnd }
    },
  },
]

// inputs: direction changes [{ numpad, t }] in order, normalized to facing right.
// pressedAt: time of the button press. Returns the verdict of one attempt.
export const analyseDp = (inputs, pressedAt, settings = DEFAULT_SETTINGS) => {
  const sequence = inputs.map((i) => i.numpad)
  const result = (ok, reason, extra = {}) => ({ ok, reason, sequence, ...extra })
  const before = inputs.filter((i) => i.t <= pressedAt).length

  // every motion found is checked for timing, the first one that passes wins
  const attempts = MOTIONS.map(({ variant, find }) => {
    const found = find(inputs, before)
    if (!found) return null

    const end = inputs[found.end]
    const motionFrames = frames(end.t - inputs[found.start].t)
    const buttonFrames = frames(pressedAt - end.t)
    const extra = {
      variant,
      motion: [found.start, ...found.middle, found.end].map((i) => inputs[i].numpad),
      motionFrames,
      buttonFrames,
    }
    if (motionFrames > settings.motionFrames) {
      return result(false, `Trop lent : motion en ${motionFrames} f (max ${settings.motionFrames}).`, extra)
    }
    if (buttonFrames > settings.bufferFrames) {
      return result(
        false,
        `Bouton trop tard : ${buttonFrames} f après le ${ARROWS[end.numpad]} (max ${settings.bufferFrames}).`,
        extra
      )
    }
    return result(true, "DP !", extra)
  }).filter(Boolean)

  if (attempts.length) return attempts.find((a) => a.ok) ?? attempts[0]

  // no accepted motion: explain what is missing
  const i3 = lastIndex(inputs, [3], before)
  if (i3 === -1) {
    if (sequence.includes(2)) return result(false, "Pas de ↘ avant le bouton : le ↓ n'est pas suivi du ↘.")
    return result(false, "Pas de ↘ avant le bouton.")
  }
  if (lastIndex(inputs, [6], i3) === -1) {
    const hadoken = lastIndex(inputs, [2], i3) !== -1 && inputs.slice(i3).some((i) => i.numpad === 6)
    return result(false, hadoken ? "Hadoken (↓↘→) : il manque le → avant le ↓." : "→ manquant avant le ↘.")
  }
  return result(false, "Motion incomplète : après → ↘, passez par ↓ (→ ↓ ↘) ou revenez sur → (→ ↘ →).")
}

export const matchesButton = (button, setting) =>
  setting === "any" || (setting === "punch" ? button.attack.endsWith("P") : button.attack.endsWith("K"))
