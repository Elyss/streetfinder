// Tables: a grid of cells inside the object box.
// Columns and rows are stored as proportions (colFr / rowFr), so resizing the object keeps the layout.
// cells[r][c] = { text (rich HTML), fill (background color or null) }
// merges = [{ r, c, rs, cs }]: merged areas; the top-left cell holds their text and color,
// the cells they cover keep their data but are not shown.

export const MIN_CELL = 16

export const emptyCell = () => ({ text: "", fill: null })

export function emptyCells(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell))
}

const sum = (list) => list.reduce((a, b) => a + b, 0)

/** Absolute sizes (world units) of the columns and rows. */
export function tableSizes(item) {
  const colTotal = sum(item.colFr), rowTotal = sum(item.rowFr)
  return {
    cols: item.colFr.map((f) => (f / colTotal) * item.w),
    rows: item.rowFr.map((f) => (f / rowTotal) * item.h),
  }
}

/** Offsets of the column / row starts, plus the total at the end. */
function offsets(sizes) {
  const out = [0]
  for (const s of sizes) out.push(out[out.length - 1] + s)
  return out
}

export function tableLayout(item) {
  const { cols, rows } = tableSizes(item)
  return { cols, rows, xs: offsets(cols), ys: offsets(rows) }
}

// ------------------------------------------------------------------ merged cells

const mergesOf = (item) => item.merges || []
const contains = (m, r, c) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs

/** Merged area containing cell (r, c), or null. */
export function mergeAt(item, r, c) {
  return mergesOf(item).find((m) => contains(m, r, c)) || null
}

/** The cell shown at (r, c): itself, or the top-left cell of its merged area. */
export function anchorOf(item, r, c) {
  const m = mergeAt(item, r, c)
  return m ? [m.r, m.c] : [r, c]
}

/** Cell hidden by a merged area (not its top-left cell). */
export function isCovered(item, r, c) {
  const m = mergeAt(item, r, c)
  return !!m && (m.r !== r || m.c !== c)
}

/** Box of the cell (r, c) in the table, merged area included: { x, y, w, h, rs, cs }. */
export function cellRect(item, r, c) {
  const { xs, ys } = tableLayout(item)
  const m = mergeAt(item, r, c) || { r, c, rs: 1, cs: 1 }
  return { x: xs[m.c], y: ys[m.r], w: xs[m.c + m.cs] - xs[m.c], h: ys[m.r + m.rs] - ys[m.r], r: m.r, c: m.c, rs: m.rs, cs: m.cs }
}

/** Cells to draw (top-left cells of merged areas, other cells as they are), with their box. */
export function visibleCells(item) {
  const out = []
  item.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!isCovered(item, r, c)) out.push({ r, c, cell, ...cellRect(item, r, c) })
  }))
  return out
}

/** Grid lines, without the ones inside merged areas (SVG path, table coordinates). */
export function gridPath(item) {
  const { xs, ys } = tableLayout(item)
  const merges = mergesOf(item)
  const inside = (r, c, r2, c2) => merges.some((m) => contains(m, r, c) && contains(m, r2, c2))
  const parts = []
  for (let i = 1; i < xs.length - 1; i++) {
    for (let r = 0; r < ys.length - 1; r++) if (!inside(r, i - 1, r, i)) parts.push(`M${xs[i]} ${ys[r]}V${ys[r + 1]}`)
  }
  for (let i = 1; i < ys.length - 1; i++) {
    for (let c = 0; c < xs.length - 1; c++) if (!inside(i - 1, c, i, c)) parts.push(`M${xs[c]} ${ys[i]}H${xs[c + 1]}`)
  }
  return parts.join("")
}

/** Cell under a point (world coordinates), or null outside the table. A merged area gives its top-left cell. */
export function cellAt(item, p) {
  const { xs, ys } = tableLayout(item)
  const x = p.x - item.x, y = p.y - item.y
  const c = xs.findIndex((v, i) => i < xs.length - 1 && x >= v && x <= xs[i + 1])
  const r = ys.findIndex((v, i) => i < ys.length - 1 && y >= v && y <= ys[i + 1])
  return c === -1 || r === -1 ? null : anchorOf(item, r, c)
}

/** Raw grid position under a point (no merge resolution), clamped to the table. */
export function gridAt(item, p) {
  const { xs, ys } = tableLayout(item)
  const find = (list, v) => Math.max(0, Math.min(list.length - 2, list.findIndex((s, i) => i === list.length - 2 || v < list[i + 1])))
  return [find(ys, p.y - item.y), find(xs, p.x - item.x)]
}

/** Range of cells (corners in any order) grown to fully include the merged areas it touches. */
export function cellRange(item, a, b) {
  let r0 = Math.min(a[0], b[0]), r1 = Math.max(a[0], b[0])
  let c0 = Math.min(a[1], b[1]), c1 = Math.max(a[1], b[1])
  for (let changed = true; changed;) {
    changed = false
    for (const m of mergesOf(item)) {
      const touches = m.r <= r1 && m.r + m.rs - 1 >= r0 && m.c <= c1 && m.c + m.cs - 1 >= c0
      if (!touches) continue
      const nr0 = Math.min(r0, m.r), nr1 = Math.max(r1, m.r + m.rs - 1)
      const nc0 = Math.min(c0, m.c), nc1 = Math.max(c1, m.c + m.cs - 1)
      if (nr0 !== r0 || nr1 !== r1 || nc0 !== c0 || nc1 !== c1) {
        [r0, r1, c0, c1] = [nr0, nr1, nc0, nc1]
        changed = true
      }
    }
  }
  return { r: r0, c: c0, rs: r1 - r0 + 1, cs: c1 - c0 + 1 }
}

/**
 * A cell seen as a small text object, for the shared text layout (lib/text.js).
 * The header row (first row, if enabled) is bold.
 */
export function cellBox(item, r, c) {
  const box = cellRect(item, r, c)
  const s = item.style || {}
  return {
    type: "cell",
    x: item.x + box.x,
    y: item.y + box.y,
    w: box.w,
    h: box.h,
    bold: !!s.header && box.r === 0,
    source: item,
    style: { ...s, fill: cellFill(item, box.r, box.c) || s.fill, align: s.align || "left", valign: s.valign || "middle" },
  }
}

export function cellFill(item, r, c) {
  const cell = item.cells[r]?.[c]
  if (cell?.fill) return cell.fill
  const s = item.style || {}
  return s.header && r === 0 ? s.headerFill || null : null
}

const cloneCells = (cells) => cells.map((row) => row.map((cell) => ({ ...cell })))
const cloneMerges = (item) => mergesOf(item).map((m) => ({ ...m }))
// Single cells are not merges
const cleanMerges = (merges) => merges.filter((m) => m.rs > 0 && m.cs > 0 && m.rs * m.cs > 1)

/** Patch merging the cells of a range: the texts are joined into the top-left cell. */
export function mergeCells(item, a, b) {
  const area = cellRange(item, a, b)
  if (area.rs * area.cs < 2) return null
  const cells = cloneCells(item.cells)
  const texts = []
  for (let r = area.r; r < area.r + area.rs; r++) {
    for (let c = area.c; c < area.c + area.cs; c++) {
      if (cells[r][c].text && !isCovered(item, r, c)) texts.push(cells[r][c].text)
      if (r !== area.r || c !== area.c) cells[r][c] = emptyCell()
    }
  }
  cells[area.r][area.c].text = texts.join("<br>")
  const merges = cloneMerges(item).filter((m) => !(m.r >= area.r && m.r + m.rs <= area.r + area.rs && m.c >= area.c && m.c + m.cs <= area.c + area.cs))
  merges.push(area)
  return { cells, merges }
}

/** Patch splitting the merged area containing (r, c). */
export function splitCell(item, r, c) {
  const m = mergeAt(item, r, c)
  return m ? { merges: mergesOf(item).filter((x) => x !== m).map((x) => ({ ...x })) } : null
}

// Each edit returns the patch to apply to the item. A new row / column takes the
// average size, and the object grows so that the others keep theirs.
// Merged areas follow: a line inserted inside one widens it, a removed line narrows it.

const K = { row: ["r", "rs"], col: ["c", "cs"] }

function mergesAfterInsert(item, axis, at) {
  const [p, s] = K[axis]
  return cloneMerges(item).map((m) => {
    if (m[p] >= at) m[p]++
    else if (m[p] + m[s] > at) m[s]++
    return m
  })
}

function mergesAfterRemove(item, axis, at) {
  const [p, s] = K[axis]
  return cleanMerges(cloneMerges(item).map((m) => {
    if (m[p] > at) m[p]--
    else if (m[p] + m[s] > at) m[s]--
    return m
  }))
}

// Removing the first line of a merged area: its text and color go to the next one
function keepAnchors(item, cells, axis, at) {
  for (const m of mergesOf(item)) {
    const [p, s] = K[axis]
    if (m[p] !== at || m[s] < 2) continue
    const [r, c] = axis === "row" ? [m.r + 1, m.c] : [m.r, m.c + 1]
    cells[r][c] = { ...cells[m.r][m.c] }
  }
}

export function insertRow(item, at) {
  const { rows } = tableSizes(item)
  const size = item.h / rows.length
  const cells = cloneCells(item.cells)
  cells.splice(at, 0, Array.from({ length: item.colFr.length }, emptyCell))
  const rowFr = [...rows]
  rowFr.splice(at, 0, size)
  return { cells, rowFr, h: item.h + size, merges: mergesAfterInsert(item, "row", at) }
}

export function insertCol(item, at) {
  const { cols } = tableSizes(item)
  const size = item.w / cols.length
  const cells = cloneCells(item.cells).map((row) => {
    row.splice(at, 0, emptyCell())
    return row
  })
  const colFr = [...cols]
  colFr.splice(at, 0, size)
  return { cells, colFr, w: item.w + size, merges: mergesAfterInsert(item, "col", at) }
}

export function removeRow(item, at) {
  if (item.rowFr.length <= 1) return null
  const { rows } = tableSizes(item)
  const cells = cloneCells(item.cells)
  keepAnchors(item, cells, "row", at)
  cells.splice(at, 1)
  const rowFr = [...rows]
  const [size] = rowFr.splice(at, 1)
  return { cells, rowFr, h: Math.max(MIN_CELL, item.h - size), merges: mergesAfterRemove(item, "row", at) }
}

export function removeCol(item, at) {
  if (item.colFr.length <= 1) return null
  const { cols } = tableSizes(item)
  const cells = cloneCells(item.cells)
  keepAnchors(item, cells, "col", at)
  cells.forEach((row) => row.splice(at, 1))
  const colFr = [...cols]
  const [size] = colFr.splice(at, 1)
  return { cells, colFr, w: Math.max(MIN_CELL, item.w - size), merges: mergesAfterRemove(item, "col", at) }
}

/** Patch setting the text of one cell. */
export function setCellText(item, r, c, text) {
  const cells = cloneCells(item.cells)
  cells[r][c].text = text
  return { cells }
}

/** Patch setting the background of one cell (null: back to the table color). */
export function setCellFill(item, r, c, fill) {
  const cells = cloneCells(item.cells)
  cells[r][c].fill = fill
  return { cells }
}

/** Patch giving the cell (r, c) at least `height` (its last row grows), the object growing accordingly. */
export function growCell(item, r, c, height) {
  const box = cellRect(item, r, c)
  if (box.h >= height) return null
  const { rows } = tableSizes(item)
  const rowFr = [...rows]
  rowFr[box.r + box.rs - 1] += height - box.h
  return { rowFr, h: sum(rowFr) }
}

/**
 * Patch moving the border after column / row `index` to `pos` (offset in the table),
 * keeping both neighbours at least MIN_CELL wide.
 */
export function moveBorder(item, axis, index, pos) {
  const { cols, rows } = tableSizes(item)
  const sizes = axis === "col" ? [...cols] : [...rows]
  const start = sum(sizes.slice(0, index))
  const pair = sizes[index] + sizes[index + 1]
  const a = Math.max(MIN_CELL, Math.min(pair - MIN_CELL, pos - start))
  sizes[index] = a
  sizes[index + 1] = pair - a
  return axis === "col" ? { colFr: sizes } : { rowFr: sizes }
}

/**
 * Patch moving column / row `from` to position `to` (its content, color and size go with it).
 * A merged area whose lines are no longer side by side is split.
 */
export function moveLine(item, axis, from, to) {
  const count = axis === "col" ? item.colFr.length : item.rowFr.length
  if (from === to || to < 0 || to >= count) return null
  const move = (list) => {
    const out = [...list]
    out.splice(to, 0, ...out.splice(from, 1))
    return out
  }
  // New position of each old line
  const order = move([...Array(count).keys()])
  const position = order.reduce((acc, old, i) => ((acc[old] = i), acc), [])
  const cells = cloneCells(item.cells)
  const patch = axis === "col"
    ? { cells: cells.map(move), colFr: move(item.colFr) }
    : { cells: move(cells), rowFr: move(item.rowFr) }
  const [p, s] = K[axis]
  patch.merges = []
  for (const m of mergesOf(item)) {
    const lines = Array.from({ length: m[s] }, (_, i) => position[m[p] + i])
    const start = Math.min(...lines)
    if (Math.max(...lines) - start !== m[s] - 1) continue
    // The top-left cell keeps the content of the area
    const [ar, ac] = axis === "row" ? [position[m.r], m.c] : [m.r, position[m.c]]
    const [nr, nc] = axis === "row" ? [start, m.c] : [m.r, start]
    if (ar !== nr || ac !== nc) {
      const anchor = patch.cells[ar][ac]
      patch.cells[ar][ac] = patch.cells[nr][nc]
      patch.cells[nr][nc] = anchor
    }
    patch.merges.push({ ...m, [p]: start })
  }
  return patch
}

/** Insertion position (0..count) of a column / row dragged to `pos` (offset in the table). */
export function dropIndex(item, axis, pos) {
  const { xs, ys, cols, rows } = tableLayout(item)
  const starts = axis === "col" ? xs : ys
  const sizes = axis === "col" ? cols : rows
  return sizes.filter((size, i) => starts[i] + size / 2 < pos).length
}
