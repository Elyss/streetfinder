<template>
  <g :data-id="conn.id">
    <path :d="geom.hit" fill="none" stroke="transparent" :stroke-width="Math.max(12, 14 / zoom)" style="pointer-events: stroke" />
    <path :d="geom.d" fill="none" :stroke="stroke" :stroke-width="sw" stroke-linejoin="round"
      :stroke-linecap="style.strokeStyle === 'dotted' ? 'round' : 'butt'"
      :stroke-dasharray="dashArray(style.strokeStyle, sw)" style="pointer-events: none" />
    <path v-for="(cap, i) in caps" :key="i" :d="cap.d" :stroke="stroke" :stroke-width="sw"
      stroke-linejoin="round" stroke-linecap="round"
      :fill="cap.fill === 'bg' ? halo : cap.fill ? stroke : 'none'" style="pointer-events: none" />
    <template v-for="(label, i) in conn.labels || []" :key="i">
      <text v-if="!(editingLabel === i)" :x="labelPoints[i].x" :y="labelPoints[i].y" text-anchor="middle"
        dominant-baseline="central" font-size="14" :font-family="FONTS.sans" :fill="inkOf(style.textColor || '#2e333d', host, null)"
        :stroke="halo" stroke-width="6" stroke-linejoin="round" paint-order="stroke" :data-label="i"
        style="cursor: move">{{ label.text }}</text>
    </template>
  </g>
</template>

<script setup>
import { computed } from "vue"
import { FONTS, dashArray } from "../lib/defaults"
import { capShapes, pointAt } from "../lib/geometry"
import { useBoardStore } from "../store"
import { backdropOf, canvasColor, inkOf } from "../lib/theme"

const props = defineProps({
  conn: { type: Object, required: true },
  zoom: { type: Number, default: 1 },
  editingLabel: { type: Number, default: null },
})

const store = useBoardStore()
const style = computed(() => props.conn.style || {})
// A connector lies in the frame of its two ends, if they share one
const host = computed(() => {
  const a = store.items[props.conn.from?.id], b = store.items[props.conn.to?.id]
  return a?.parent && a.parent === b?.parent ? { parent: a.parent } : null
})
const stroke = computed(() => inkOf(style.value.stroke, host.value, null))
const halo = computed(() => backdropOf(host.value) || canvasColor())
const sw = computed(() => style.value.strokeWidth || 2)

const geom = computed(() => store.routeOf(props.conn))

const caps = computed(() => [
  ...capShapes(style.value.startCap, geom.value.start.p, geom.value.start.angle, sw.value),
  ...capShapes(style.value.endCap, geom.value.end.p, geom.value.end.angle, sw.value),
])

const labelPoints = computed(() => (props.conn.labels || []).map((l) => pointAt(geom.value.samples, l.t ?? 0.5)))

defineExpose({ geom })
</script>
