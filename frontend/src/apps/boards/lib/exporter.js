// Export of the board (or of a selection / frame) to SVG, PNG and PDF.
// The live SVG of the canvas is cloned so that the export matches the screen.

const PADDING = 24

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Standalone SVG string of the objects `ids` (all objects if null) within `bounds`.
 * Must be called while the canvas renders every object (store.exporting = true).
 */
export async function buildSvg(svgEl, bounds, { ids = null, background = "#ffffff" } = {}) {
  const clone = svgEl.cloneNode(true)
  clone.querySelectorAll(".ui").forEach((el) => el.remove())
  const world = clone.querySelector("[data-world]")
  if (ids) {
    const keep = new Set(ids)
    for (const el of [...world.children]) if (el.dataset.id && !keep.has(el.dataset.id)) el.remove()
  }
  // Images are inlined: an SVG rendered as an image cannot load external resources
  await Promise.all([...clone.querySelectorAll("image")].map(async (img) => {
    const href = img.getAttribute("href")
    if (!href || href.startsWith("data:")) return
    try {
      img.setAttribute("href", await toDataUrl(href))
    } catch {
      img.remove()
    }
  }))

  // Same for the input icons in the texts
  await Promise.all([...clone.querySelectorAll("img[data-input]")].map(async (img) => {
    try {
      img.setAttribute("src", await toDataUrl(img.getAttribute("src")))
    } catch {
      img.remove()
    }
  }))

  const w = Math.ceil(bounds.w + PADDING * 2), h = Math.ceil(bounds.h + PADDING * 2)
  world.setAttribute("transform", `translate(${PADDING - bounds.x} ${PADDING - bounds.y})`)
  clone.setAttribute("width", w)
  clone.setAttribute("height", h)
  clone.setAttribute("viewBox", `0 0 ${w} ${h}`)
  clone.removeAttribute("class")
  clone.removeAttribute("style")
  if (background) {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bg.setAttribute("width", "100%")
    bg.setAttribute("height", "100%")
    bg.setAttribute("fill", background)
    world.before(bg)
  }
  return { svg: new XMLSerializer().serializeToString(clone), width: w, height: h }
}

export async function svgToPngBlob({ svg, width, height }, scale = 2) {
  // A data: URL (not a blob: URL) keeps the canvas untainted despite the foreignObject texts
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext("2d")
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(resolve, "image/png")
    } catch (err) {
      reject(err)
    }
  })
}

export async function pngToPdfBlob(pngBlob, width, height) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: width >= height ? "landscape" : "portrait", unit: "px", format: [width, height], hotfixes: ["px_scaling"] })
  const data = new Uint8Array(await pngBlob.arrayBuffer())
  pdf.addImage(data, "PNG", 0, 0, width, height, undefined, "FAST")
  return pdf.output("blob")
}

export function download(blob, filename) {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function safeFilename(title) {
  return (title || "board").replace(/[\\/:*?"<>|]+/g, "-").trim().slice(0, 80) || "board"
}
