import { onUnmounted } from "vue"
import { FRAME_MS, normalizeDirection } from "@/apps/inputbreaker/dp"

const BUTTON_ORDER = ["LP", "MP", "HP", "LK", "MK", "HK"]
// Buttons pressed within this delay form one step (P+P, LP+LK...)
const GROUP_MS = 5 * FRAME_MS

/**
 * Cuts the controller inputs into combo steps, for recording and practice.
 *
 * pad: useGamepad() result; facing: ref "right" | "left"; active: () => boolean.
 * onStep(g) is called for each button press (grouped), with
 *   g.buttons  pressed attacks ("LP"...), g.held  direction at the press,
 *   g.changes  direction changes since the previous step (5 = neutral),
 *   g.carried  direction still held when the previous step was done (5 if none).
 * onDirection(dir, seen) is called on each direction change; returning true consumes
 * the directions (a step made of directions only, like a dash).
 * Directions are normalized as if facing right.
 */
export function useStepCapture(pad, facing, { active, onStep, onDirection }) {
  let changes = []
  let carried = 5
  let lastDir = 5
  let lastPressed = new Set()
  let group = null

  const reset = () => {
    changes = []
    carried = 5
    group = null
  }

  // A motion can start from the direction held since the previous step
  const seen = (list) => (carried !== 5 ? [carried, ...list] : list)

  const stop = pad.onFrame((state, now) => {
    const dir = normalizeDirection(state.direction.numpad, facing.value)
    const on = active()
    if (dir !== lastDir) {
      lastDir = dir
      if (on) {
        changes.push(dir)
        if (changes.length > 40) changes = changes.slice(-40)
        if (!group && onDirection?.(dir, seen(changes))) {
          changes = []
          carried = dir
        }
      }
    }

    const fresh = state.pressed.filter((b) => b.attack && !lastPressed.has(b.index))
    lastPressed = new Set(state.pressed.map((b) => b.index))
    if (!on) return

    if (fresh.length) {
      group ??= { t: now, buttons: [], changes: [...changes], carried, held: dir }
      for (const b of fresh) if (!group.buttons.includes(b.attack)) group.buttons.push(b.attack)
    }
    if (group && now - group.t >= GROUP_MS) {
      const g = group
      group = null
      g.buttons.sort((a, b) => BUTTON_ORDER.indexOf(a) - BUTTON_ORDER.indexOf(b))
      // Directions are consumed by the step
      changes = []
      carried = g.held
      onStep(g)
    }
  })

  onUnmounted(stop)

  return { reset }
}
