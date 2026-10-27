<template>
    <footer class="main_footer">
        <div class="footer_content">
            <router-link to="/" class="brand">
                <img src="/logo-small.webp" alt="">
                <span>Delay Lama</span>
            </router-link>
            <p>© {{ year }} Delay Lama · GG, no re.</p>
        </div>
    </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>

<style lang="scss" scoped>

.main_footer{
    margin-top: auto;
    border-top: 1px solid var(--border);
    background-color: var(--bg);
}

.footer_content{
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    max-width: 1200px;
    margin: auto;
    padding: 1.5rem;

    p{
        margin: 0;
        font-size: 0.95rem;
        color: var(--muted);
    }
}

.brand{
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 400;
    text-transform: uppercase;

    &:hover{
        color: var(--text);
        text-decoration: none;
    }

    img{
        height: 34px;
        width: auto;
    }
}

</style>
