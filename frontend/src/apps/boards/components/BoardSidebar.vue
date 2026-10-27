<template>
  <aside class="sidebar" aria-label="Mes boards">
    <div class="side-head">
      <span>Mes boards</span>
      <button type="button" class="new" title="Nouveau board" :disabled="creating" @click="create">+ Nouveau</button>
    </div>
    <input v-model="query" type="search" class="search" placeholder="Rechercher un board" aria-label="Rechercher un board" @keydown.stop />

    <p v-if="loading" class="hint">Chargement…</p>
    <div v-else class="lists">
      <nav v-for="section in sections" :key="section.title" class="section">
        <p v-if="section.title" class="section-title">{{ section.title }}</p>
        <router-link v-for="b in section.boards" :key="b.id" :to="{ name: 'board', params: { id: b.id } }" class="board"
          :class="{ current: b.id === currentId }" :title="b.owner_name && b.role !== 'owner' ? `Board de ${b.owner_name}` : b.title">
          <span class="board-title">{{ b.id === currentId ? currentTitle || b.title : b.title }}</span>
          <span v-if="b.role === 'view'" class="role">Lecture</span>
        </router-link>
      </nav>
      <p v-if="!sections.length" class="hint">{{ query ? "Aucun board ne correspond." : "Aucun board." }}</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { boardsApi } from "../lib/api"

// Side panel of the editor: quick navigation between the boards of the user
const props = defineProps({
  currentId: { type: String, default: null },
  currentTitle: { type: String, default: "" },
})

const router = useRouter()
const boards = ref([])
const loading = ref(true)
const creating = ref(false)
const query = ref("")

const sections = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  const match = (b) => {
    const title = (b.id === props.currentId ? props.currentTitle || b.title : b.title).toLowerCase()
    return words.every((w) => title.includes(w))
  }
  const owned = boards.value.filter((b) => b.role === "owner" && match(b))
  const shared = boards.value.filter((b) => b.role !== "owner" && match(b))
  return [
    owned.length && { title: shared.length ? "Mes boards" : "", boards: owned },
    shared.length && { title: "Partagés avec moi", boards: shared },
  ].filter(Boolean)
})

async function refresh() {
  try {
    boards.value = await boardsApi.list()
  } catch {
    boards.value = []
  } finally {
    loading.value = false
  }
}

async function create() {
  creating.value = true
  try {
    const board = await boardsApi.create({ title: "Sans titre" })
    await refresh()
    router.push({ name: "board", params: { id: board.id } })
  } finally {
    creating.value = false
  }
}

// A board opened from elsewhere (link, chip) may not be listed yet
watch(() => props.currentId, (id) => {
  if (id && !boards.value.some((b) => b.id === id)) refresh()
})

onMounted(refresh)
</script>

<style scoped lang="scss">
.sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 250px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;

  span {
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
}

.new {
  border: 0;
  border-radius: 6px;
  padding: 4px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font: inherit;
  font-size: 0.82em;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--accent);
    color: var(--on-accent);
  }
}

.search {
  margin: 0 12px 8px;
  padding: 6px 9px;
  font: inherit;
  font-size: 0.88em;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
}

.lists {
  flex: 1;
  padding: 0 6px 8px;
  overflow-y: auto;
}

.section {
  display: flex;
  flex-direction: column;
}

.section-title {
  margin: 8px 8px 4px;
  font-size: 0.72em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.board {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 6px;
  font-size: 0.9em;
  font-weight: 500;
  color: var(--text);

  &:hover {
    background: var(--surface-2);
    color: var(--text);
    text-decoration: none;
  }

  &.current {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 700;
  }
}

.board-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role {
  flex-shrink: 0;
  font-size: 0.72em;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
}

.hint {
  margin: 8px;
  font-size: 0.85em;
  color: var(--muted);
}

@media (max-width: 640px) {
  .sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    z-index: 25;
    box-shadow: 8px 0 24px rgba(27, 36, 51, 0.15);
  }
}
</style>
