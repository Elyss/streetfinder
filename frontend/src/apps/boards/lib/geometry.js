// Pure geometry: rectangles, shape outlines and connector routing.

export const SIDES = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export const rectOf = (it) => ({ x: it.x, y: it.y, w: it.w, h: it.h })
export const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
export const inflate = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m })

export const intersects = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export const contains = (outer, inner) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

export const containsPoint = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

export function union(rects) {
  if (!rects.length) return null
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const r of rects) {
    x1 = Math.min(x1, r.x)
    y1 = Math.min(y1, r.y)
    x2 = Math.max(x2, r.x + r.w)
    y2 = Math.max(y2, r.y + r.h)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function rectFromPoints(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// ------------------------------------------------------------------ shapes

function roundedRect(w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}` +
    `H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
}

function cloudPath(w, h) {
  const n = 9, cx = w / 2, cy = h / 2, rx = w * 0.4, ry = h * 0.36
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n]
    const r = dist(pts[i - 1], p) * 0.62
    d += `A${r} ${r} 0 0 1 ${p.x} ${p.y}`
  }
  return d + "Z"
}

function starPath(w, h) {
  let d = ""
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const k = i % 2 ? 0.45 : 1
    d += `${i ? "L" : "M"}${w / 2 + Math.cos(a) * (w / 2) * k} ${h * 0.53 + Math.sin(a) * (h * 0.53) * k}`
  }
  return d + "Z"
}

/** Outline (`d`) and optional stroke-only decoration (`decor`) of a shape of size w x h. */
export function shapePath(kind, w, h) {
  switch (kind) {
    case "rounded":
      return { d: roundedRect(w, h, 14) }
    case "pill":
      return { d: roundedRect(w, h, Math.min(w, h) / 2) }
    case "ellipse":
      return { d: `M0 ${h / 2}A${w / 2} ${h / 2} 0 1 0 ${w} ${h / 2}A${w / 2} ${h / 2} 0 1 0 0 ${h / 2}Z` }
    case "diamond":
      return { d: `M${w / 2} 0L${w} ${h / 2}L${w / 2} ${h}L0 ${h / 2}Z` }
    case "triangle":
      return { d: `M${w / 2} 0L${w} ${h}H0Z` }
    case "parallelogram": {
      const s = Math.min(w * 0.2, h * 0.6)
      return { d: `M${s} 0H${w}L${w - s} ${h}H0Z` }
    }
    case "hexagon": {
      const s = Math.min(w * 0.25, h * 0.5)
      return { d: `M${s} 0H${w - s}L${w} ${h / 2}L${w - s} ${h}H${s}L0 ${h / 2}Z` }
    }
    case "cylinder": {
      const ry = Math.min(h * 0.15, 16)
      return {
        d: `M0 ${ry}A${w / 2} ${ry} 0 0 1 ${w} ${ry}V${h - ry}A${w / 2} ${ry} 0 0 1 0 ${h - ry}Z`,
        decor: `M0 ${ry}A${w / 2} ${ry} 0 0 0 ${w} ${ry}`,
      }
    }
    case "document": {
      const a = Math.min(h * 0.12, 14)
      return { d: `M0 0H${w}V${h - a}C${w * 0.75} ${h - a * 3} ${w * 0.25} ${h + a} 0 ${h - a}Z` }
    }
    case "cloud":
      return { d: cloudPath(w, h) }
    case "star":
      return { d: starPath(w, h) }
    case "subprocess": {
      const e = Math.min(12, w * 0.1)
      return { d: `M0 0H${w}V${h}H0Z`, decor: `M${e} 0V${h}M${w - e} 0V${h}` }
    }
    case "offpage":
      return { d: `M0 0H${w}V${h * 0.62}L${w / 2} ${h}L0 ${h * 0.62}Z` }
    default:
      return { d: `M0 0H${w}V${h}H0Z` }
  }
}

/** Padding of the text box inside a shape, so that text stays inside the outline. */
export function textInset(item) {
  const { w, h } = item
  const p = 10
  if (item.type === "sticky") return { l: 14, t: 14, r: 14, b: 14 }
  if (item.type === "text") return { l: 2, t: 4, r: 2, b: 4 }
  switch (item.shape) {
    case "diamond": return { l: w * 0.2, t: h * 0.2, r: w * 0.2, b: h * 0.2 }
    case "ellipse": return { l: w * 0.12, t: h * 0.1, r: w * 0.12, b: h * 0.1 }
    case "triangle": return { l: w * 0.25, t: h * 0.4, r: w * 0.25, b: p }
    case "star": return { l: w * 0.28, t: h * 0.32, r: w * 0.28, b: h * 0.22 }
    case "cloud": return { l: w * 0.18, t: h * 0.18, r: w * 0.18, b: h * 0.18 }
    case "parallelogram": return { l: Math.min(w * 0.2, h * 0.6), t: p, r: Math.min(w * 0.2, h * 0.6), b: p }
    case "hexagon": return { l: Math.min(w * 0.2, h * 0.4), t: p, r: Math.min(w * 0.2, h * 0.4), b: p }
    case "cylinder": return { l: p, t: Math.min(h * 0.15, 16) * 2, r: p, b: p }
    case "document": return { l: p, t: p, r: p, b: Math.min(h * 0.12, 14) + p }
    case "subprocess": return { l: Math.min(12, w * 0.1) + 6, t: p, r: Math.min(12, w * 0.1) + 6, b: p }
    case "offpage": return { l: p, t: p, r: p, b: h * 0.3 }
    default: return { l: p, t: p, r: p, b: p }
  }
}

// ------------------------------------------------------------------ anchors

export function anchorPoint(r, side) {
  const c = center(r)
  switch (side) {
    case "top": return { x: c.x, y: r.y }
    case "bottom": return { x: c.x, y: r.y + r.h }
    case "left": return { x: r.x, y: c.y }
    default: return { x: r.x + r.w, y: c.y }
  }
}

/** Side of `r` facing point `p` (relative to the rectangle proportions). */
export function facingSide(r, p) {
  const c = center(r)
  const dx = (p.x - c.x) / Math.max(r.w, 1)
  const dy = (p.y - c.y) / Math.max(r.h, 1)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left"
  return dy >= 0 ? "bottom" : "top"
}

/** Point where the segment from the center of `item` toward `p` leaves its outline. */
function boundaryPoint(item, p) {
  const r = rectOf(item)
  const c = center(r)
  const dx = p.x - c.x, dy = p.y - c.y
  if (!dx && !dy) return c
  const hw = r.w / 2, hh = r.h / 2
  let t
  if (item.shape === "ellipse") t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh))
  else if (item.shape === "diamond") t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
  else t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

// ------------------------------------------------------------------ connectors

function resolveEnd(end, items) {
  const it = end?.id ? items[end.id] : null
  if (it && it.type !== "connector") return { item: it, rect: rectOf(it), side: end.side || "auto" }
  return { point: { x: end?.x ?? 0, y: end?.y ?? 0 } }
}

function freeDir(p, q) {
  const dx = q.x - p.x, dy = q.y - p.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx) || 1, y: 0 }
  return { x: 0, y: Math.sign(dy) || 1 }
}

const add = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k })

function simplify(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01) continue
    if (out.length >= 2) {
      const a = out[out.length - 2]
      if ((Math.abs(a.x - last.x) < 0.01 && Math.abs(last.x - p.x) < 0.01) ||
        (Math.abs(a.y - last.y) < 0.01 && Math.abs(last.y - p.y) < 0.01)) {
        out[out.length - 1] = p
        continue
      }
    }
    out.push(p)
  }
  return out
}

// Axis-aligned segment against the open interior of a rectangle
function segHitsRect(a, b, r) {
  const e = 0.5
  if (Math.abs(a.y - b.y) < 0.01) {
    return a.y > r.y + e && a.y < r.y + r.h - e &&
      Math.max(Math.min(a.x, b.x), r.x) < Math.min(Math.max(a.x, b.x), r.x + r.w) - e
  }
  return a.x > r.x + e && a.x < r.x + r.w - e &&
    Math.max(Math.min(a.y, b.y), r.y) < Math.min(Math.max(a.y, b.y), r.y + r.h) - e
}

/**
 * Orthogonal routing. A small set of deterministic candidate paths is scored
 * (length, bends, crossings of the end shapes and of other objects): this is
 * cheap enough to run on every frame and stays stable during small moves.
 */
function elbowPoints(p1, d1, r1, p2, d2, r2, obstacles) {
  const M = 20
  const a = add(p1, d1, M), b = add(p2, d2, M)
  // Midpoints first: on equal cost the bend sits halfway, which reads better
  const xs = [(a.x + b.x) / 2, a.x, b.x], ys = [(a.y + b.y) / 2, a.y, b.y]
  for (const r of [r1, r2]) {
    if (!r) continue
    xs.push(r.x - M, r.x + r.w + M)
    ys.push(r.y - M, r.y + r.h + M)
  }
  const cands = []
  for (const x of xs) cands.push([{ x, y: a.y }, { x, y: b.y }])
  for (const y of ys) cands.push([{ x: a.x, y }, { x: b.x, y }])
  for (const x of xs) {
    for (const y of ys) {
      cands.push([{ x, y: a.y }, { x, y }, { x: b.x, y }])
      cands.push([{ x: a.x, y }, { x, y }, { x, y: b.y }])
    }
  }

  const ends = [r1, r2].filter(Boolean)
  let best = null, bestCost = Infinity
  for (const mid of cands) {
    const pts = simplify([p1, a, ...mid, b, p2])
    let cost = 30 * (pts.length - 2)
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1]
      cost += Math.abs(s.x - e.x) + Math.abs(s.y - e.y)
      for (const r of ends) if (segHitsRect(s, e, r)) cost += 10000
      for (const r of obstacles) if (segHitsRect(s, e, r)) cost += 600
    }
    // The path must leave and enter the shapes perpendicularly to their sides
    const f = freeDir(pts[0], pts[1]), l = freeDir(pts[pts.length - 2], pts[pts.length - 1])
    if (f.x !== d1.x || f.y !== d1.y) cost += 5000
    if (l.x !== -d2.x || l.y !== -d2.y) cost += 5000
    if (cost < bestCost) {
      bestCost = cost
      best = pts
    }
  }
  return best
}

function roundedPolyline(pts, radius) {
  let d = `M${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], prev = pts[i - 1], next = pts[i + 1]
    const r = Math.min(radius, dist(prev, p) / 2, dist(p, next) / 2)
    const a = add(p, norm(prev, p), -r), b = add(p, norm(p, next), r)
    d += `L${a.x} ${a.y}Q${p.x} ${p.y} ${b.x} ${b.y}`
  }
  const last = pts[pts.length - 1]
  return d + `L${last.x} ${last.y}`
}

function norm(a, b) {
  const l = dist(a, b) || 1
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }
}

function bezierPoint(p1, c1, c2, p2, t) {
  const u = 1 - t
  return {
    x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
    y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
  }
}

export const capSize = (sw) => 6 + sw * 2.5

const CAP_INSET = { arrow: 0.85, diamond: 1.2, circle: 1 }

function shorten(pts, fromStart, amount) {
  if (!amount || pts.length < 2) return pts
  pts = pts.slice()
  const i = fromStart ? 0 : pts.length - 1
  const j = fromStart ? 1 : pts.length - 2
  const l = dist(pts[i], pts[j])
  if (l <= amount + 1) return pts
  pts[i] = add(pts[i], norm(pts[i], pts[j]), amount)
  return pts
}

/**
 * Full geometry of a connector: drawn path, sampled polyline (labels, hit-tests),
 * end points with their arrival angle (caps) and bounds.
 */
export function connectorGeometry(conn, items, obstacles = []) {
  const style = conn.style || {}
  const a = resolveEnd(conn.from, items)
  const b = resolveEnd(conn.to, items)
  const route = style.route || "elbow"

  const refPoint = (e) => (e.rect ? (e.side === "auto" ? center(e.rect) : anchorPoint(e.rect, e.side)) : e.point)
  const sideOf = (e, other) => (e.rect ? (e.side === "auto" ? facingSide(e.rect, refPoint(other)) : e.side) : null)
  const sa = sideOf(a, b), sb = sideOf(b, a)

  let p1 = a.rect ? anchorPoint(a.rect, sa) : a.point
  let p2 = b.rect ? anchorPoint(b.rect, sb) : b.point
  // Straight lines aim at the center of auto-anchored shapes, like Whimsical
  if (route === "straight") {
    if (a.rect && a.side === "auto") p1 = boundaryPoint(a.item, b.rect && b.side === "auto" ? center(b.rect) : p2)
    if (b.rect && b.side === "auto") p2 = boundaryPoint(b.item, a.rect && a.side === "auto" ? center(a.rect) : p1)
  }
  const d1 = sa ? SIDES[sa] : freeDir(p1, p2)
  const d2 = sb ? SIDES[sb] : freeDir(p2, p1)

  const sw = style.strokeWidth || 2
  const insetStart = (CAP_INSET[style.startCap] || 0) * capSize(sw)
  const insetEnd = (CAP_INSET[style.endCap] || 0) * capSize(sw)

  let d, samples, startAngle, endAngle
  if (route === "curve") {
    const k = Math.max(40, dist(p1, p2) * 0.4)
    const c1 = add(p1, d1, k), c2 = add(p2, d2, k)
    samples = []
    for (let i = 0; i <= 32; i++) samples.push(bezierPoint(p1, c1, c2, p2, i / 32))
    const q1 = add(p1, norm(p1, c1), insetStart), q2 = add(p2, norm(p2, c2), insetEnd)
    d = `M${q1.x} ${q1.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${q2.x} ${q2.y}`
    startAngle = Math.atan2(p1.y - c1.y, p1.x - c1.x)
    endAngle = Math.atan2(p2.y - c2.y, p2.x - c2.x)
  } else {
    if (route === "straight") {
      samples = [p1, p2]
    } else {
      const zone = inflate(union([{ x: p1.x, y: p1.y, w: 0, h: 0 }, { x: p2.x, y: p2.y, w: 0, h: 0 }]), 60)
      const obs = obstacles.filter((r) => intersects(r, zone) && !containsPoint(r, p1) && !containsPoint(r, p2))
      samples = elbowPoints(p1, d1, a.rect, p2, d2, b.rect, obs)
    }
    const pts = shorten(shorten(samples, true, insetStart), false, insetEnd)
    d = route === "elbow" && style.rounded !== false
      ? roundedPolyline(pts, 10)
      : "M" + pts.map((p) => `${p.x} ${p.y}`).join("L")
    const n = samples.length
    startAngle = Math.atan2(samples[0].y - samples[1].y, samples[0].x - samples[1].x)
    endAngle = Math.atan2(samples[n - 1].y - samples[n - 2].y, samples[n - 1].x - samples[n - 2].x)
  }

  const xs = samples.map((p) => p.x), ys = samples.map((p) => p.y)
  const bounds = {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
  }
  return {
    d,
    hit: "M" + samples.map((p) => `${p.x} ${p.y}`).join("L"),
    samples,
    start: { p: p1, angle: startAngle },
    end: { p: p2, angle: endAngle },
    bounds,
  }
}

/** Point at relative length t (0..1) along a polyline. */
export function pointAt(samples, t) {
  const lens = []
  let total = 0
  for (let i = 1; i < samples.length; i++) {
    const l = dist(samples[i - 1], samples[i])
    lens.push(l)
    total += l
  }
  let target = Math.max(0, Math.min(1, t)) * total
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? target / lens[i] : 0
      const a = samples[i], b = samples[i + 1]
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
    target -= lens[i]
  }
  return samples[0]
}

/** Relative position (0..1) of the point of the polyline closest to p. */
export function nearestT(samples, p) {
  let total = 0, best = Infinity, bestAt = 0
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i]
    const l = dist(a, b)
    const k = l ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (l * l))) : 0
    const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    const dd = dist(p, q)
    if (dd < best) {
      best = dd
      bestAt = total + l * k
    }
    total += l
  }
  return total ? bestAt / total : 0.5
}

/** Path(s) drawing an arrow head / cardinality marker at `p`, oriented along `angle`. */
export function capShapes(kind, p, angle, sw) {
  if (!kind || kind === "none") return []
  const s = capSize(sw)
  const ux = Math.cos(angle), uy = Math.sin(angle)
  const at = (back, side) => `${p.x - ux * back - uy * side} ${p.y - uy * back + ux * side}`
  const circle = (back, r) => {
    const c = { x: p.x - ux * back, y: p.y - uy * back }
    return `M${c.x - r} ${c.y}A${r} ${r} 0 1 0 ${c.x + r} ${c.y}A${r} ${r} 0 1 0 ${c.x - r} ${c.y}Z`
  }
  const bar = (back) => `M${at(back, s * 0.55)}L${at(back, -s * 0.55)}`
  const crow = `M${at(s, 0)}L${at(0, s * 0.6)}M${at(s, 0)}L${at(0, -s * 0.6)}M${at(s, 0)}L${at(0, 0)}`
  switch (kind) {
    case "arrow": return [{ d: `M${at(0, 0)}L${at(s, s * 0.55)}L${at(s, -s * 0.55)}Z`, fill: true }]
    case "open": return [{ d: `M${at(s, s * 0.6)}L${at(0, 0)}L${at(s, -s * 0.6)}` }]
    case "circle": return [{ d: circle(s / 2, s / 2), fill: "bg" }]
    case "diamond": return [{ d: `M${at(0, 0)}L${at(s * 0.6, s * 0.45)}L${at(s * 1.2, 0)}L${at(s * 0.6, -s * 0.45)}Z`, fill: true }]
    case "bar": return [{ d: bar(s * 0.5) }]
    case "one": return [{ d: bar(s * 0.5) + bar(s * 0.9) }]
    case "many": return [{ d: crow }]
    case "one-many": return [{ d: crow + bar(s * 1.3) }]
    case "zero-many": return [{ d: crow }, { d: circle(s * 1.6, s * 0.38), fill: "bg" }]
    default: return []
  }
}
