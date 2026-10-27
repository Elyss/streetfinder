<template>
  <!-- Sequence being built (or practiced) -->
  <section class="main">
    <div class="head">
      <div class="name-field">
        <input v-model="name" placeholder="Nom du combo" aria-label="Nom du combo" maxlength="100" :disabled="practicing" />
        <span v-if="editingId" class="badge">Enregistré</span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary" :disabled="!steps.length || practicing" @click="steps.pop()">Retirer le dernier</button>
        <button class="btn btn-secondary" :disabled="(!steps.length && !editingId) || practicing" @click="newCombo">Nouveau</button>
        <button class="btn btn-secondary" :disabled="!auth.isLoggedIn || !steps.length || !name.trim() || saving || practicing"
          :title="auth.isLoggedIn ? null : 'Connectez-vous pour enregistrer vos combos'" @click="save">
          {{ saving ? "Enregistrement…" : "Enregistrer" }}
        </button>
        <button v-if="!practicing" class="btn btn-primary" :disabled="!steps.length" @click="startPractice">Practice</button>
        <button v-else class="btn btn-primary" @click="practicing = false">Arrêter</button>
      </div>
    </div>
    <p v-if="message" class="message" :class="message.type">{{ message.text }}</p>

    <p v-if="!steps.length" class="hint">
      Ajoutez des inputs depuis la move list ou enregistrez-les à la manette, ci-dessous.
    </p>
    <ComboSteps v-else :steps="steps" :progress="practicing ? progress : null" :removable="!practicing" @remove="(i) => steps.splice(i, 1)" />
  </section>

  <ComboPractice v-if="practicing" :steps="practiceSteps" :pad="pad" @progress="progress = $event" />

  <!-- Adding inputs -->
  <section v-else class="main">
    <nav class="sources">
      <button :class="{ active: source === 'moves' }" @click="source = 'moves'">Depuis la move list</button>
      <button :class="{ active: source === 'pad' }" @click="source = 'pad'">Depuis la manette</button>
    </nav>

    <template v-if="source === 'moves'">
      <div class="filters">
        <input v-model="query" type="search" placeholder="Rechercher un coup ou un input" aria-label="Rechercher un coup" />
        <select v-model="category" aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <ul class="moves">
        <li v-for="move in filteredMoves" :key="move.order">
          <button :disabled="!move.steps.length" :title="move.steps.length ? 'Ajouter à la séquence' : 'Pas d\'input à ajouter'"
            @click="steps.push(...move.steps.map((s) => ({ ...s })))">
            <span class="move-name">{{ move.name }}</span>
            <span class="move-command">{{ move.command }}</span>
            <span class="add">+</span>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <p v-if="!pad.supported" class="hint">Ce navigateur ne gère pas l'API Gamepad.</p>
      <p v-else-if="!pad.selected.value" class="hint">
        Aucune manette détectée : branchez-la et appuyez sur un bouton, la page étant au premier plan.
      </p>
      <template v-else>
        <div class="record">
          <button class="btn" :class="recording ? 'btn-danger' : 'btn-primary'" @click="toggleRecording">
            {{ recording ? "Arrêter l'enregistrement" : "Enregistrer à la manette" }}
          </button>
          <label class="facing">
            Côté
            <select v-model="facing" :disabled="recording">
              <option value="right">Face à droite</option>
              <option value="left">Face à gauche</option>
            </select>
          </label>
          <span class="live">{{ pad.selected.value.id }} · <b>{{ pad.state.value.notation || "neutre" }}</b></span>
        </div>
        <p class="hint">
          Chaque pression de bouton ajoute une étape, avec les directions faites depuis l'étape précédente.
          Les boutons pressés ensemble (moins de 5 frames d'écart) forment une seule étape. Les coups reconnus
          sont nommés d'après la move list.
        </p>
      </template>
    </template>
  </section>

  <!-- Saved combos -->
  <section class="main">
    <h2>Mes combos</h2>
    <p v-if="!auth.isLoggedIn" class="hint">
      Vous pouvez construire et pratiquer un combo sans compte.
      <router-link :to="{ name: 'login', query: { next: route.fullPath } }">Connectez-vous</router-link>
      pour l'enregistrer et le retrouver ici et dans l'Input breaker.
    </p>
    <p v-else-if="!saved.length" class="hint">Aucun combo enregistré pour {{ character.name }}.</p>
    <ul v-else class="saved">
      <li v-for="combo in saved" :key="combo.id" :class="{ active: combo.id === editingId }">
        <div class="saved-info">
          <span class="saved-name">{{ combo.name }}</span>
          <span class="saved-steps">{{ combo.steps.map(formatStep).join("  ›  ") }}</span>
        </div>
        <div class="saved-actions">
          <button class="btn btn-secondary" :disabled="practicing" @click="load(combo)">Modifier</button>
          <button class="btn btn-primary" :disabled="practicing" @click="load(combo); startPractice()">Practice</button>
          <button class="btn btn-danger btn-soft" :disabled="practicing" @click="remove(combo)">Supprimer</button>
        </div>
      </li>
    </ul>
  </section>
</template>


<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute } from "vue-router"
import api from "@/api/axios"
import { useAuthStore } from "@/stores/auth"
import { CATEGORY_LABELS } from "@/utils/moves"
import { useGamepad } from "@/apps/inputbreaker/useGamepad"
import ComboPractice from "./ComboPractice.vue"
import ComboSteps from "./ComboSteps.vue"
import { findMove, formatStep, parseCommand, recordedMotion } from "./inputs"
import { useStepCapture } from "./useStepCapture"

const props = defineProps({
  character: { type: Object, required: true },
})

const route = useRoute()
const auth = useAuthStore()

const steps = ref([])
const name = ref("")
const editingId = ref(null)
const saved = ref([])
const saving = ref(false)
const message = ref(null)

const source = ref("moves")
const query = ref("")
const category = ref("")
const facing = ref("right")
const recording = ref(false)

const practicing = ref(false)
const practiceSteps = ref([])
const progress = ref({ index: 0, failedAt: null })

const pad = useGamepad()

// ------------------------------------------------------------------ move list

const movesWithSteps = computed(() => props.character.moves.map((m) => ({ ...m, steps: parseCommand(m.command, m.name) })))

const filteredMoves = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  return movesWithSteps.value.filter((m) => {
    if (category.value && m.category !== category.value) return false
    const text = `${m.name} ${m.command}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
})

// ------------------------------------------------------------------ recording

const capture = useStepCapture(pad, facing, {
  active: () => recording.value,
  onStep(g) {
    const step = { motion: recordedMotion(g.changes, g.held), buttons: g.buttons, label: "" }
    step.label = findMove(step, props.character.moves)?.name || ""
    steps.value.push(step)
  },
})

function toggleRecording() {
  recording.value = !recording.value
  capture.reset()
  message.value = null
}

// ------------------------------------------------------------------ practice

function startPractice() {
  if (!steps.value.length) return
  recording.value = false
  // A copy: the practice restarts only when a new practice starts
  practiceSteps.value = steps.value.map((s) => ({ ...s }))
  progress.value = { index: 0, failedAt: null }
  practicing.value = true
}

// ------------------------------------------------------------------ saved combos

async function loadSaved() {
  if (!auth.isLoggedIn) return
  try {
    const { data } = await api.get("/api/combos/", { params: { character: props.character.slug } })
    saved.value = data
  } catch {
    saved.value = []
  }
}

function load(combo) {
  editingId.value = combo.id
  name.value = combo.name
  steps.value = combo.steps.map((s) => ({ ...s }))
  message.value = null
}

function newCombo() {
  editingId.value = null
  name.value = ""
  steps.value = []
  message.value = null
}

async function save() {
  saving.value = true
  message.value = null
  const payload = { character: props.character.slug, name: name.value.trim(), steps: steps.value }
  try {
    const { data } = editingId.value
      ? await api.patch(`/api/combos/${editingId.value}/`, payload)
      : await api.post("/api/combos/", payload)
    editingId.value = data.id
    message.value = { type: "ok", text: `« ${data.name} » enregistré.` }
    await loadSaved()
  } catch (e) {
    const errors = e?.response?.data
    message.value = { type: "ko", text: errors ? Object.values(errors).flat().join(" ") : "L'enregistrement a échoué." }
  } finally {
    saving.value = false
  }
}

async function remove(combo) {
  if (!window.confirm(`Supprimer le combo « ${combo.name} » ?`)) return
  await api.delete(`/api/combos/${combo.id}/`)
  if (editingId.value === combo.id) editingId.value = null
  await loadSaved()
}

onMounted(loadSaved)
</script>

<style lang="scss" scoped>
.main {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);

  h2 {
    margin: 0;
    font-size: 1.3em;
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.name-field {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 220px;

  input {
    flex: 1;
    max-width: 360px;
    padding: 0.6rem 0.8rem;
    font: inherit;
    font-weight: 600;
  }
}

.badge {
  padding: 2px 8px;
  font-size: 0.75em;
  font-weight: 700;
  border-radius: var(--radius);
  background: var(--success-soft);
  color: var(--success);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.hint {
  margin: 0.75rem 0 0;
  color: var(--muted);
  line-height: 1.5;
}

.message {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);

  &.ok {
    background: var(--success-soft);
    color: var(--success);
  }

  &.ko {
    background: var(--danger-soft);
    color: var(--danger);
  }
}

.live {
  margin: 1rem 0 0;
  color: var(--muted);

  b {
    font-family: var(--font-condensed);
    font-size: 1.15em;
  }
}

.facing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9em;
  color: var(--muted);

  select {
    padding: 0.35rem 0.5rem;
    font: inherit;
  }
}

// ------------------------------------------------------------------ sources
.sources {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);

  button {
    padding: 0 0 0.6rem;
    margin-bottom: -1px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    font: inherit;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;

    &.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
  }
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  input {
    flex: 1;
    min-width: 200px;
    padding: 0.55rem 0.8rem;
    font: inherit;
  }

  select {
    padding: 0.55rem 0.6rem;
    font: inherit;
  }
}

.moves {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.4rem;
  max-height: 420px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  button {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: var(--accent);
    }

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  .move-name {
    font-weight: 600;
  }

  .move-command {
    grid-column: 1;
    font-size: 0.85em;
    color: var(--muted);
  }

  .add {
    grid-row: 1 / 3;
    grid-column: 2;
    align-self: center;
    font-size: 1.3em;
    font-weight: 700;
    color: var(--accent);
  }
}

.record {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

// ------------------------------------------------------------------ saved combos
.saved {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border-strong);

    &.active {
      border-left-color: var(--accent);
    }
  }
}

.saved-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.saved-name {
  font-weight: 700;
}

.saved-steps {
  font-family: var(--font-condensed);
  font-size: 1.05em;
  color: var(--muted);
}

.saved-actions {
  display: flex;
  gap: 0.4rem;

  .btn {
    padding: 0.45rem 0.9rem;
  }
}
</style>
