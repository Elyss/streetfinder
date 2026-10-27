// Move categories, in the order of the official frame data table
export const CATEGORY_LABELS = {
  normal: "Coups normaux",
  unique: "Coups uniques",
  special: "Coups spéciaux",
  super_art: "Super Arts",
  throw: "Projections",
  common: "Coups communs",
}

// Frame advantage as a number, or null when it is not numeric ("D", "")
export const advantage = (value) => (/^-?\d+$/.test(value) ? parseInt(value, 10) : null)

// Startup as a number ("122*" -> 122), or null when there is none ("", "*")
export const startupFrames = (value) => (/^\d+/.test(value) ? parseInt(value, 10) : null)

// "5" -> "+5" ; "-2", "D" and "" are left as is
export const signed = (value) => (advantage(value) > 0 ? `+${value}` : value)

export const advantageClass = (value) => {
  const frames = advantage(value)
  return { plus: frames > 0, minus: frames < 0 }
}
