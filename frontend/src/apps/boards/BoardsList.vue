<template>
  <Header />

  <div class="container">
    <section class="head">
      <div>
        <h1>Mes boards</h1>
        <p class="hint">Vos boards, et ceux que d'autres utilisateurs ont partagés avec vous par lien.</p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn btn-secondary" @click="importOpen = !importOpen">Importer</button>
        <button type="button" class="btn btn-primary" :disabled="creating" @click="create">+ Nouveau board</button>
      </div>
    </section>

    <!-- Quick import: the code copied with "Exporter" recreates the board -->
    <form v-if="importOpen" class="import" @submit.prevent="importCode">
      <label for="import-code">Code d'export d'un board</label>
      <textarea id="import-code" v-model="code" rows="4" placeholder="SFB1.…" spellcheck="false"></textarea>
      <div class="import-actions">
        <button type="submit" class="btn btn-primary" :disabled="!code.trim() || importing">
          {{ importing ? "Import…" : "Créer le board" }}
        </button>
        <button type="button" class="btn btn-secondary" @click="importOpen = false">Annuler</button>
      </div>
    </form>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>

    <form class="open-link" @submit.prevent="openLink">
      <input v-model="link" placeholder="Coller un lien de partage" aria-label="Lien de partage d'un board" />
      <button type="submit" class="btn btn-secondary" :disabled="!link.trim()">Ouvrir</button>
    </form>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="loading" class="hint">Chargement…</p>

    <template v-else>
      <p v-if="!owned.length" class="empty">Aucun board pour l'instant. Créez-en un pour commencer.</p>
      <ul class="grid">
        <li v-for="b in owned" :key="b.id" class="card">
          <router-link :to="{ name: 'board', params: { id: b.id } }" class="preview" :aria-label="`Ouvrir ${b.title}`">
            <span class="count">{{ b.item_count }} objet{{ b.item_count > 1 ? "s" : "" }}</span>
          </router-link>
          <div class="meta">
            <router-link :to="{ name: 'board', params: { id: b.id } }" class="title">{{ b.title }}</router-link>
            <span class="date">Modifié {{ formatDate(b.updated_at) }}</span>
          </div>
          <div class="actions">
            <button type="button" title="Dupliquer" @click="duplicate(b)">Dupliquer</button>
            <button type="button" title="Copier le code d'export de ce board" @click="exportCode(b)">Exporter</button>
            <button type="button" class="danger" title="Supprimer définitivement" @click="remove(b)">Supprimer</button>
          </div>
        </li>
      </ul>

      <template v-if="shared.length">
        <h2>Partagés avec moi</h2>
        <ul class="grid">
          <li v-for="b in shared" :key="b.id" class="card">
            <router-link :to="{ name: 'board', params: { id: b.id } }" class="preview" :aria-label="`Ouvrir ${b.title}`">
              <span class="count">{{ b.item_count }} objet{{ b.item_count > 1 ? "s" : "" }}</span>
              <span class="role" :class="b.role">{{ b.role === "edit" ? "Écriture" : "Lecture" }}</span>
            </router-link>
            <div class="meta">
              <router-link :to="{ name: 'board', params: { id: b.id } }" class="title">{{ b.title }}</router-link>
              <span class="date">Par {{ b.owner_name }} · modifié {{ formatDate(b.updated_at) }}</span>
            </div>
            <div class="actions">
              <button type="button" title="Dupliquer dans mes boards" @click="duplicate(b)">Dupliquer</button>
              <button type="button" title="Copier le code d'export de ce board" @click="exportCode(b)">Exporter</button>
              <button type="button" title="Retirer ce board de ma liste" @click="leave(b)">Quitter</button>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import Header from "@/apps/Header.vue"
import { boardsApi } from "./lib/api"
import { exportBoardCode, importBoardCode } from "./lib/transfer"

const router = useRouter()
const boards = ref([])
const loading = ref(true)
const creating = ref(false)
const error = ref("")
const link = ref("")
const importOpen = ref(false)
const importing = ref(false)
const code = ref("")
const notice = ref("")

function showNotice(message) {
  notice.value = message
  clearTimeout(showNotice.timer)
  showNotice.timer = setTimeout(() => (notice.value = ""), 5000)
}

async function exportCode(b) {
  error.value = ""
  try {
    const text = await exportBoardCode(b.id)
    try {
      await navigator.clipboard.writeText(text)
      showNotice(`Code de « ${b.title} » copié (${Math.ceil(text.length / 1024)} Ko) : collez-le dans « Importer » pour recréer le board.`)
    } catch {
      window.prompt("Code d'export du board", text)
    }
  } catch {
    error.value = "L'export a échoué."
  }
}

async function importCode() {
  error.value = ""
  importing.value = true
  try {
    const board = await importBoardCode(code.value)
    code.value = ""
    importOpen.value = false
    router.push({ name: "board", params: { id: board.id } })
  } catch (e) {
    error.value = e?.response?.data?.error || e.message || "L'import a échoué."
  } finally {
    importing.value = false
  }
}

const owned = computed(() => boards.value.filter((b) => b.role === "owner"))
const shared = computed(() => boards.value.filter((b) => b.role !== "owner"))

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" })
const formatDate = (iso) => dateFormat.format(new Date(iso))

async function refresh() {
  loading.value = true
  try {
    boards.value = await boardsApi.list()
  } catch {
    error.value = "Impossible de récupérer les boards."
  } finally {
    loading.value = false
  }
}

async function create() {
  creating.value = true
  try {
    const board = await boardsApi.create({ title: "Sans titre" })
    router.push({ name: "board", params: { id: board.id } })
  } catch {
    error.value = "La création du board a échoué."
  } finally {
    creating.value = false
  }
}

function openLink() {
  error.value = ""
  const value = link.value.trim()
  const share = value.match(/partage\/([\w-]+)/)
  const id = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  if (share) router.push({ name: "board-join", params: { token: share[1] } })
  else if (id) router.push({ name: "board", params: { id: id[0].toLowerCase() } })
  else error.value = "Ce lien n'est pas un lien de board."
}

async function duplicate(b) {
  await boardsApi.duplicate(b.id)
  await refresh()
}

async function leave(b) {
  if (!window.confirm(`Retirer « ${b.title} » de vos boards ? Il vous faudra à nouveau le lien de partage pour y accéder.`)) return
  await boardsApi.leave(b.id)
  boards.value = boards.value.filter((x) => x.id !== b.id)
}

async function remove(b) {
  if (!window.confirm(`Supprimer définitivement « ${b.title} » ? Les personnes avec qui il est partagé perdront l'accès.`)) return
  await boardsApi.remove(b.id)
  boards.value = boards.value.filter((x) => x.id !== b.id)
}

onMounted(refresh)
</script>

<style lang="scss" scoped>
.container {
  max-width: 1200px;
  margin: auto;
  margin-block: 2rem;
  padding-inline: 1rem;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;

  h1 {
    margin: 0 0 0.3rem;
  }
}

h2 {
  margin: 2.5rem 0 0;
  font-size: 1.3em;
}

.head-actions {
  display: flex;
  gap: 0.5rem;
}

.import {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);

  label {
    font-weight: 600;
    font-size: 0.9em;
  }

  textarea {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 0.8em;
    padding: 0.6rem;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    resize: vertical;
    word-break: break-all;
  }
}

.import-actions {
  display: flex;
  gap: 0.5rem;
}

.notice {
  margin: 1rem 0 0;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  background: var(--success-soft);
  color: var(--success);
  font-size: 0.9em;
}

.hint,
.empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.92em;
}

.empty {
  margin-top: 2rem;
}

.error {
  color: var(--danger);
}

.open-link {
  display: flex;
  gap: 0.5rem;
  margin: 1.5rem 0;

  input {
    flex: 1;
    max-width: 480px;
    min-width: 0;
    font: inherit;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.preview {
  position: relative;
  height: 120px;
  background-color: var(--surface-2);
  background-image: radial-gradient(var(--border-strong) 1px, transparent 1px);
  background-size: 16px 16px;

  .role {
    position: absolute;
    right: 10px;
    top: 8px;
    font-size: 0.72em;
    font-weight: 700;
    border-radius: 6px;
    padding: 2px 7px;
    background: var(--success-soft);
    color: var(--success);

    &.view {
      background: var(--accent-soft);
      color: var(--accent);
    }
  }

  .count {
    position: absolute;
    left: 10px;
    bottom: 8px;
    font-size: 0.75em;
    font-weight: 600;
    color: var(--muted);
    background: var(--surface);
    border-radius: 6px;
    padding: 2px 6px;
  }
}

.meta {
  display: flex;
  flex-direction: column;
  padding: 0.7rem 0.9rem 0.3rem;

  .title {
    font-weight: 700;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    font-size: 0.8em;
    color: var(--muted);
  }
}

.actions {
  display: flex;
  gap: 0.2rem;
  padding: 0.3rem 0.6rem 0.6rem;

  button {
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.8em;
    color: var(--muted);
    padding: 4px 6px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background: var(--surface-2);
    }

    &.danger:hover {
      color: var(--danger);
      background: var(--danger-soft);
    }
  }
}
</style>
