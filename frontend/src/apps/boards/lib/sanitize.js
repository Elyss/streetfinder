// Rich text is HTML written by any visitor of the board (no accounts):
// it is always filtered against a whitelist before being rendered.

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
  for (const node of src.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      dst.appendChild(doc.createTextNode(node.textContent))
      continue
    }
    if (node.nodeType !== Node.ELEMENT_NODE || DROPPED.has(node.tagName)) continue

    const tag = node.tagName
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
  return doc.body.textContent || ""
}

export function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
}
