<template>
    <Header />

    <div class="form-card">
        <h1>Créer un compte</h1>
        <p>Créez votre compte pour accéder aux move lists, au training et aux boards.</p>

        <form @submit.prevent="submit">
            <label for="pseudo">Pseudo</label>
            <input id="pseudo" v-model="form.pseudo" placeholder="Pseudo" autocomplete="nickname" maxlength="30" required />
            <p class="field-hint">Affiché aux autres joueurs. 2 à 30 caractères : lettres, chiffres, espaces et . _ -</p>

            <label for="email">Email</label>
            <input id="email" v-model="form.email" type="email" placeholder="Email" autocomplete="email" required />

            <label for="password">Mot de passe</label>
            <PasswordInput id="password" v-model="form.password" autocomplete="new-password" />

            <label for="confirm_password">Confirmer le mot de passe</label>
            <PasswordInput id="confirm_password" v-model="confirmPassword" placeholder="Confirmer le mot de passe" autocomplete="new-password" />

            <p v-if="error" class="form-error">{{ error }}</p>

            <button :disabled="auth.loading" type="submit" class="btn btn-primary">
                {{ auth.loading ? "Création…" : "Créer mon compte" }}
            </button>
        </form>

        <div class="links">
            <span>Déjà un compte ? <router-link :to="{ name: 'login', query: route.query }">Se connecter</router-link></span>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import Header from "@/apps/Header.vue"
import PasswordInput from "@/components/PasswordInput.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = ref({ pseudo: "", email: "", password: "" })
const confirmPassword = ref("")
const localError = ref("")
const error = computed(() => localError.value || auth.error)

auth.error = null

async function submit() {
    localError.value = ""
    auth.error = null
    if (form.value.password !== confirmPassword.value) {
        localError.value = "Les mots de passe ne correspondent pas."
        return
    }
    try {
        await auth.register(form.value)
        router.push(route.query.next || "/")
    } catch {
        // The error is shown from the store
    }
}
</script>
