// Text layout shared by the canvas rendering and the editing overlay, so that
// entering edit mode never makes the text jump.
import { FONTS, fontSizeOf } from "./defaults"
import { textInset } from "./geometry"
import { inkOf } from "./theme"

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" }

export function textBoxStyle(item) {
  const s = item.style || {}
  const inset = textInset(item)
  return {
    boxSizing: "border-box",
    width: `${item.w}px`,
    height: `${item.h}px`,
    padding: `${inset.t}px ${inset.r}px ${inset.b}px ${inset.l}px`,
    display: "flex",
    flexDirection: "column",
    justifyContent: JUSTIFY[s.valign] || (item.type === "text" ? "flex-start" : "center"),
    // Stickies shrink their text to fit, table cells cut it
    overflow: item.type === "sticky" || item.type === "cell" ? "hidden" : "visible",
  }
}

export function textContentStyle(item, fontScale = 1) {
  const s = item.style || {}
  return {
    fontFamily: FONTS[s.font] || FONTS.sans,
    fontSize: `${fontSizeOf(s) * fontScale}px`,
    lineHeight: 1.35,
    // Free texts (and shapes without fill) are drawn on the canvas, which may be dark
    color: inkOf(s.textColor || "#2e333d", item.source || item, item.type === "text" ? null : s.fill),
    textAlign: s.align || (item.type === "text" ? "left" : "center"),
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    outline: "none",
    minHeight: "1em",
    // Keeps its natural height in a fixed-size box (needed to measure the text of a table cell)
    flexShrink: 0,
    fontWeight: item.bold ? 700 : undefined,
  }
}

/** Height the text needs inside `item` (content height + insets). */
export function neededHeight(item, contentHeight) {
  const inset = textInset(item)
  return Math.ceil(contentHeight + inset.t + inset.b)
}
