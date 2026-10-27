<template>
  <Header />

  <div class="container">
    <h1>Personnages</h1>
    <p class="subtitle">Choisissez un personnage pour afficher sa move list.</p>

    <p v-if="status === 'loading'">Chargement…</p>
    <p v-else-if="status === 'error'">Impossible de charger les personnages.</p>
    <p v-else-if="!characters.length">Aucun personnage pour le moment.</p>

    <div v-else class="character-grid">
      <router-link
        v-for="character in characters"
        :key="character.slug"
        :to="{ name: 'character', params: { slug: character.slug } }"
        class="character-card"
      >
        <span class="initial">{{ character.name[0] }}</span>
        <span class="name">{{ character.name }}</span>
        <span class="vitality">Vitalité&nbsp;: {{ character.vitality }}</span>
      </router-link>
    </div>
  </div>
</template>


<script setup>
import { onMounted, ref } from "vue"
import Header from "@/apps/Header.vue"
import api from "@/api/axios"

const characters = ref([])
const status = ref("loading")

const loadCharacters = async () => {
  try {
    const { data } = await api.get("/api/characters/")
    characters.value = data
    status.value = "ok"
  } catch (e) {
    status.value = "error"
  }
}

onMounted(loadCharacters)
</script>

<style lang="scss" scoped>
.container {
  max-width: 1200px;
  margin: auto;
  margin-block: 2rem;
  padding-inline: 1rem;
}

h1 {
  margin-block: 0 0.5rem;
}

.subtitle {
  margin-block: 0 1.5rem;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.5rem 1rem;
  background-color: white;
  border-radius: 15px;
  border: 1px solid #e5e9f0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    text-decoration: none;
    border-color: #5366ce;
    box-shadow: 0 4px 14px rgba(83, 102, 206, 0.15);
  }

  .initial {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: #ecf1ff;
    color: #4554b2;
    font-size: 1.8em;
    font-weight: 700;
  }

  .name {
    font-size: 1.1em;
    font-weight: 700;
    color: oklch(0.27 0.02 265);
  }

  .vitality {
    font-size: 0.85em;
    font-weight: 500;
    color: #5c626c;
  }
}
</style>
