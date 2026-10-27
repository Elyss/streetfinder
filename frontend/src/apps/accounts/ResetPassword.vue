<template>
    <Header />

    <!-- Step 1: ask for the link by e-mail -->
    <div v-if="!hasLink" class="form-card">
        <h1>Mot de passe oublié</h1>
        <p>Entrez votre adresse e-mail : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>

        <form v-if="!sent" @submit.prevent="requestLink">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" placeholder="Email" autocomplete="email" required />

            <p v-if="error" class="form-error">{{ error }}</p>

            <button type="submit" class="btn btn-primary" :disabled="!email || loading">
                {{ loading ? "Envoi…" : "Envoyer le lien" }}
            </button>
        </form>

        <p v-else class="form-success">
            Si un compte est associé à cette adresse, un lien de réinitialisation vient d’être envoyé.
            Pensez à vérifier vos courriers indésirables.
        </p>

        <div class="links">
            <router-link :to="{ name: 'login' }">Retour à la connexion</router-link>
        </div>
    </div>

    <!-- Step 2 (reset link) or invitation link: choose the password, then logged in -->
    <div v-else class="form-card">
        <h1>{{ invitation ? "Bienvenue sur Delay Lama" : "Nouveau mot de passe" }}</h1>

        <p v-if="checking">Vérification du lien…</p>

        <template v-else-if="!linkValid">
            <p class="form-error">
                Ce lien est invalide ou a expiré.
                <template v-if="invitation">Votre compte existe déjà : demandez un nouveau lien avec « Mot de passe oublié ».</template>
            </p>
            <div class="links">
                <router-link :to="{ name: 'reset-password' }">Demander un nouveau lien</router-link>
            </div>
        </template>

        <template v-else>
            <p>
                Bonjour <b>{{ firstName }}</b>,
                {{ invitation ? "choisissez votre mot de passe pour accéder à votre compte." : "choisissez votre nouveau mot de passe." }}
            </p>
            <form @submit.prevent="savePassword">
                <label for="password">Mot de passe</label>
                <PasswordInput id="password" v-model="password" autocomplete="new-password" />

                <label for="confirm_password">Confirmer le mot de passe</label>
                <PasswordInput id="confirm_password" v-model="confirmPassword" placeholder="Confirmer le mot de passe" autocomplete="new-password" />

                <p v-if="error" class="form-error">{{ error }}</p>

                <button type="submit" class="btn btn-primary" :disabled="!password || !confirmPassword || loading">
                    {{ loading ? "Enregistrement…" : "Enregistrer et me connecter" }}
                </button>
            </form>
        </template>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue"
import { useRouter } from "vue-router"
import api from "@/api/axios"
import Header from "@/apps/Header.vue"
import PasswordInput from "@/components/PasswordInput.vue"
import { useAuthStore } from "@/stores/auth"

const props = defineProps({
    uid: { type: String, default: "" },
    token: { type: String, default: "" },
    // Link of the invitation e-mail sent when an admin creates the account
    invitation: { type: Boolean, default: false },
})

const auth = useAuthStore()
const router = useRouter()

const hasLink = computed(() => !!(props.uid && props.token))
const email = ref("")
const sent = ref(false)
const checking = ref(false)
const linkValid = ref(false)
const firstName = ref("")
const password = ref("")
const confirmPassword = ref("")
const loading = ref(false)
const error = ref("")

async function requestLink() {
    error.value = ""
    loading.value = true
    try {
        await api.post("/api/auth/password/forgot/", { email: email.value.trim().toLowerCase() })
        sent.value = true
    } catch (e) {
        error.value = e?.response?.status === 429
            ? "Trop de demandes. Veuillez réessayer plus tard."
            : "Une erreur est survenue. Veuillez réessayer plus tard."
    } finally {
        loading.value = false
    }
}

async function checkLink() {
    checking.value = true
    try {
        const { data } = await api.get("/api/auth/password/link/", { params: { uid: props.uid, token: props.token } })
        firstName.value = data.first_name
        linkValid.value = true
    } catch {
        linkValid.value = false
    } finally {
        checking.value = false
    }
}

async function savePassword() {
    error.value = ""
    if (password.value !== confirmPassword.value) {
        error.value = "Les mots de passe ne correspondent pas."
        return
    }
    loading.value = true
    try {
        const { data } = await api.post("/api/auth/password/reset/", { uid: props.uid, token: props.token, password: password.value })
        await auth.loginWithTokens(data)
        router.push({ name: "home" })
    } catch (e) {
        error.value = e?.response?.data?.error || "Une erreur est survenue. Veuillez réessayer plus tard."
    } finally {
        loading.value = false
    }
}

onMounted(() => hasLink.value && checkLink())

// "Demander un nouveau lien" comes back to the same page without uid / token
watch(hasLink, (value) => {
    error.value = ""
    if (value) checkLink()
})
</script>
