<template>
  <nav class="toolbar" aria-label="Outils">
    <button v-for="t in tools" :key="t.key" type="button" :class="{ active: store.tool === t.key }"
      :title="`${t.label} (${t.shortcut})`" :aria-label="t.label" :aria-pressed="store.tool === t.key" @click="pick(t.key)">
      <Icon :name="t.icon" :size="20" />
    </button>
    <template v-if="!readOnly">
    <span class="sep"></span>
    <button type="button" title="Annuler (Ctrl+Z)" aria-label="Annuler" :disabled="!store.canUndo" @click="store.undo()">
      <Icon name="undo" :size="20" />
    </button>
    <button type="button" title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir" :disabled="!store.canRedo" @click="store.redo()">
      <Icon name="redo" :size="20" />
    </button>
    </template>
    <span class="sep"></span>
    <button type="button" title="Raccourcis clavier (?)" aria-label="Raccourcis clavier" @click="emit('help')">
      <Icon name="help" :size="20" />
    </button>

    <div v-if="shapesOpen" class="flyout" @pointerdown.stop>
      <p>Formes</p>
      <div class="grid">
        <button v-for="s in SHAPES" :key="s.key" type="button" :title="s.label" :class="{ active: store.shapeKind === s.key }" @click="pickShape(s.key)">
          <svg viewBox="-2 -2 36 28" width="34" height="26"><path :d="shapePath(s.key, 32, 24).d" fill="#ecf1ff" stroke="#4554b2" stroke-width="1.5" /></svg>
        </button>
      </div>
      <p>Flowchart</p>
      <div class="grid">
        <button v-for="s in FLOWCHART_SHAPES" :key="s.key + 'f'" type="button" :title="s.label" :class="{ active: store.shapeKind === s.key }" @click="pickShape(s.key)">
          <svg viewBox="-2 -2 36 28" width="34" height="26">
            <path :d="shapePath(s.key, 32, 24).d" fill="#e1f5e9" stroke="#27905c" stroke-width="1.5" />
            <path v-if="shapePath(s.key, 32, 24).decor" :d="shapePath(s.key, 32, 24).decor" fill="none" stroke="#27905c" stroke-width="1.5" />
          </svg>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, ref } from "vue"
import Icon from "@/components/Icon.vue"
import { FLOWCHART_SHAPES, SHAPES } from "../lib/defaults"
import { shapePath } from "../lib/geometry"
import { useBoardStore } from "../store"

const props = defineProps({ readOnly: { type: Boolean, default: false } })
const emit = defineEmits(["image", "help"])
const store = useBoardStore()
const shapesOpen = ref(false)

const TOOLS = [
  { key: "select", label: "Sélection", icon: "select", shortcut: "V" },
  { key: "hand", label: "Main", icon: "hand", shortcut: "H" },
  { key: "shape", label: "Formes", icon: "shape", shortcut: "R" },
  { key: "sticky", label: "Sticky note", icon: "sticky", shortcut: "S" },
  { key: "text", label: "Texte", icon: "text", shortcut: "T" },
  { key: "connector", label: "Connecteur", icon: "connector", shortcut: "L" },
  { key: "frame", label: "Cadre", icon: "frame", shortcut: "F" },
  { key: "table", label: "Tableau", icon: "table", shortcut: "G" },
  { key: "image", label: "Image", icon: "image", shortcut: "I" },
]

// Readers only navigate
const tools = computed(() => (props.readOnly ? TOOLS.filter((t) => ["select", "hand"].includes(t.key)) : TOOLS))

function pick(key) {
  if (key === "image") {
    emit("image")
    return
  }
  shapesOpen.value = key === "shape" && !shapesOpen.value
  store.tool = key
}

function pickShape(key) {
  store.shapeKind = key
  store.tool = "shape"
  shapesOpen.value = false
}

defineExpose({ closeFlyout: () => (shapesOpen.value = false) })
</script>

<style scoped lang="scss">
.toolbar {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(27, 36, 51, 0.08);

  > button {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: none;
    color: var(--text);
    cursor: pointer;

    &:hover:not(:disabled) {
      background: var(--surface-2);
    }

    &.active {
      background: var(--accent-soft);
      color: var(--accent-hover);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }
}

.sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}

.flyout {
  position: absolute;
  left: calc(100% + 8px);
  top: 60px;
  width: 196px;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(27, 36, 51, 0.14);

  p {
    margin: 4px 4px 6px;
    font-size: 0.72em;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 6px;
  }

  button {
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    padding: 4px 0;
    cursor: pointer;

    &:hover,
    &.active {
      background: var(--bg-2);
      border-color: var(--accent-border);
    }
  }
}

@media (max-width: 640px) {
  .toolbar {
    top: auto;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    flex-direction: row;
    max-width: calc(100vw - 24px);
    overflow-x: auto;
  }

  .sep {
    width: 1px;
    height: auto;
    margin: 6px 4px;
  }

  .flyout {
    left: 0;
    top: auto;
    bottom: calc(100% + 8px);
  }
}
</style>
