<template>
  <Header />

  <div class="form-card">
    <h1>Board partagé</h1>
    <p v-if="!error">Ouverture du board…</p>
    <template v-else>
      <p class="form-error">{{ error }}</p>
      <div class="links">
        <router-link :to="{ name: 'boards' }">Mes boards</router-link>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import Header from "@/apps/Header.vue"
import { boardsApi } from "./lib/api"

// Share link: an account becomes a member of the board with the right of the link;
// without an account, the board opens with the link token (as long as the link is enabled)
const props = defineProps({ token: { type: String, required: true } })

const router = useRouter()
const error = ref("")

onMounted(async () => {
  try {
    const { id, member } = await boardsApi.join(props.token)
    router.replace({ name: "board", params: { id }, query: member ? {} : { share: props.token } })
  } catch (e) {
    error.value = e?.response?.data?.detail || "Impossible d'ouvrir ce board."
  }
})
</script>
