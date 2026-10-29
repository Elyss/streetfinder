<template>
  <div class="overlay" @pointerdown.self="emit('close')" @keydown.stop @keydown.esc="emit('close')">
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <header>
        <h2 id="share-title">Partager le board</h2>
        <button type="button" aria-label="Fermer" @click="emit('close')"><Icon name="close" /></button>
      </header>
      <p class="hint">
        Toute personne ayant un compte Delay Lama qui ouvre un lien rejoint le board avec le droit correspondant.
        Désactiver ou renouveler un lien n'enlève pas l'accès aux personnes déjà membres.
      </p>

      <div v-for="kind in KINDS" :key="kind.role" class="link-row">
        <div class="link-head">
          <div>
            <b>{{ kind.title }}</b>
            <span>{{ kind.description }}</span>
          </div>
          <button type="button" class="switch" :class="{ on: !!share[kind.token] }" role="switch" :aria-checked="!!share[kind.token]"
            :aria-label="`Activer le ${kind.title.toLowerCase()}`" :disabled="busy" @click="setLink(kind.role, { enabled: !share[kind.token] })">
            <span></span>
          </button>
        </div>
        <div v-if="share[kind.token]" class="link-value">
          <input :value="shareLink(share[kind.token])" readonly :aria-label="kind.title" @focus="$event.target.select()" />
          <button type="button" class="btn btn-primary" @click="copy(share[kind.token])">{{ copied === share[kind.token] ? "Copié" : "Copier" }}</button>
          <button type="button" class="renew" title="Générer un nouveau lien (l'ancien ne fonctionnera plus)" :disabled="busy"
            @click="setLink(kind.role, { regenerate: true })">Renouveler</button>
        </div>
      </div>

      <h3>Membres ({{ share.members.length }})</h3>
      <p v-if="!share.members.length" class="hint">Personne n'a encore rejoint ce board.</p>
      <ul class="members">
        <li v-for="m in share.members" :key="m.id">
          <div class="who">
            <b>{{ m.name }}</b>
            <span>{{ m.email }}</span>
          </div>
          <select :value="m.role" :aria-label="`Droit de ${m.name}`" :disabled="busy" @change="setMember(m, { role: $event.target.value })">
            <option value="edit">Écriture</option>
            <option value="view">Lecture</option>
          </select>
          <button type="button" class="remove" :title="`Retirer ${m.name}`" :aria-label="`Retirer ${m.name}`" :disabled="busy"
            @click="setMember(m, { remove: true })"><Icon name="trash" :size="16" /></button>
        </li>
      </ul>
      <p v-if="error" class="form-error">{{ error }}</p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue"
import Icon from "@/components/Icon.vue"
import { boardsApi, shareLink } from "../lib/api"

const props = defineProps({ boardId: { type: String, required: true } })
const emit = defineEmits(["close"])

const KINDS = [
  { role: "edit", token: "edit_token", title: "Lien en écriture", description: "Les membres modifient le board avec vous." },
  { role: "view", token: "view_token", title: "Lien en lecture", description: "Les membres voient le board sans pouvoir le modifier." },
]

const share = ref({ edit_token: null, view_token: null, members: [] })
const busy = ref(false)
const error = ref("")
const copied = ref(null)

async function run(request) {
  busy.value = true
  error.value = ""
  try {
    share.value = await request()
  } catch (e) {
    error.value = e?.response?.data?.error || e?.response?.data?.detail || "L'opération a échoué."
  } finally {
    busy.value = false
  }
}

const setLink = (role, data) => run(() => boardsApi.share(props.boardId, { role, enabled: true, ...data }))
const setMember = (member, data) => run(() => boardsApi.member(props.boardId, member.id, data))

async function copy(token) {
  try {
    await navigator.clipboard.writeText(shareLink(token))
    copied.value = token
    setTimeout(() => (copied.value = null), 2000)
  } catch {
    window.prompt("Lien de partage", shareLink(token))
  }
}

onMounted(() => run(() => boardsApi.share(props.boardId)))
</script>

<style scoped lang="scss">
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(27, 36, 51, 0.35);
}

.panel {
  box-sizing: border-box;
  width: min(560px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  padding: 20px 24px;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(27, 36, 51, 0.25);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: 1.3em;
  }

  button {
    border: 0;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }
}

.hint {
  margin: 8px 0 16px;
  font-size: 0.86em;
  line-height: 1.45;
  color: var(--muted);
}

.link-row {
  padding: 12px 0;
  border-top: 1px solid var(--surface-2);
}

.link-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  span {
    font-size: 0.85em;
    color: var(--muted);
  }
}

.link-value {
  display: flex;
  gap: 6px;
  margin-top: 10px;

  input {
    flex: 1;
    min-width: 0;
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    font: inherit;
    font-size: 0.85em;
    color: var(--text);
    background: var(--bg-2);
  }

  .btn {
    padding: 0.5rem 0.9rem;
  }

  .renew {
    border: 0;
    background: none;
    font: inherit;
    font-size: 0.85em;
    color: var(--muted);
    cursor: pointer;

    &:hover {
      color: var(--accent-hover);
    }
  }
}

.switch {
  flex-shrink: 0;
  position: relative;
  width: 38px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: var(--border-strong);
  cursor: pointer;
  transition: background-color 0.15s;

  span {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--surface);
    transition: transform 0.15s;
  }

  &.on {
    background: var(--success);

    span {
      transform: translateX(16px);
    }
  }
}

h3 {
  margin: 16px 0 4px;
  font-size: 0.95em;
}

.members {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--surface-2);
  }

  .who {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;

    span {
      font-size: 0.82em;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  select {
    font: inherit;
    font-size: 0.88em;
    padding: 4px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
  }

  .remove {
    display: grid;
    place-items: center;
    padding: 5px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;

    &:hover {
      background: var(--danger-soft);
      color: var(--danger);
    }
  }
}
</style>
