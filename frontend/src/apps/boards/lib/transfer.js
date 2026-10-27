// Quick export / import of a board as a text code to copy-paste:
// "SFB1." + base64url(deflate(JSON {title, background, items})).
import { boardsApi } from "./api"

const PREFIX = "SFB1."

async function pipe(bytes, transform) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(transform)).arrayBuffer())
}

function toBase64Url(bytes) {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function encodeBoard({ title, background, items }) {
  const json = new TextEncoder().encode(JSON.stringify({ title, background, items }))
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")))
}

export async function decodeBoard(code) {
  const text = code.replace(/\s+/g, "")
  if (!text.startsWith(PREFIX)) throw new Error("Ce code n'est pas un export de board.")
  let data
  try {
    const json = await pipe(fromBase64Url(text.slice(PREFIX.length)), new DecompressionStream("deflate-raw"))
    data = JSON.parse(new TextDecoder().decode(json))
  } catch {
    throw new Error("Code incomplet ou abîmé : vérifiez qu'il a été copié en entier.")
  }
  if (!Array.isArray(data?.items)) throw new Error("Ce code n'est pas un export de board.")
  return data
}

/** Export code of a saved board (with its latest content). */
export async function exportBoardCode(boardId) {
  const board = await boardsApi.get(boardId)
  return encodeBoard(board)
}

/** Creates a new board, owned by the current user, from an export code. */
export async function importBoardCode(code) {
  return boardsApi.import(await decodeBoard(code))
}
