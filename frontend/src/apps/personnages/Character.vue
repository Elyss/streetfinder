<template>
  <Header />

  <div class="container">
    <router-link :to="{ name: 'characters' }" class="back">← Personnages</router-link>

    <p v-if="status === 'loading'">Chargement…</p>
    <p v-else-if="status === 'error'">Impossible de charger le personnage.</p>

    <template v-else>
      <div class="title">
        <h1>{{ character.name }}</h1>
        <span class="vitality">Vitalité&nbsp;: {{ character.vitality }}</span>
      </div>

      <nav class="tabs">
        <router-link
          v-for="tab in TABS"
          :key="tab.key"
          :to="{ name: 'character', params: { slug: character.slug, tab: tab.param } }"
          class="tab"
          :class="{ active: tab.key === activeTab }"
        >
          {{ tab.label }}
        </router-link>
      </nav>

      <!-- v-show keeps the state of each tab when switching -->
      <div v-show="activeTab === 'moves'">
        <MoveList :moves="character.moves" />
      </div>
      <div v-show="activeTab === 'combo'">
        <ComboBuilder :moves="character.moves" />
      </div>
    </template>
  </div>
</template>


<script setup>
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import Header from "@/apps/Header.vue"
import MoveList from "@/apps/personnages/MoveList.vue"
import ComboBuilder from "@/apps/combobuilder/ComboBuilder.vue"
import api from "@/api/axios"

const TABS = [
  { key: "moves", label: "Moves", param: "" },
  { key: "combo", label: "Combo builder", param: "combo" },
]

const route = useRoute()
const router = useRouter()

const character = ref(null)
const status = ref("loading")
const activeTab = computed(() => (route.params.tab === "combo" ? "combo" : "moves"))

const loadCharacter = async () => {
  try {
    const { data } = await api.get(`/api/characters/${route.params.slug}/`)
    character.value = data
    status.value = "ok"
  } catch (e) {
    if (e.response?.status === 404) {
      router.replace({ name: "not-found" })
      return
    }
    status.value = "error"
  }
}

onMounted(loadCharacter)
</script>

<style lang="scss" scoped>
.container {
  max-width: 1200px;
  margin: auto;
  margin-block: 2rem;
  padding-inline: 1rem;
}

.back {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.9em;
}

.title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 1rem;

  h1 {
    margin: 0;
    font-size: 2.2em;
  }

  .vitality {
    font-weight: 600;
    color: #5c626c;
  }
}

.tabs {
  display: flex;
  gap: 1.5rem;
  margin-block: 1.5rem;
  border-bottom: 1px solid #e5e9f0;
}

.tab {
  padding-bottom: 0.7rem;
  margin-bottom: -1px;
  border-bottom: 3px solid transparent;

  &:hover {
    text-decoration: none;
  }

  &.active {
    color: #4354b9;
    border-bottom-color: #5366ce;
  }
}
</style>
