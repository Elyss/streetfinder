<template>
  <Header />

  <div class="container">
    <h1>Input breaker</h1>
    <p class="subtitle">Branchez une manette (Haute42, pad…) et appuyez sur un bouton pour qu'elle apparaisse.</p>

    <section class="main">
      <h2>Manettes détectées</h2>
      <p v-if="!supported" class="hint">Ce navigateur ne gère pas l'API Gamepad.</p>
      <p v-else-if="!gamepads.length" class="hint">
        Aucune manette détectée. Le navigateur ne la signale qu'après une première pression de bouton, la page devant
        être au premier plan.
      </p>
      <div v-else class="pads">
        <button
          v-for="pad in gamepads"
          :key="pad.index"
          class="pad"
          :class="{ active: pad.index === selectedIndex }"
          @click="selectedIndex = pad.index"
        >
          <span class="name">{{ pad.id }}</span>
          <span class="meta">
            #{{ pad.index }} · mapping {{ pad.mapping || "inconnu" }} · {{ pad.buttons.length }} boutons ·
            {{ pad.axes.length }} axes
          </span>
        </button>
      </div>
    </section>

    <template v-if="selected">
      <nav class="tabs">
        <router-link
          v-for="tab in TABS"
          :key="tab.key"
          :to="{ name: 'input-breaker', params: { tab: tab.param } }"
          class="tab"
          :class="{ active: tab.key === activeTab, locked: tab.account && !auth.isLoggedIn }"
          :title="tab.account && !auth.isLoggedIn ? 'Connectez-vous pour retrouver vos combos' : null"
        >
          {{ tab.label }}
        </router-link>
      </nav>

      <DpDrill v-if="activeTab === 'dp'" :pad="pad" />
      <template v-else-if="activeTab === 'combos'">
        <MyCombos v-if="auth.isLoggedIn" :pad="pad" />
        <section v-else class="main">
          <h2>Mes combos</h2>
          <p class="hint">
            Les combos se construisent dans l'onglet « Combo builder » d'un personnage, et s'enregistrent sur votre compte.
            <router-link :to="{ name: 'login', query: { next: route.fullPath } }">Connectez-vous</router-link> pour les
            retrouver ici.
          </p>
        </section>
      </template>

      <template v-else>
      <section class="main">
        <div class="now">
          <h2>Input en cours</h2>
          <span class="notation">{{ state.notation || "—" }}</span>
          <span class="numpad">direction {{ state.direction.numpad }}</span>
        </div>

        <div class="layout">
          <div class="cluster directions">
            <span class="btn-circle" :class="{ on: isPressed(14) }">←</span>
            <span class="btn-circle" :class="{ on: isPressed(13) }">↓</span>
            <span class="btn-circle" :class="{ on: isPressed(15) }">→</span>
            <span class="btn-circle big" :class="{ on: isPressed(12) }">↑</span>
          </div>
          <div class="cluster attacks">
            <span v-for="index in [2, 3, 5, 4, 0, 1, 7, 6]" :key="index" class="btn-circle" :class="{ on: isPressed(index) }">
              <span class="attack">{{ attackLabel(index) }}</span>
              <span class="pad-label">{{ BUTTONS[index].label }}</span>
            </span>
          </div>
          <div class="cluster system">
            <span v-for="index in [8, 9, 16, 10, 11]" :key="index" class="btn-circle small" :class="{ on: isPressed(index) }">
              {{ BUTTONS[index].label }}
            </span>
          </div>
        </div>
      </section>

      <section class="main">
        <div class="history-header">
          <h2>Historique</h2>
          <button class="btn btn-secondary" :disabled="!history.length" @click="clearHistory">Effacer</button>
        </div>
        <p v-if="!history.length" class="hint">
          Les inputs apparaîtront ici, le plus récent en haut, avec leur durée en frames (60 Hz).
        </p>
        <ol v-else class="history">
          <li v-for="entry in history" :key="entry.id" :class="{ neutral: !entry.notation }">
            <span class="notation">{{ entry.notation || "neutre" }}</span>
            <span class="frames">{{ entry.frames }} f</span>
          </li>
        </ol>
      </section>

      <details class="main raw">
        <summary>Valeurs brutes</summary>
        <div class="raw-grid">
          <span v-for="(button, index) in selected.buttons" :key="'b' + index" class="raw-value" :class="{ on: button.pressed }">
            B{{ index }}<small>{{ button.value.toFixed(2) }}</small>
          </span>
          <span v-for="(axis, index) in selected.axes" :key="'a' + index" class="raw-value axis">
            A{{ index }}<small>{{ axis.toFixed(2) }}</small>
          </span>
        </div>
      </details>
      </template>
    </template>
  </div>
</template>


<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { useRoute } from "vue-router"
import Header from "@/apps/Header.vue"
import DpDrill from "./DpDrill.vue"
import MyCombos from "./MyCombos.vue"
import { BUTTONS } from "./gamepad"
import { FRAME_MS } from "./dp"
import { useGamepad } from "./useGamepad"
import { useAuthStore } from "@/stores/auth"

const HISTORY_SIZE = 40

const TABS = [
  { key: "viewer", label: "Visualiseur", param: "" },
  { key: "dp", label: "Exercice DP", param: "dp" },
  { key: "combos", label: "Mes combos", param: "combos", account: true },
]

const route = useRoute()
const auth = useAuthStore()
const activeTab = computed(() => (["dp", "combos"].includes(route.params.tab) ? route.params.tab : "viewer"))

const pad = useGamepad()
const { supported, gamepads, selectedIndex, selected, state } = pad
const history = ref([])

const isPressed = (index) => selected.value?.buttons[index]?.pressed ?? false
const attackLabel = (index) => BUTTONS[index].attack || BUTTONS[index].label.split(" / ")[0]

let current = null // the history entry still being held
let entryId = 0

const clearHistory = () => {
  history.value = []
  current = null
}

const record = (notation, now) => {
  if (current && current.notation === notation) {
    current.frames = Math.max(1, Math.round((now - current.since) / FRAME_MS))
    return
  }
  // neutral only matters as a gap between inputs
  if (!notation && !history.value.length) return
  current = { id: entryId++, notation, since: now, frames: 1 }
  history.value.unshift(current)
  history.value.length = Math.min(history.value.length, HISTORY_SIZE)
}

// a new pad starts a new entry
watch(selectedIndex, () => {
  current = null
})

let unsubscribe = null
onMounted(() => {
  unsubscribe = pad.onFrame((padState, now) => record(padState.notation, now))
})
onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style lang="scss" scoped>
.container {
  max-width: 1200px;
  margin: auto;
  margin-block: 2rem;
  padding-inline: 1rem;
}

h1 {
  margin-block: 0 0.5rem;
}

.subtitle {
  margin-block: 0 1.5rem;
}

.main {
  box-sizing: border-box;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background-color: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  width: 100%;

  h2 {
    margin: 0;
    font-size: 1.3em;
  }
}

.tabs {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border);
}

// Feature that needs an account: greyed, leads to the login page
.locked {
  opacity: 0.45;

  &:hover {
    opacity: 0.75;
  }
}

.tab {
  padding-bottom: 0.7rem;
  margin-bottom: -1px;
  border-bottom: 3px solid transparent;

  &:hover {
    text-decoration: none;
  }

  &.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
}

.hint {
  margin-block: 0.75rem 0;
  color: var(--muted);
}

.pads {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pad {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.75rem 1rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &.active {
    background-color: var(--accent-soft);
    border-color: var(--accent);
  }

  .name {
    font-weight: 700;
    color: var(--text);
  }

  .meta {
    font-size: 0.85em;
    color: var(--muted);
  }
}

.now {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 1rem;

  .notation {
    min-height: 1.2em;
    font-size: 2em;
    font-weight: 700;
    color: var(--accent);
  }

  .numpad {
    color: var(--muted);
    font-weight: 600;
  }
}

.layout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2.5rem;
  margin-top: 1.5rem;
}

.cluster {
  display: grid;
  gap: 0.6rem;
}

.directions {
  grid-template-columns: repeat(3, 56px);
  justify-items: center;

  .big {
    grid-column: 2;
    width: 72px;
    height: 72px;
  }
}

.attacks {
  grid-template-columns: repeat(4, 56px);
}

.system {
  grid-template-columns: repeat(3, 44px);
}

.btn-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: var(--surface-2);
  border: 2px solid var(--border-strong);
  font-weight: 700;
  color: var(--muted);
  transition: background-color 0.05s ease, border-color 0.05s ease;

  &.small {
    width: 44px;
    height: 44px;
    font-size: 0.65em;
  }

  &.on {
    background-color: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);

    .pad-label {
      color: rgba(0, 0, 0, 0.55);
    }
  }

  .attack {
    font-size: 0.95em;
  }

  .pad-label {
    font-size: 0.6em;
    font-weight: 600;
    color: var(--muted);
  }
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.history {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 360px;
  margin: 1rem 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  li {
    display: flex;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    background-color: var(--surface-2);
    border-radius: 8px;
    font-weight: 700;
    color: var(--text);

    &.neutral {
      font-weight: 500;
      color: var(--muted);
    }

    .frames {
      font-variant-numeric: tabular-nums;
      color: var(--muted);
    }
  }
}

.raw summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--text);
}

.raw-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 1rem;
}

.raw-value {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 52px;
  padding: 0.3rem 0.4rem;
  border-radius: 6px;
  background-color: var(--surface-2);
  font-size: 0.8em;
  font-weight: 700;
  color: var(--muted);

  small {
    font-weight: 500;
  }

  &.on {
    background-color: var(--accent);
    color: var(--on-accent);
  }

  &.axis {
    background-color: var(--warning-soft);
  }
}
</style>
