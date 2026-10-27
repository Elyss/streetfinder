<template>
  <section class="main">
    <div class="combo-header">
      <h2>Votre combo</h2>
      <div v-if="combo.length" class="actions">
        <button class="btn btn-secondary" @click="combo.pop()">Retirer le dernier coup</button>
        <button class="btn btn-danger btn-soft" @click="combo = []">Réinitialiser</button>
      </div>
    </div>

    <p v-if="!combo.length" class="hint">Sélectionnez un premier coup ci-dessous pour démarrer un combo.</p>
    <ol v-else class="combo">
      <li v-for="(move, index) in combo" :key="index" class="step">
        <span class="name">{{ move.name }}</span>
        <span class="command">{{ move.command }}</span>
        <span class="frames">
          Startup {{ move.startup || "–" }} · Hit
          <span :class="advantageClass(move.on_hit)">{{ signed(move.on_hit) || "–" }}</span>
        </span>
      </li>
    </ol>
  </section>

  <section class="main">
    <template v-if="!last">
      <h2>Tous les coups</h2>
      <p class="hint">{{ candidates.length }} coups</p>
    </template>
    <template v-else>
      <h2>Suites possibles après {{ last.name }}</h2>
      <p v-if="lastAdvantage === null" class="hint">
        Aucune suite&nbsp;: ce coup n'a pas d'avantage en hit chiffré<template v-if="last.on_hit"> (valeur&nbsp;: {{ last.on_hit }})</template>.
      </p>
      <p v-else class="hint">
        {{ candidates.length }} coup(s) avec un startup inférieur ou égal à {{ lastAdvantage }}, l'avantage en hit de ce coup.
      </p>
    </template>

    <div class="card-grid">
      <button v-for="move in candidates" :key="move.order" class="move-card" @click="combo.push(move)">
        <span class="category">{{ CATEGORY_LABELS[move.category] }}</span>
        <span class="name">{{ move.name }}</span>
        <span class="command">{{ move.command }}</span>
        <span class="stats">
          <span class="stat">
            <span class="label">Startup</span>
            <span class="value">{{ move.startup || "–" }}</span>
          </span>
          <span class="stat">
            <span class="label">Hit</span>
            <span class="value" :class="advantageClass(move.on_hit)">{{ signed(move.on_hit) || "–" }}</span>
          </span>
          <span class="stat">
            <span class="label">Garde</span>
            <span class="value" :class="advantageClass(move.on_block)">{{ signed(move.on_block) || "–" }}</span>
          </span>
          <span class="stat">
            <span class="label">Dégâts</span>
            <span class="value">{{ move.damage || "–" }}</span>
          </span>
        </span>
      </button>
    </div>
  </section>
</template>


<script setup>
import { computed, ref } from "vue"
import { CATEGORY_LABELS, advantage, advantageClass, signed, startupFrames } from "@/utils/moves"

const props = defineProps({
  moves: { type: Array, required: true },
})

const combo = ref([])

const last = computed(() => combo.value.at(-1))
const lastAdvantage = computed(() => (last.value ? advantage(last.value.on_hit) : null))

// A move can follow the last one when its startup fits in the last move's hit advantage
const candidates = computed(() => {
  if (!last.value) return props.moves
  if (lastAdvantage.value === null) return []
  return props.moves.filter((move) => {
    const startup = startupFrames(move.startup)
    return startup !== null && startup <= lastAdvantage.value
  })
})
</script>

<style lang="scss" scoped>
.main {
  box-sizing: border-box;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background-color: white;
  border-radius: 15px;
  border: 1px solid #e5e9f0;
  width: 100%;

  h2 {
    margin: 0;
    font-size: 1.3em;
  }
}

.combo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
}

.hint {
  margin-block: 0.5rem 0;
  color: #5c626c;
}

.combo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 0;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  position: relative;
  padding: 0.75rem 1rem;
  background-color: #ecf1ff;
  border: 1px solid #d4ddf9;
  border-radius: 10px;

  & + & {
    margin-left: 2rem;

    &::before {
      content: "→";
      position: absolute;
      left: -1.5rem;
      top: 50%;
      transform: translateY(-50%);
      font-weight: 700;
      color: #5c626c;
    }
  }

  .frames {
    font-size: 0.8em;
    font-weight: 600;
    color: #5c626c;
  }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.move-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  background-color: white;
  border: 1px solid #e5e9f0;
  border-radius: 10px;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: #5366ce;
    box-shadow: 0 4px 14px rgba(83, 102, 206, 0.15);
  }

  .category {
    font-size: 0.7em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #5c626c;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 0.6rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .label {
    font-size: 0.7em;
    font-weight: 600;
    color: #5c626c;
  }

  .value {
    font-weight: 700;
  }
}

.name {
  font-weight: 700;
  color: oklch(0.27 0.02 265);
}

.command {
  font-size: 0.85em;
  color: #5c626c;
}

.plus {
  font-weight: 700;
  color: #27905C;
}

.minus {
  font-weight: 700;
  color: #C62525;
}
</style>
