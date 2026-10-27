<template>
    <Header />

    <div class="form-card">
        <h1>Ajouter un utilisateur</h1>
        <p>La personne recevra un e-mail pour choisir son mot de passe. Son compte est activé d'office.</p>

        <form @submit.prevent="submit">
            <label for="pseudo">Pseudo</label>
            <input id="pseudo" v-model="pseudo" placeholder="Pseudo" maxlength="30" required />

            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" placeholder="Email" required />

            <label class="check">
                <input v-model="isAdmin" type="checkbox" />
                Administrateur
            </label>

            <p v-if="error" class="form-error">{{ error }}</p>
            <p v-if="invited" class="form-success">
                Invitation envoyée à {{ invited.pseudo }} ({{ invited.email }}).
            </p>

            <button :disabled="loading || !complete" type="submit" class="btn btn-primary">
                {{ loading ? "Envoi…" : "Créer et envoyer l’invitation" }}
            </button>
        </form>

        <div class="links">
            <router-link :to="{ name: 'users' }">Gérer les utilisateurs</router-link>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import api from "@/api/axios"
import Header from "@/apps/Header.vue"

const pseudo = ref("")
const email = ref("")
const isAdmin = ref(false)
const loading = ref(false)
const error = ref("")
const invited = ref(null)

const complete = computed(() => pseudo.value.trim() && email.value.trim())

// A new entry hides the previous confirmation
watch([pseudo, email], ([p, e]) => {
    if (p || e) invited.value = null
})

async function submit() {
    error.value = ""
    invited.value = null
    loading.value = true
    try {
        const { data } = await api.post("/api/users/", {
            pseudo: pseudo.value.trim(),
            email: email.value.trim(),
            is_admin: isAdmin.value,
        })
        pseudo.value = email.value = ""
        isAdmin.value = false
        invited.value = data
    } catch (e) {
        error.value = e?.response?.data?.error || "Création impossible."
    } finally {
        loading.value = false
    }
}
</script>

<style lang="scss" scoped>
.check{
    display: flex;
    align-items: center;
    gap: 0.6rem;
    cursor: pointer;
    user-select: none;

    input{
        width: 18px;
        height: 18px;
        margin: 0;
        accent-color: var(--accent);
    }
}
</style>
