<template>
        <header class="main_header">
            <div class="header_content">
                <router-link to="/" class="brand">
                    <img src="/favicon.svg" alt="">
                    StreetFinder
                </router-link>
                <router-link to="/">
                    Accueil
                </router-link>
            </div>
        </header>
</template>

<script setup>
</script>

<style lang="scss" scoped>

.main_header{
    width: 100%;
    background-color: white;
    border-bottom: 1px solid #e5e9f0;
}

.header_content{
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0.6rem 1rem;
    max-width: 1200px;
    margin: auto;
    gap: 1rem;

    .brand{
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-right: auto;
        font-size: 1.2em;
        font-weight: 700;
        color: oklch(0.27 0.02 265);

        &:hover{
            text-decoration: none;
        }
    }

    img{
        height: 28px;
    }
}

</style>
