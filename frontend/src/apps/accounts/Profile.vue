<template>
    <Header />

    <div class="form-card">
        <h1>Mon profil</h1>

        <form @submit.prevent="submit">
            <label for="email">Email</label>
            <input id="email" :value="auth.user?.email" type="email" disabled />
            <p v-if="auth.isAdmin" class="role"><Icon name="shield" :size="16" /> Administrateur</p>

            <label for="pseudo">Pseudo</label>
            <input id="pseudo" v-model="pseudo" placeholder="Pseudo" autocomplete="nickname" maxlength="30" required />
            <p class="field-hint">Affiché aux autres joueurs. 2 à 30 caractères : lettres, chiffres, espaces et . _ -</p>

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
const pseudo = ref("")
const saved = ref(false)

auth.error = null

// The form shows the saved values (on load and after each save)
watch(() => auth.user, (user) => {
    pseudo.value = user?.pseudo || ""
}, { immediate: true })

const changed = computed(() =>
    pseudo.value.trim() !== (auth.user?.pseudo || ""),
)

watch(pseudo, () => (saved.value = false))

async function submit() {
    try {
        await auth.updateProfile(pseudo.value.trim())
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
