<template>
  <g :data-id="conn.id">
    <path :d="geom.hit" fill="none" stroke="transparent" :stroke-width="Math.max(12, 14 / zoom)" style="pointer-events: stroke" />
    <path :d="geom.d" fill="none" :stroke="style.stroke" :stroke-width="sw" stroke-linejoin="round"
      :stroke-linecap="style.strokeStyle === 'dotted' ? 'round' : 'butt'"
      :stroke-dasharray="dashArray(style.strokeStyle, sw)" style="pointer-events: none" />
    <path v-for="(cap, i) in caps" :key="i" :d="cap.d" :stroke="style.stroke" :stroke-width="sw"
      stroke-linejoin="round" stroke-linecap="round"
      :fill="cap.fill === 'bg' ? '#ffffff' : cap.fill ? style.stroke : 'none'" style="pointer-events: none" />
    <template v-for="(label, i) in conn.labels || []" :key="i">
      <text v-if="!(editingLabel === i)" :x="labelPoints[i].x" :y="labelPoints[i].y" text-anchor="middle"
        dominant-baseline="central" font-size="14" :font-family="FONTS.sans" :fill="style.textColor || '#2e333d'"
        stroke="#ffffff" stroke-width="6" stroke-linejoin="round" paint-order="stroke" :data-label="i"
        style="cursor: move">{{ label.text }}</text>
    </template>
  </g>
</template>

<script setup>
import { computed, toRaw } from "vue"
import { FONTS, dashArray } from "../lib/defaults"
import { capShapes, connectorGeometry, pointAt, rectOf } from "../lib/geometry"
import { useBoardStore } from "../store"

const props = defineProps({
  conn: { type: Object, required: true },
  zoom: { type: Number, default: 1 },
  editingLabel: { type: Number, default: null },
})

const store = useBoardStore()
const style = computed(() => props.conn.style || {})
const sw = computed(() => style.value.strokeWidth || 2)

// Objects the elbow routing tries to avoid. Read without reactivity on purpose:
// the route is recomputed when its own ends move, not whenever anything moves.
function obstacles() {
  const out = []
  const skip = new Set([props.conn.from?.id, props.conn.to?.id])
  for (const it of Object.values(toRaw(store.items))) {
    if (it.type === "connector" || it.type === "frame" || it.type === "text" || skip.has(it.id)) continue
    out.push(rectOf(it))
  }
  return out
}

const geom = computed(() => connectorGeometry(props.conn, store.items, style.value.route === "elbow" ? obstacles() : []))

const caps = computed(() => [
  ...capShapes(style.value.startCap, geom.value.start.p, geom.value.start.angle, sw.value),
  ...capShapes(style.value.endCap, geom.value.end.p, geom.value.end.angle, sw.value),
])

const labelPoints = computed(() => (props.conn.labels || []).map((l) => pointAt(geom.value.samples, l.t ?? 0.5)))

defineExpose({ geom })
</script>
