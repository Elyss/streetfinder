<template>
        <header class="main_header">
            <div class="header_content">
                <router-link to="/" class="brand" title="Accueil">
                    <img src="/logo-header.webp" alt="Delay Lama">
                </router-link>

                <!-- Logged out, the links lead to the login page -->
                <nav v-if="!auth.isLoggedIn || auth.isActivated" class="nav">
                    <router-link :to="{ name: 'characters' }">Move lists</router-link>
                    <router-link :to="{ name: 'input-breaker' }">Training</router-link>
                    <router-link v-if="auth.isLoggedIn" :to="{ name: 'boards' }">Boards</router-link>
                    <router-link v-else :to="{ name: 'login', query: { next: '/boards' } }" class="locked"
                        title="Connectez-vous pour utiliser les boards">Boards <Icon name="lock" :size="13" /></router-link>
                    <router-link v-if="auth.isAdmin" :to="{ name: 'users' }">Utilisateurs</router-link>
                </nav>
                <span v-else class="nav"></span>

                <div class="account">
                    <template v-if="auth.isLoggedIn">
                        <router-link :to="{ name: 'profile' }" class="user" :title="`Mon profil (${auth.user?.email || ''})`">
                            <Icon name="user" :size="18" />
                            <span>{{ auth.pseudo }}</span>
                        </router-link>
                        <button type="button" class="logout" title="Se déconnecter" aria-label="Se déconnecter" @click="logout">
                            <Icon name="logout" :size="18" />
                        </button>
                    </template>
                    <template v-else>
                        <router-link :to="{ name: 'login' }" class="login">Se connecter</router-link>
                        <router-link :to="{ name: 'register' }" class="register"><span>S'inscrire</span></router-link>
                    </template>
                </div>
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
    background-color: var(--bg);
    border-bottom: 1px solid var(--border);
}

.header_content{
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0.7rem 1.5rem;
    max-width: 1200px;
    margin: auto;
    gap: 1.5rem;
}

.brand{
    display: flex;
    align-items: center;
    gap: 0.7rem;
    flex: 1;
    font-family: var(--font-display);
    font-size: 1.7rem;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--text);
    white-space: nowrap;

    &:hover{
        color: var(--text);
        text-decoration: none;
    }

    img{
        display: block;
        height: 68px;
        width: auto;
        margin-block: -12px;
    }
}

.nav{
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2rem;

    a{
        font-family: var(--font-condensed);
        font-size: 1.05rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);

        &:hover,
        &.router-link-active{
            color: var(--text);
            text-decoration: none;
        }

        // Needs an account: greyed out
        &.locked{
            display: inline-flex;
            align-items: center;
            gap: 0.3rem;
            opacity: 0.45;

            &.router-link-active{
                color: var(--muted);
            }

            &:hover{
                opacity: 0.8;
            }
        }
    }
}

.account{
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1.25rem;
    flex: 1;
}

.login{
    font-weight: 600;
    white-space: nowrap;

    &:hover{
        text-decoration: none;
    }
}

// Slanted arcade button
.register{
    display: inline-block;
    padding: 0.55rem 1.4rem;
    background: var(--accent);
    transform: skewX(-12deg);
    transition: background-color 0.15s;

    span{
        display: inline-block;
        transform: skewX(12deg);
        font-family: var(--font-condensed);
        font-size: 1.05rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--on-accent);
    }

    &:hover{
        background: var(--accent-hover);
        text-decoration: none;
    }
}

.user{
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;

    &:hover{
        text-decoration: none;
    }
}

.logout{
    display: grid;
    place-items: center;
    padding: 0.35rem;
    border: 0;
    border-radius: var(--radius);
    background: none;
    color: var(--muted);
    cursor: pointer;

    &:hover{
        background: var(--surface-2);
        color: var(--danger);
    }
}

@media (max-width: 860px){
    .nav{
        display: none;
    }
}

@media (max-width: 520px){
    .brand img{
        height: 52px;
        margin-block: -6px;
    }

    .user span,
    .login{
        display: none;
    }
}

</style>
