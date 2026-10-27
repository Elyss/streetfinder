<template>
    <Header />

    <div class="form-card">
        <h1>Ajouter un utilisateur</h1>
        <p>La personne recevra un e-mail pour choisir son mot de passe. Son compte est activé d'office.</p>

        <form @submit.prevent="submit">
            <label for="first_name">Prénom</label>
            <input id="first_name" v-model="firstName" placeholder="Prénom" required />

            <label for="last_name">Nom</label>
            <input id="last_name" v-model="lastName" placeholder="Nom" required />

            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" placeholder="Email" required />

            <label class="check">
                <input v-model="isAdmin" type="checkbox" />
                Administrateur
            </label>

            <p v-if="error" class="form-error">{{ error }}</p>
            <p v-if="invited" class="form-success">
                Invitation envoyée à {{ invited.first_name }} {{ invited.last_name }} ({{ invited.email }}).
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

const firstName = ref("")
const lastName = ref("")
const email = ref("")
const isAdmin = ref(false)
const loading = ref(false)
const error = ref("")
const invited = ref(null)

const complete = computed(() => firstName.value.trim() && lastName.value.trim() && email.value.trim())

// A new entry hides the previous confirmation
watch([firstName, lastName, email], ([f, l, e]) => {
    if (f || l || e) invited.value = null
})

async function submit() {
    error.value = ""
    invited.value = null
    loading.value = true
    try {
        const { data } = await api.post("/api/users/", {
            first_name: firstName.value.trim(),
            last_name: lastName.value.trim(),
            email: email.value.trim(),
            is_admin: isAdmin.value,
        })
        firstName.value = lastName.value = email.value = ""
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
        accent-color: #5366ce;
    }
}
</style>
