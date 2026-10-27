<template>
  <ol class="steps">
    <li v-for="(step, i) in steps" :key="i" class="step"
      :class="progress && { done: i < progress.index, current: i === progress.index, missed: progress.failedAt === i }">
      <span class="num">{{ i + 1 }}</span>
      <span class="input">{{ formatStep(step) }}</span>
      <span v-if="step.label" class="label">{{ step.label }}</span>
      <button v-if="removable" class="remove" :aria-label="`Retirer l'étape ${i + 1}`" title="Retirer" @click="emit('remove', i)">×</button>
    </li>
  </ol>
</template>

<script setup>
import { formatStep } from "./inputs"

// Steps of a combo; during a practice, progress = { index, failedAt } highlights them
defineProps({
  steps: { type: Array, required: true },
  progress: { type: Object, default: null },
  removable: { type: Boolean, default: false },
})
const emit = defineEmits(["remove"])
</script>

<style lang="scss" scoped>
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
}

.step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 90px;
  padding: 0.55rem 2rem 0.55rem 0.75rem;
  background: var(--bg-2);
  border: 1px solid var(--border-strong);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius);

  .num {
    font-family: var(--font-condensed);
    font-size: 0.8em;
    font-weight: 700;
    color: var(--muted);
  }

  .input {
    font-family: var(--font-condensed);
    font-size: 1.35em;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .label {
    font-size: 0.8em;
    color: var(--muted);
  }

  .remove {
    position: absolute;
    top: 0.25rem;
    right: 0.35rem;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 1.1em;
    cursor: pointer;

    &:hover {
      color: var(--danger);
    }
  }

  &.done {
    border-color: var(--success);
    border-left-color: var(--success);
    opacity: 0.75;
  }

  &.current {
    border-color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-soft);
  }

  &.missed {
    border-color: var(--danger);
    border-left-color: var(--danger);
  }
}
</style>
