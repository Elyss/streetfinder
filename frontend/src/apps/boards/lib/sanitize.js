// Rich text is HTML written by any visitor of the board (no accounts):
// it is always filtered against a whitelist before being rendered.
import { INPUT_ICONS, inputHtml, inputKey } from "./inputs"

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "CODE", "BR", "DIV", "P", "UL", "OL", "LI", "A"])
const DROPPED = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "SVG", "MATH", "HEAD", "TITLE", "META", "LINK"])

// Inline styles (not CSS classes) so that exported SVG/PNG render the same way
const INLINE_STYLES = {
  UL: "margin:0;padding-left:1.3em",
  OL: "margin:0;padding-left:1.5em",
  P: "margin:0",
  CODE: "font-family:ui-monospace,Consolas,monospace;font-size:.9em;background:rgba(0,0,0,.07);border-radius:3px;padding:0 .2em",
  A: "color:inherit;text-decoration:underline",
}

const cache = new Map()

function clean(src, dst, doc) {
  for (let node of src.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      dst.appendChild(doc.createTextNode(node.textContent))
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED.has(node.tagName)) continue

    let tag = node.tagName
    // Icon shown with its notation (rendering of the editor): only the icon is kept
    if (node.hasAttribute("data-input-chip")) {
      node = node.querySelector("img[data-input]")
      if (!node) continue
      tag = "IMG"
    }
    // SF6 input icons: rebuilt from their key, any other image is dropped
    if (tag === "IMG") {
      const key = node.getAttribute("data-input")
      if (inputKey(key)) {
        const tpl = doc.createElement("template")
        tpl.innerHTML = inputHtml(key, node.getAttribute("data-variant"))
        dst.appendChild(tpl.content.firstChild)
      }
      continue
    }
    if (!ALLOWED.has(tag)) {
      clean(node, dst, doc)
      continue
    }
    if (tag === "A") {
      const href = node.getAttribute("href") || ""
      if (!/^(https?:|mailto:|#)/i.test(href.trim())) {
        clean(node, dst, doc)
        continue
      }
    }
    const el = doc.createElement(tag)
    if (tag === "A") {
      el.setAttribute("href", node.getAttribute("href").trim())
      el.setAttribute("target", "_blank")
      el.setAttribute("rel", "noopener noreferrer")
    }
    if (INLINE_STYLES[tag]) el.setAttribute("style", INLINE_STYLES[tag])
    clean(node, el, doc)
    dst.appendChild(el)
  }
}

export function sanitize(html) {
  if (!html) return ""
  const hit = cache.get(html)
  if (hit !== undefined) return hit
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  const out = doc.createElement("div")
  clean(doc.body, out, doc)
  const result = out.innerHTML
  if (cache.size > 5000) cache.clear()
  cache.set(html, result)
  return result
}

export function plainText(html) {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<(br|\/div|\/p|\/li)>/gi, "$&\n")}</body>`, "text/html")
  // Input icons read as their notation (search, empty text detection)
  for (const chip of doc.body.querySelectorAll("[data-input-chip]")) chip.replaceWith(chip.querySelector("img") || "")
  for (const img of doc.body.querySelectorAll("img[data-input]")) img.replaceWith(INPUT_ICONS[inputKey(img.dataset.input)]?.alt || "")
  return doc.body.textContent || ""
}

export function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
}

const BLOCKS = new Set(["DIV", "P", "LI", "TR", "H1", "H2", "H3", "H4", "H5", "H6"])

/**
 * Pasted HTML reduced to its text, line breaks and input icons (rebuilt from their key):
 * external formatting is dropped, icons copied from a board survive.
 */
export function textWithIcons(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
  const out = []
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out.push(escapeHtml(child.textContent.replace(/\s+/g, " ")))
      } else if (child.nodeType === Node.ELEMENT_NODE && !DROPPED.has(child.tagName)) {
        const img = child.tagName === "IMG" ? child : child.hasAttribute("data-input-chip") ? child.querySelector("img[data-input]") : null
        if (img || child.hasAttribute("data-input-chip")) {
          if (img && inputKey(img.getAttribute("data-input"))) out.push(inputHtml(img.getAttribute("data-input"), img.getAttribute("data-variant")))
        } else if (child.tagName === "BR") {
          out.push("<br>")
        } else {
          walk(child)
          if (BLOCKS.has(child.tagName) && child.nextSibling) out.push("<br>")
        }
      }
    }
  }
  walk(doc.body)
  return out.join("")
}
