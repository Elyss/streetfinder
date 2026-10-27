<template>
    <Header />

    <div class="form-card">
        <h1>Mon profil</h1>

        <form @submit.prevent="submit">
            <label for="email">Email</label>
            <input id="email" :value="auth.user?.email" type="email" disabled />
            <p v-if="auth.isAdmin" class="role"><Icon name="shield" :size="16" /> Administrateur</p>

            <label for="first_name">Prénom</label>
            <input id="first_name" v-model="firstName" placeholder="Prénom" autocomplete="given-name" required />

            <label for="last_name">Nom</label>
            <input id="last_name" v-model="lastName" placeholder="Nom" autocomplete="family-name" required />

            <p v-if="auth.error" class="form-error">{{ auth.error }}</p>
            <p v-if="saved" class="form-success">Vos informations ont été enregistrées.</p>

            <button :disabled="auth.loading || !changed" type="submit" class="btn btn-primary">
                {{ auth.loading ? "Enregistrement…" : "Enregistrer" }}
            </button>
        </form>

        <div class="links">
            <router-link :to="{ name: 'reset-password' }">Changer mon mot de passe</router-link>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch } from "vue"
import Header from "@/apps/Header.vue"
import Icon from "@/components/Icon.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const firstName = ref("")
const lastName = ref("")
const saved = ref(false)

auth.error = null

// The form shows the saved values (on load and after each save)
watch(() => auth.user, (user) => {
    firstName.value = user?.first_name || ""
    lastName.value = user?.last_name || ""
}, { immediate: true })

const changed = computed(() =>
    firstName.value.trim() !== (auth.user?.first_name || "") ||
    lastName.value.trim().toUpperCase() !== (auth.user?.last_name || ""),
)

watch([firstName, lastName], () => (saved.value = false))

async function submit() {
    try {
        await auth.updateProfile(firstName.value.trim(), lastName.value.trim())
        saved.value = true
    } catch {
        // The error is shown from the store
    }
}
</script>

<style lang="scss" scoped>
.role{
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin: 0.2rem 0 0;
    font-size: 0.85em;
    color: var(--accent);
}
</style>
