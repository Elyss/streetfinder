import { computed, onMounted, onUnmounted, ref } from "vue"
import { readGamepad } from "./gamepad"

export const NEUTRAL = { direction: { numpad: 5, arrow: "N" }, pressed: [], notation: "" }

// Polls the connected gamepads every animation frame and exposes the state of the selected one.
// onFrame(fn) calls fn(state, now) at each poll, for components that need every sample.
export const useGamepad = () => {
  const supported = typeof navigator !== "undefined" && "getGamepads" in navigator

  const gamepads = ref([])
  const selectedIndex = ref(null)
  const state = ref(NEUTRAL)
  const selected = computed(() => gamepads.value.find((pad) => pad.index === selectedIndex.value))

  const listeners = new Set()
  const onFrame = (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  let frame = null

  const poll = () => {
    const pads = [...navigator.getGamepads()].filter(Boolean)
    gamepads.value = pads.map((pad) => ({
      index: pad.index,
      id: pad.id,
      mapping: pad.mapping,
      buttons: pad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
      axes: [...pad.axes],
    }))

    if (!pads.some((pad) => pad.index === selectedIndex.value)) {
      selectedIndex.value = pads[0]?.index ?? null
    }
    const pad = pads.find((p) => p.index === selectedIndex.value)
    if (pad) {
      state.value = readGamepad(pad)
      const now = performance.now()
      for (const fn of listeners) fn(state.value, now)
    } else {
      state.value = NEUTRAL
    }
    frame = requestAnimationFrame(poll)
  }

  onMounted(() => {
    if (supported) poll()
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
  })

  return { supported, gamepads, selectedIndex, selected, state, onFrame }
}
