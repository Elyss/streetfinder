<template>
  <section class="main">
    <h2>Exercice : Dragon Punch</h2>
    <p class="hint">
      Faites <b>→ ↓ ↘ + P</b> en boucle. Chaque pression de bouton compte comme une tentative, évaluée avec la
      tolérance de SF6&nbsp;: neutre toléré entre les directions, ↘ avant le ↓ accepté (→ ↘ ↓ ↘), fin sur → acceptée
      (→ ↓ ↘ →), raccourcis leverless → ↘ → et sa version SOCD (→ ↘ ↗), et le bouton doit suivre la fin de la motion
      dans la fenêtre de buffer.
    </p>

    <div class="verdict" :class="last ? (last.ok ? 'ok' : 'ko') : ''">
      <template v-if="last">
        <span class="label">{{ last.ok ? "DP !" : "Raté" }}</span>
        <span v-if="last.ok" class="variant">
          {{ last.variant === "shortcut" ? "Raccourci" : "Motion" }}
          {{ last.motion.map((d) => ARROWS[normalizeDirection(d, settings.facing)]).join(" ") }}
        </span>
        <span class="reason">{{ last.ok ? "" : last.reason }}</span>
        <span class="sequence">
          <span v-for="(d, i) in last.sequence" :key="i" class="dir" :class="{ key: [6, 2, 3, 9].includes(d) }">
            {{ ARROWS[normalizeDirection(d, settings.facing)] }}
          </span>
          <span class="dir button">+ {{ last.button }}</span>
        </span>
        <span v-if="last.motionFrames !== undefined" class="timing">
          motion {{ last.motionFrames }} f · bouton +{{ last.buttonFrames }} f
        </span>
      </template>
      <span v-else class="label waiting">En attente du premier DP…</span>
    </div>

    <dl class="stats">
      <div><dt>Tentatives</dt><dd>{{ stats.attempts }}</dd></div>
      <div><dt>Réussies</dt><dd>{{ stats.successes }}</dd></div>
      <div><dt>Taux</dt><dd>{{ stats.attempts ? Math.round((100 * stats.successes) / stats.attempts) : 0 }} %</dd></div>
      <div><dt>Série</dt><dd>{{ stats.streak }} <small>(max {{ stats.bestStreak }})</small></dd></div>
      <div><dt>Motion moyenne</dt><dd>{{ stats.successes ? (stats.motionTotal / stats.successes).toFixed(1) : "–" }} f</dd></div>
      <div><dt>Motion la plus rapide</dt><dd>{{ stats.bestMotion ?? "–" }} f</dd></div>
    </dl>

    <div class="actions">
      <button class="btn btn-secondary" :disabled="!stats.attempts" @click="reset">Remettre à zéro</button>
    </div>
  </section>

  <section class="main settings">
    <h2>Réglages</h2>
    <p class="hint">
      Capcom ne publie pas les fenêtres exactes de SF6&nbsp;: les valeurs par défaut sont des approximations, ajustez-les
      si le jeu accepte ou refuse vos DP différemment.
    </p>
    <div class="fields">
      <label>
        Fenêtre de motion (du premier → à la fin)
        <span class="value">{{ settings.motionFrames }} f</span>
        <input v-model.number="settings.motionFrames" type="range" min="3" max="20" />
      </label>
      <label>
        Buffer du bouton après la fin de la motion
        <span class="value">{{ settings.bufferFrames }} f</span>
        <input v-model.number="settings.bufferFrames" type="range" min="1" max="12" />
      </label>
      <label>
        Bouton
        <select v-model="settings.button">
          <option value="punch">Poing (LP, MP, HP)</option>
          <option value="kick">Pied (LK, MK, HK)</option>
          <option value="any">Les deux</option>
        </select>
      </label>
      <label>
        Côté
        <select v-model="settings.facing">
          <option value="right">Face à droite (→ ↓ ↘)</option>
          <option value="left">Face à gauche (← ↓ ↙)</option>
        </select>
      </label>
    </div>
  </section>

  <section class="main tips">
    <h2>Conseils leverless (Haute42)</h2>
    <ul>
      <li>Méthode classique&nbsp;: tapez →, relâchez, tapez ↓, puis ajoutez → en gardant ↓ (ce qui donne ↘) et appuyez sur P.</li>
      <li>Variante&nbsp;: gardez → appuyé, tapez ↓ (le jeu lit ↘), relâchez → (↓), rappuyez → (↘) + P. La séquence → ↘ ↓ ↘ est acceptée.</li>
      <li>Raccourci&nbsp;: gardez →, ajoutez ↓ (↘), relâchez ↓ (→) + P. Le jeu accepte → ↘ → sans passer par ↓ seul.</li>
      <li>Version SOCD&nbsp;: gardez →, ajoutez ↓ (↘), puis ajoutez ↑ sans relâcher ↓ + P. La manette résout ↑+↓ selon son réglage SOCD&nbsp;: en neutre on obtient → ↘ →, en priorité haut ou dernière entrée → ↘ ↗. Les deux sont acceptés.</li>
      <li>Le bouton doit venir juste après le ↘, pas avant. Si vous le pressez trop tôt, vous obtenez un coup accroupi.</li>
      <li>Si un → traîne avant un ↓ ↘ →, le jeu donne un DP à la place du Hadoken&nbsp;: la tolérance joue dans les deux sens.</li>
    </ul>
  </section>
</template>


<script setup>
import { onMounted, onUnmounted, reactive, ref } from "vue"
import { ARROWS, DEFAULT_SETTINGS, FRAME_MS, analyseDp, matchesButton, normalizeDirection } from "./dp"

const props = defineProps({
  pad: { type: Object, required: true },
})

const settings = reactive({ ...DEFAULT_SETTINGS })
const last = ref(null)
const stats = reactive({ attempts: 0, successes: 0, streak: 0, bestStreak: 0, motionTotal: 0, bestMotion: null })

const reset = () => {
  Object.assign(stats, { attempts: 0, successes: 0, streak: 0, bestStreak: 0, motionTotal: 0, bestMotion: null })
  last.value = null
}

// direction changes of the last second, normalized to facing right
// (normalizeDirection is its own inverse, the template uses it to show the real inputs)
let inputs = []
let lastDirection = null
let lastPressed = new Set()

const sample = (state, now) => {
  const numpad = normalizeDirection(state.direction.numpad, settings.facing)
  if (numpad !== lastDirection) {
    inputs.push({ numpad, t: now })
    lastDirection = numpad
  }
  inputs = inputs.filter((i) => now - i.t < 60 * FRAME_MS)

  const pressed = new Set(state.pressed.map((b) => b.index))
  const button = state.pressed.find((b) => !lastPressed.has(b.index) && b.attack && matchesButton(b, settings.button))
  lastPressed = pressed
  if (!button) return

  const verdict = analyseDp(inputs, now, settings)
  last.value = { ...verdict, button: button.attack }
  // each attempt consumes its directions: only the one still held carries over
  inputs = inputs.slice(-1)
  stats.attempts++
  if (verdict.ok) {
    stats.successes++
    stats.streak++
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak)
    stats.motionTotal += verdict.motionFrames
    stats.bestMotion = Math.min(stats.bestMotion ?? Infinity, verdict.motionFrames)
  } else {
    stats.streak = 0
  }
}

let unsubscribe = null
onMounted(() => {
  unsubscribe = props.pad.onFrame(sample)
})
onUnmounted(() => {
  unsubscribe?.()
})
</script>

<style lang="scss" scoped>
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

.hint {
  margin-block: 0.75rem 0;
  color: var(--muted);
}

.verdict {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 1.25rem;
  padding: 1.25rem 1.5rem;
  border-radius: var(--radius);
  background-color: var(--surface-2);
  border: 2px solid var(--border-strong);

  &.ok {
    background-color: var(--success-soft);
    border-color: var(--success);
  }

  &.ko {
    background-color: var(--danger-soft);
    border-color: var(--danger);
  }

  .label {
    font-size: 2em;
    font-weight: 700;
    color: var(--text);

    &.waiting {
      font-size: 1.2em;
      color: var(--muted);
    }
  }

  .variant {
    font-weight: 600;
    color: var(--success);
  }

  .reason {
    font-weight: 600;
    color: var(--danger);

    &:empty {
      display: none;
    }
  }

  .sequence {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }

  .dir {
    min-width: 1.8em;
    padding: 0.15rem 0.4rem;
    border-radius: 6px;
    background-color: var(--surface);
    border: 1px solid var(--border-strong);
    text-align: center;
    font-weight: 700;
    color: var(--muted);

    &.key {
      color: var(--accent);
      border-color: var(--accent-border);
    }

    &.button {
      color: var(--text);
    }
  }

  .timing {
    font-size: 0.9em;
    font-weight: 600;
    color: var(--muted);
  }
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0 0;

  div {
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background-color: var(--surface-2);
  }

  dt {
    font-size: 0.8em;
    font-weight: 600;
    color: var(--muted);
  }

  dd {
    margin: 0.2rem 0 0;
    font-size: 1.4em;
    font-weight: 700;
    color: var(--text);

    small {
      font-size: 0.6em;
      font-weight: 600;
      color: var(--muted);
    }
  }
}

.actions {
  margin-top: 1rem;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem 2rem;
  margin-top: 1rem;

  label {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-weight: 600;
    color: var(--text);
  }

  .value {
    font-weight: 700;
    color: var(--accent);
  }

  input[type="range"] {
    accent-color: var(--accent);
  }

  select {
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    font: inherit;
    color: inherit;
    background-color: var(--surface);
  }
}

.tips ul {
  margin: 0.75rem 0 0;
  padding-left: 1.2rem;

  li + li {
    margin-top: 0.4rem;
  }
}
</style>
