<template>
    <Header />

    <div class="form-card">
        <h1>Connexion</h1>
        <p>Connectez-vous pour accéder à Delay Lama.</p>

        <form @submit.prevent="submit">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" placeholder="Email" autocomplete="email" required />

            <label for="password">Mot de passe</label>
            <PasswordInput id="password" v-model="password" />

            <p v-if="auth.error" class="form-error">{{ auth.error }}</p>

            <button :disabled="auth.loading" type="submit" class="btn btn-primary">
                {{ auth.loading ? "Connexion…" : "Se connecter" }}
            </button>
        </form>

        <div class="links">
            <router-link :to="{ name: 'reset-password' }">Mot de passe oublié ?</router-link>
            <router-link :to="{ name: 'register', query: route.query }">Créer un compte</router-link>
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import Header from "@/apps/Header.vue"
import PasswordInput from "@/components/PasswordInput.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref("")
const password = ref("")

auth.error = null

async function submit() {
    try {
        await auth.login(email.value, password.value)
        router.push(route.query.next || "/")
    } catch {
        // The error is shown from the store
    }
}
</script>
