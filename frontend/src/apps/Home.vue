<template>
  <Header />

  <div class="container">
    <section class="main pad-2" id="landing">
      <h1>Bienvenue sur StreetFinder</h1>
      <p>Le socle Django + Vue.js + Docker est en place&nbsp;: cette page est le point de départ de l'application.</p>

      <p class="api-status" :class="apiStatus">
        <span class="dot"></span>
        API&nbsp;: {{ API_LABELS[apiStatus] }}
      </p>
    </section>
  </div>
</template>


<script setup>
import { onMounted, ref } from "vue"
import Header from "@/apps/Header.vue"
import api from "@/api/axios"

const API_LABELS = {
  loading: "vérification…",
  ok: "connectée",
  error: "injoignable",
}

const apiStatus = ref("loading")

const checkApi = async () => {
  try {
    await api.get("/api/health/")
    apiStatus.value = "ok"
  } catch (e) {
    apiStatus.value = "error"
  }
}

onMounted(checkApi)
</script>

<style lang="scss" scoped>
p {
  margin: 0;
}

.container {
  max-width: 1200px;
  margin: auto;
  margin-block: 2rem;
  padding-inline: 1rem;
}

.main {
  box-sizing: border-box;

  background-color: white;
  border-radius: 15px;
  border: 1px solid #e5e9f0;
  width: 100%;
}

.pad-2 {
  padding: 2rem;
}

#landing {
  h1 {
    margin-top: 0;
    font-size: 2.5em;
  }
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1.5rem;
  font-size: 0.9em;
  font-weight: 600;

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #c5cad3;
  }

  &.ok .dot {
    background: #2FA46A;
  }

  &.error .dot {
    background: #DA3838;
  }
}
</style>
