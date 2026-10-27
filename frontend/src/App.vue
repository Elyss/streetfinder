<script setup>
import { useRoute } from "vue-router"
import Footer from "@/apps/Footer.vue"

const route = useRoute()
</script>

<template>
  <div class="app">
    <router-view />
    <!-- The board editor takes the whole screen -->
    <Footer v-if="route.name !== 'board'" />
  </div>
</template>

<style>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* In a flex column, blocks centered with margin: auto would shrink to their content.
   Zero specificity: a page that sets its own width keeps it. */
:where(.app) > * {
  width: 100%;
  box-sizing: border-box;
}
</style>
