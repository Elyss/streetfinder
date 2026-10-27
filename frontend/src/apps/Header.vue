<template>
        <header class="main_header">
            <div class="header_content">
                <router-link to="/" class="brand" title="Accueil">
                    <img src="/logo-header.webp" alt="Delay Lama">
                </router-link>

                <!-- The apps are reserved to activated accounts -->
                <nav v-if="auth.isLoggedIn && auth.isActivated" class="nav">
                    <router-link to="/">
                        Accueil
                    </router-link>
                    <router-link :to="{ name: 'characters' }">
                        Personnages
                    </router-link>
                    <router-link :to="{ name: 'input-breaker' }">
                        Input breaker
                    </router-link>
                    <router-link :to="{ name: 'boards' }">
                        Boards
                    </router-link>
                    <router-link v-if="auth.isAdmin" :to="{ name: 'users' }">
                        Utilisateurs
                    </router-link>
                </nav>

                <template v-if="auth.isLoggedIn">
                    <router-link :to="{ name: 'profile' }" class="user" :title="`Mon profil (${auth.user?.email || ''})`">
                        <Icon name="user" :size="18" />
                        <span>{{ auth.fullName }}</span>
                    </router-link>
                    <button type="button" class="logout" title="Se déconnecter" aria-label="Se déconnecter" @click="logout">
                        <Icon name="logout" :size="18" />
                    </button>
                </template>
                <template v-else>
                    <router-link :to="{ name: 'login' }">
                        Se connecter
                    </router-link>
                    <router-link :to="{ name: 'register' }" class="btn btn-primary register">
                        S'inscrire
                    </router-link>
                </template>
            </div>
        </header>
</template>

<script setup>
import { useRouter } from "vue-router"
import Icon from "@/components/Icon.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()
const router = useRouter()

function logout() {
    auth.logout()
    router.push({ name: "login" })
}
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
        display: block;
        height: 56px;
        width: auto;
        margin-block: -8px;
    }
}

.nav{
    display: flex;
    align-items: center;
    gap: 1rem;
}

.user{
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding-left: 1rem;
    border-left: 1px solid #e5e9f0;
}

.logout{
    display: grid;
    place-items: center;
    padding: 0.35rem;
    border: 0;
    border-radius: 8px;
    background: none;
    color: #5c626c;
    cursor: pointer;

    &:hover{
        background: #f1f3f6;
        color: #C62525;
    }
}

.register{
    padding: 0.5rem 0.9rem;

    &:hover{
        color: #fff;
    }
}

@media (max-width: 760px){
    .nav{
        display: none;
    }

    .user span{
        display: none;
    }
}

</style>
