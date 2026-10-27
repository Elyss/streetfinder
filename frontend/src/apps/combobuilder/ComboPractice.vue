<template>
  <section class="main practice">
    <div class="practice-head">
      <h2>{{ title }}</h2>
      <label class="facing">
        Côté
        <select v-model="facing">
          <option value="right">Face à droite</option>
          <option value="left">Face à gauche</option>
        </select>
      </label>
    </div>
    <p v-if="!pad.selected.value" class="hint">Branchez une manette et appuyez sur un bouton pour qu'elle soit détectée.</p>
    <template v-else>
      <div class="target" :class="feedback?.type">
        <span class="next-label">{{ index === 0 && !feedback ? "Première étape" : `Étape ${index + 1} / ${steps.length}` }}</span>
        <span class="next">{{ formatStep(steps[index]) }}</span>
        <span v-if="steps[index].label" class="next-move">{{ steps[index].label }}</span>
        <span v-if="feedback" class="feedback">{{ feedback.text }}</span>
      </div>
      <p class="live">Manette : <b>{{ pad.state.value.notation || "neutre" }}</b></p>
      <dl class="stats">
        <div><dt>Essais</dt><dd>{{ stats.attempts }}</dd></div>
        <div><dt>Réussis</dt><dd>{{ stats.successes }}</dd></div>
        <div><dt>Taux</dt><dd>{{ stats.attempts ? Math.round((100 * stats.successes) / stats.attempts) : 0 }} %</dd></div>
        <div><dt>Série</dt><dd>{{ stats.streak }} <small>(max {{ stats.best }})</small></dd></div>
      </dl>
      <p class="hint">Sans timing pour l'instant : seules les directions et les boutons de chaque étape sont vérifiés.</p>
    </template>
  </section>
</template>


<script setup>
import { reactive, ref, watch } from "vue"
import { buttonsMatch, formatMotion, formatStep, motionMatches, recordedMotion } from "./inputs"
import { useStepCapture } from "./useStepCapture"

// Practice of a combo with the controller: the steps have to be done in order, a mistake restarts the combo
const props = defineProps({
  steps: { type: Array, required: true },
  pad: { type: Object, required: true },
  title: { type: String, default: "Practice" },
})
const emit = defineEmits(["progress"])

const facing = ref("right")
const index = ref(0)
const feedback = ref(null)
const stats = reactive({ attempts: 0, successes: 0, streak: 0, best: 0 })

const capture = useStepCapture(props.pad, facing, {
  active: () => props.steps.length > 0,
  onStep: checkStep,
  // Step made of directions only (dash, input after a stance...): done as soon as the motion is there
  onDirection(dir, seen) {
    const step = props.steps[index.value]
    if (step && !step.buttons.length && motionMatches(step.motion, seen, dir)) {
      advance()
      return true
    }
    return false
  },
})

function progress(failedAt = null) {
  emit("progress", { index: index.value, failedAt })
}

function advance() {
  index.value++
  if (index.value < props.steps.length) {
    feedback.value = null
    progress()
    return
  }
  stats.attempts++
  stats.successes++
  stats.streak++
  stats.best = Math.max(stats.best, stats.streak)
  index.value = 0
  feedback.value = { type: "ok", text: "Combo réussi ! On recommence." }
  progress()
}

function fail(reason) {
  const failedAt = index.value
  stats.attempts++
  stats.streak = 0
  feedback.value = { type: "ko", text: `Raté à l'étape ${failedAt + 1} : ${reason}` }
  index.value = 0
  capture.reset()
  progress(failedAt)
}

function checkStep(g) {
  const step = props.steps[index.value]
  if (!step.buttons.length) {
    fail(`attendu ${formatMotion(step.motion)} sans bouton, reçu ${g.buttons.join("+")}.`)
    return
  }
  if (!buttonsMatch(step.buttons, g.buttons)) {
    fail(`bouton ${step.buttons.join("+")} attendu, ${g.buttons.join("+")} reçu.`)
    return
  }
  const seen = g.carried !== 5 ? [g.carried, ...g.changes] : g.changes
  if (!motionMatches(step.motion, seen, g.held)) {
    const done = formatMotion(recordedMotion(g.changes, g.held)) || "neutre"
    fail(`direction ${formatMotion(step.motion) || "neutre"} attendue, ${done} reçue.`)
    return
  }
  advance()
}

// Another combo, or another side: start over
watch(() => props.steps, () => {
  index.value = 0
  feedback.value = null
  Object.assign(stats, { attempts: 0, successes: 0, streak: 0, best: 0 })
  capture.reset()
  progress()
})
watch(facing, () => capture.reset())
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

.practice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.hint {
  margin: 0.75rem 0 0;
  color: var(--muted);
  line-height: 1.5;
}

.target {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  margin-top: 1.25rem;
  padding: 1.5rem 1rem;
  background: var(--bg-2);
  border: 2px solid var(--border-strong);
  text-align: center;

  &.ok {
    border-color: var(--success);
  }

  &.ko {
    border-color: var(--danger);
  }

  .next-label {
    font-family: var(--font-condensed);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .next {
    font-family: var(--font-display);
    font-size: clamp(2.2rem, 6vw, 3.6rem);
    line-height: 1.1;
    color: var(--yellow);
  }

  .next-move {
    color: var(--muted);
  }

  .feedback {
    margin-top: 0.5rem;
    font-weight: 600;
  }

  &.ok .feedback {
    color: var(--success);
  }

  &.ko .feedback {
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

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
  margin: 1rem 0 0;

  div {
    padding: 0.6rem 0.8rem;
    background: var(--bg-2);
    border: 1px solid var(--border);
  }

  dt {
    font-size: 0.8em;
    color: var(--muted);
  }

  dd {
    margin: 0;
    font-family: var(--font-condensed);
    font-size: 1.5em;
    font-weight: 700;

    small {
      font-size: 0.6em;
      color: var(--muted);
    }
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
</style>
