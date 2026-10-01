<template>
    <Header />

    <div class="container">
        <h1>Page 404</h1>
        <router-link to="/" class="btn btn-primary">Retour à l'accueil</router-link>
    </div>
</template>

<script setup>
import Header from "@/apps/Header.vue"
</script>

<style lang="scss" scoped>
.container {
    max-width: 1200px;
    margin: auto;
    margin-block: 2rem;
    padding-inline: 1rem;
}

.btn:hover {
    color: #fff;
    text-decoration: none;
}
</style>
