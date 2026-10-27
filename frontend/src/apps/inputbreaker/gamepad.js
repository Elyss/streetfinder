// Reading of a gamepad with the browser "standard" mapping
// (https://w3c.github.io/gamepad/#remapping), which is what the Haute42 and
// most pads expose, with the default Street Fighter 6 attack layout.

export const BUTTONS = [
  { index: 0, label: "✕ / A", attack: "LK" },
  { index: 1, label: "○ / B", attack: "MK" },
  { index: 2, label: "□ / X", attack: "LP" },
  { index: 3, label: "△ / Y", attack: "MP" },
  { index: 4, label: "L1 / LB", attack: "" },
  { index: 5, label: "R1 / RB", attack: "HP" },
  { index: 6, label: "L2 / LT", attack: "" },
  { index: 7, label: "R2 / RT", attack: "HK" },
  { index: 8, label: "Select", attack: "" },
  { index: 9, label: "Start", attack: "" },
  { index: 10, label: "L3", attack: "" },
  { index: 11, label: "R3", attack: "" },
  { index: 12, label: "↑", direction: [0, -1] },
  { index: 13, label: "↓", direction: [0, 1] },
  { index: 14, label: "←", direction: [-1, 0] },
  { index: 15, label: "→", direction: [1, 0] },
  { index: 16, label: "Home", attack: "" },
]

export const ATTACK_BUTTONS = BUTTONS.filter((b) => b.attack !== undefined)
export const DIRECTION_BUTTONS = BUTTONS.filter((b) => b.direction)

// Directions in numpad notation, keyed by "x,y" (x: -1 left / 1 right, y: -1 up / 1 down)
export const DIRECTIONS = {
  "-1,-1": { numpad: 7, arrow: "↖" }, "0,-1": { numpad: 8, arrow: "↑" }, "1,-1": { numpad: 9, arrow: "↗" },
  "-1,0": { numpad: 4, arrow: "←" }, "0,0": { numpad: 5, arrow: "N" }, "1,0": { numpad: 6, arrow: "→" },
  "-1,1": { numpad: 1, arrow: "↙" }, "0,1": { numpad: 2, arrow: "↓" }, "1,1": { numpad: 3, arrow: "↘" },
}

const STICK_DEADZONE = 0.5

const clamp = (v) => Math.max(-1, Math.min(1, v))

// Current state of a Gamepad object: direction (d-pad or left stick) and pressed buttons
export const readGamepad = (pad) => {
  let x = 0
  let y = 0
  for (const button of DIRECTION_BUTTONS) {
    if (pad.buttons[button.index]?.pressed) {
      x += button.direction[0]
      y += button.direction[1]
    }
  }
  if (Math.abs(pad.axes[0] ?? 0) > STICK_DEADZONE) x += Math.sign(pad.axes[0])
  if (Math.abs(pad.axes[1] ?? 0) > STICK_DEADZONE) y += Math.sign(pad.axes[1])

  const direction = DIRECTIONS[`${clamp(x)},${clamp(y)}`]
  const pressed = ATTACK_BUTTONS.filter((b) => pad.buttons[b.index]?.pressed)
  return {
    direction,
    pressed,
    // "↓ + LP+LK", "↘", "Start"... empty when nothing is held
    notation: [direction.arrow === "N" ? "" : direction.arrow, pressed.map((b) => b.attack || b.label).join("+")]
      .filter(Boolean)
      .join(" + "),
  }
}
