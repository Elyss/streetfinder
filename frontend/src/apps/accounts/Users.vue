<template>
    <Header />

    <div class="container">
        <section class="head">
            <div>
                <h1>Utilisateurs</h1>
                <p class="hint">Activez les comptes créés par inscription, nommez des administrateurs.</p>
            </div>
            <router-link :to="{ name: 'add-user' }" class="btn btn-primary"><Icon name="user_plus" :size="18" /> Ajouter un utilisateur</router-link>
        </section>

        <div class="filters">
            <input v-model="query" type="search" placeholder="Rechercher un pseudo ou un email" aria-label="Rechercher un utilisateur" />
            <label><input v-model="pendingOnly" type="checkbox" /> En attente d'activation ({{ pendingCount }})</label>
        </div>

        <p v-if="loading" class="hint">Chargement…</p>
        <p v-else-if="error" class="form-error">{{ error }}</p>

        <div v-else class="table">
            <table>
                <thead>
                    <tr>
                        <th>Pseudo</th>
                        <th>Email</th>
                        <th>Inscrit le</th>
                        <th>Compte activé</th>
                        <th>Administrateur</th>
                        <th><span class="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="u in filtered" :key="u.id" :class="{ me: u.id === auth.id }">
                        <td data-label="Pseudo" class="name">{{ u.pseudo }}<span v-if="u.id === auth.id" class="you">vous</span></td>
                        <td data-label="Email" class="email">{{ u.email }}</td>
                        <td data-label="Inscrit le">{{ formatDate(u.date_joined) }}</td>
                        <td data-label="Compte activé">
                            <button type="button" class="switch" :class="{ on: u.is_activated_by_admin }" role="switch"
                                :aria-checked="u.is_activated_by_admin" :disabled="u.id === auth.id || busy === u.id"
                                :title="u.id === auth.id ? 'Vous ne pouvez pas modifier vos propres droits.' : null"
                                @click="toggle(u, 'activation')"><span></span></button>
                        </td>
                        <td data-label="Administrateur">
                            <button type="button" class="switch" :class="{ on: u.is_admin }" role="switch" :aria-checked="u.is_admin"
                                :disabled="u.id === auth.id || busy === u.id"
                                :title="u.id === auth.id ? 'Vous ne pouvez pas modifier vos propres droits.' : null"
                                @click="toggle(u, 'admin')"><span></span></button>
                        </td>
                        <td class="actions">
                            <button v-if="u.id !== auth.id" type="button" class="delete" title="Supprimer ce compte" :aria-label="`Supprimer ${u.email}`"
                                :disabled="busy === u.id" @click="remove(u)"><Icon name="trash" :size="18" /></button>
                        </td>
                    </tr>
                    <tr v-if="!filtered.length">
                        <td colspan="6" class="empty">Aucun utilisateur ne correspond.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p v-if="actionError" class="form-error">{{ actionError }}</p>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue"
import api from "@/api/axios"
import Header from "@/apps/Header.vue"
import Icon from "@/components/Icon.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const users = ref([])
const loading = ref(true)
const error = ref("")
const actionError = ref("")
const busy = ref(null)
const query = ref("")
const pendingOnly = ref(false)
// Rows changed during this visit stay listed, even once they no longer match the filter
const touched = ref(new Set())

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" })
const formatDate = (iso) => dateFormat.format(new Date(iso))

const pendingCount = computed(() => users.value.filter((u) => !u.is_activated_by_admin && !u.is_admin).length)

const filtered = computed(() => {
    // Every word must appear in the name or the e-mail
    const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
    return users.value.filter((u) => {
        if (pendingOnly.value && (u.is_activated_by_admin || u.is_admin) && !touched.value.has(u.id)) return false
        const text = `${u.pseudo} ${u.email}`.toLowerCase()
        return words.every((w) => text.includes(w))
    })
})

async function load() {
    loading.value = true
    try {
        const { data } = await api.get("/api/users/")
        users.value = data
        // Accounts waiting for activation are what admins come here for
        pendingOnly.value = pendingCount.value > 0
    } catch {
        error.value = "Impossible de charger les utilisateurs."
    } finally {
        loading.value = false
    }
}

async function toggle(user, what) {
    actionError.value = ""
    busy.value = user.id
    touched.value.add(user.id)
    try {
        const { data } = await api.post(`/api/users/${user.id}/${what}/`)
        Object.assign(user, data)
    } catch (e) {
        actionError.value = e?.response?.data?.error || "Modification impossible."
    } finally {
        busy.value = null
    }
}

async function remove(user) {
    if (!window.confirm(`Supprimer définitivement le compte de ${user.pseudo} (${user.email}) ?`)) return
    actionError.value = ""
    busy.value = user.id
    try {
        await api.delete(`/api/users/${user.id}/`)
        users.value = users.value.filter((u) => u.id !== user.id)
    } catch (e) {
        actionError.value = e?.response?.data?.error || "Suppression impossible."
    } finally {
        busy.value = null
    }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.container{
    max-width: 1100px;
    margin: 2rem auto;
    padding-inline: 1rem;
}

.head{
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;

    h1{
        margin: 0 0 0.3rem;
    }

    .btn:hover{
        color: var(--on-accent);
    }
}

.hint{
    margin: 0;
    color: var(--muted);
    font-size: 0.92em;
}

.filters{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 1.5rem 0 1rem;

    input[type="search"]{
        flex: 1;
        max-width: 360px;
        min-width: 0;
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        font: inherit;
    }

    label{
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.9em;
        cursor: pointer;

        input{
            accent-color: var(--accent);
        }
    }
}

.table{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
}

table{
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92em;
}

th{
    text-align: left;
    padding: 0.8rem 1rem;
    font-size: 0.8em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
}

td{
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--surface-2);
    vertical-align: middle;
}

tr:last-child td{
    border-bottom: 0;
}

.name{
    font-weight: 600;
    color: var(--text);
}

.you{
    margin-left: 0.5rem;
    padding: 1px 6px;
    border-radius: 6px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 0.75em;
}

.email{
    word-break: break-all;
}

.empty{
    text-align: center;
    color: var(--muted);
}

.switch{
    position: relative;
    width: 38px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 11px;
    background: var(--border-strong);
    cursor: pointer;
    transition: background-color 0.15s;

    span{
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--surface);
        transition: transform 0.15s;
    }

    &.on{
        background: var(--success);

        span{
            transform: translateX(16px);
        }
    }

    &:disabled{
        opacity: 0.45;
        cursor: not-allowed;
    }
}

.actions{
    text-align: right;
}

.delete{
    display: inline-grid;
    place-items: center;
    padding: 0.3rem;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: pointer;

    &:hover{
        background: var(--danger-soft);
        color: var(--danger);
    }
}

.sr-only{
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
}

// Phones: one card per user
@media (max-width: 720px){
    thead{
        display: none;
    }

    tr{
        display: block;
        padding: 0.6rem 0;
        border-bottom: 1px solid var(--border);
    }

    td{
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.35rem 1rem;
        border: 0;

        &[data-label]::before{
            content: attr(data-label);
            font-weight: 600;
            color: var(--muted);
        }
    }
}
</style>
