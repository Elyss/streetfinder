<template>
  <div class="minimap" @pointerdown.stop="onDown" @pointermove="onMove" @pointerup="dragging = false" aria-label="Minimap">
    <svg :width="W" :height="H" :viewBox="`${box.x} ${box.y} ${box.w} ${box.h}`" preserveAspectRatio="xMidYMid meet">
      <rect v-for="r in rects" :key="r.id" :x="r.x" :y="r.y" :width="r.w" :height="r.h" :fill="r.fill" :rx="r.frame ? 0 : 2"
        :stroke="r.frame ? '#c5cad3' : null" :stroke-width="r.frame ? box.w / W : null" />
      <rect :x="viewport.x" :y="viewport.y" :width="viewport.w" :height="viewport.h" fill="rgba(83,102,206,.08)"
        stroke="#5366ce" :stroke-width="(box.w / W) * 1.5" />
    </svg>
  </div>
</template>

<script setup>
import { computed, ref } from "vue"
import { union } from "../lib/geometry"
import { useBoardStore } from "../store"
import { frameFill } from "../lib/theme"

const props = defineProps({ viewport: { type: Object, required: true } })
const emit = defineEmits(["navigate"])

const store = useBoardStore()
const W = 200, H = 130
const dragging = ref(false)

const rects = computed(() => {
  const out = []
  for (const it of Object.values(store.items)) {
    if (it.type === "connector") continue
    const fill = it.type === "frame" ? frameFill(it.style?.fill) : it.type === "image" ? "#c5cad3" : it.type === "text" ? "#dbdee3" : it.style?.fill || "#c5cad3"
    out.push({ id: it.id, x: it.x, y: it.y, w: it.w, h: it.h, fill: fill === "transparent" ? "#dbdee3" : fill, frame: it.type === "frame" })
  }
  return out.sort((a, b) => b.frame - a.frame)
})

const box = computed(() => {
  const b = union([...rects.value, props.viewport]) || props.viewport
  const m = Math.max(b.w, b.h) * 0.05
  return { x: b.x - m, y: b.y - m, w: b.w + 2 * m, h: b.h + 2 * m }
})

function toWorld(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const scale = Math.max(box.value.w / W, box.value.h / H)
  const offX = (W - box.value.w / scale) / 2, offY = (H - box.value.h / scale) / 2
  return { x: box.value.x + (e.clientX - r.left - offX) * scale, y: box.value.y + (e.clientY - r.top - offY) * scale }
}

function onDown(e) {
  dragging.value = true
  e.currentTarget.setPointerCapture(e.pointerId)
  emit("navigate", toWorld(e))
}

function onMove(e) {
  if (dragging.value) emit("navigate", toWorld(e))
}
</script>

<style scoped>
.minimap {
  position: absolute;
  right: 12px;
  bottom: 64px;
  z-index: 8;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(27, 36, 51, 0.08);
  overflow: hidden;
  cursor: pointer;
  line-height: 0;
}

@media (max-width: 640px) {
  .minimap {
    display: none;
  }
}
</style>
