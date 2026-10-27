<template>
  <div class="color-picker" @pointerdown.stop>
    <div v-if="sticky" class="row">
      <button v-for="c in STICKY_COLORS" :key="c" type="button" class="swatch" :class="{ active: same(c) }"
        :style="{ background: c }" :title="c" @click="emit('pick', c)"></button>
    </div>
    <template v-else>
      <div v-for="tone in tones" :key="tone" class="row">
        <button v-for="p in PALETTE" :key="p.name + tone" type="button" class="swatch" :class="{ active: same(p[tone]) }"
          :style="{ background: p[tone] }" :title="p.name" @click="emit('pick', p[tone])"></button>
      </div>
      <div class="row">
        <button v-for="c in NEUTRALS" :key="c" type="button" class="swatch" :class="{ active: same(c), none: c === 'transparent' }"
          :style="{ background: c === 'transparent' ? null : c }" :title="c === 'transparent' ? 'Aucune' : c" @click="emit('pick', c)"></button>
      </div>
    </template>
    <form class="hex" @submit.prevent="submitHex">
      <span :style="{ background: valid ? hex : 'transparent' }"></span>
      <input v-model="hex" maxlength="7" placeholder="#hex" aria-label="Couleur hexadécimale" @keydown.stop />
      <button type="submit" :disabled="!valid">OK</button>
    </form>
  </div>
</template>

<script setup>
import { computed, ref } from "vue"
import { NEUTRALS, PALETTE, STICKY_COLORS } from "../lib/defaults"

const props = defineProps({
  value: { type: String, default: "" },
  sticky: { type: Boolean, default: false },
  tones: { type: Array, default: () => ["light", "mid", "dark"] },
})
const emit = defineEmits(["pick"])

const hex = ref(props.value && props.value.startsWith("#") ? props.value : "")
const valid = computed(() => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex.value))
const same = (c) => c.toLowerCase() === (props.value || "").toLowerCase()

function submitHex() {
  if (valid.value) emit("pick", hex.value.toLowerCase())
}
</script>

<style scoped lang="scss">
.color-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
}

.row {
  display: flex;
  gap: 4px;
}

.swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;

  &.active {
    outline: 2px solid #5366ce;
    outline-offset: 1px;
  }

  &.none {
    background: linear-gradient(135deg, #fff 45%, #da3838 45%, #da3838 55%, #fff 55%);
  }
}

.hex {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;

  span {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #dbdee3;
  }

  input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 0.85em;
    padding: 4px 6px;
    border: 1px solid #dbdee3;
    border-radius: 6px;
  }

  button {
    font: inherit;
    font-size: 0.8em;
    padding: 4px 8px;
    border: 0;
    border-radius: 6px;
    background: #ecf1ff;
    color: #4554b2;
    cursor: pointer;
  }
}
</style>
