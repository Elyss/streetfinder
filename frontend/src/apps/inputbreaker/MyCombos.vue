<template>
  <section class="main">
    <div class="head">
      <h2>Mes combos</h2>
      <router-link :to="{ name: 'characters' }" class="create">Créer un combo depuis un personnage →</router-link>
    </div>
    <p v-if="loading" class="hint">Chargement…</p>
    <p v-else-if="!combos.length" class="hint">
      Aucun combo enregistré. Ouvrez un personnage, onglet « Combo builder », pour en construire un.
    </p>

    <div v-else class="library">
      <div v-for="group in groups" :key="group.slug" class="group">
        <h3>
          <img :src="`/characters/${group.slug}.webp`" alt="" @error="$event.target.remove()" />
          {{ group.name }}
        </h3>
        <button v-for="combo in group.combos" :key="combo.id" class="combo" :class="{ active: combo.id === selected?.id }"
          @click="select(combo)">
          <span class="combo-name">{{ combo.name }}</span>
          <span class="combo-steps">{{ combo.steps.map(formatStep).join("  ›  ") }}</span>
        </button>
      </div>
    </div>
  </section>

  <template v-if="selected">
    <section class="main">
      <div class="head">
        <h2>{{ selected.name }} <small>· {{ characterName(selected.character) }}</small></h2>
        <router-link :to="{ name: 'character', params: { slug: selected.character, tab: 'builder' } }" class="create">
          Modifier dans le combo builder →
        </router-link>
      </div>
      <ComboSteps :steps="selected.steps" :progress="progress" />
    </section>
    <ComboPractice :steps="selected.steps" :pad="pad" @progress="progress = $event" />
  </template>
</template>


<script setup>
import { computed, onMounted, ref } from "vue"
import api from "@/api/axios"
import ComboPractice from "@/apps/combobuilder/ComboPractice.vue"
import ComboSteps from "@/apps/combobuilder/ComboSteps.vue"
import { formatStep } from "@/apps/combobuilder/inputs"

// Practice of the combos saved in the Combo builder, all characters together
defineProps({
  pad: { type: Object, required: true },
})

const combos = ref([])
const characters = ref({})
const loading = ref(true)
const selected = ref(null)
const progress = ref({ index: 0, failedAt: null })

const characterName = (slug) => characters.value[slug] || slug

const groups = computed(() => {
  const bySlug = new Map()
  for (const combo of combos.value) {
    if (!bySlug.has(combo.character)) bySlug.set(combo.character, [])
    bySlug.get(combo.character).push(combo)
  }
  return [...bySlug]
    .map(([slug, list]) => ({ slug, name: characterName(slug), combos: list }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

function select(combo) {
  selected.value = combo
  progress.value = { index: 0, failedAt: null }
}

onMounted(async () => {
  try {
    const [{ data: list }, { data: chars }] = await Promise.all([api.get("/api/combos/"), api.get("/api/characters/")])
    combos.value = list
    characters.value = Object.fromEntries(chars.map((c) => [c.slug, c.name]))
  } finally {
    loading.value = false
  }
})
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

    small {
      font-family: var(--font-body);
      font-size: 0.7em;
      font-weight: 500;
      text-transform: none;
      letter-spacing: 0;
      color: var(--muted);
    }
  }
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.create {
  font-size: 0.9em;
  color: var(--accent);
}

.hint {
  margin: 0.75rem 0 0;
  color: var(--muted);
}

.library {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-top: 1rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.2rem;
    font-family: var(--font-condensed);
    font-size: 1.1em;
    text-transform: uppercase;
    letter-spacing: 0.05em;

    img {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
    }
  }
}

.combo {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.8rem;
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  border-radius: var(--radius);
  color: var(--text);
  font: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--accent-border);
  }

  &.active {
    border-color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-soft);
  }
}

.combo-name {
  font-weight: 700;
}

.combo-steps {
  font-family: var(--font-condensed);
  color: var(--muted);
}
</style>
