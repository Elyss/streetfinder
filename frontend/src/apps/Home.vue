<template>
  <Header />

  <div class="main">
    <!-- Logged out: presentation and access to login / registration -->
    <section v-if="!auth.isLoggedIn" class="landing">
      <img src="/logo.webp" alt="Delay Lama" class="logo">
      <h1>Bienvenue sur Delay Lama</h1>
      <p>Move lists des personnages, exercices de manette et boards collaboratifs pour préparer vos matchs.</p>
      <div class="actions">
        <router-link :to="{ name: 'login' }" class="btn btn-primary">Se connecter</router-link>
        <router-link :to="{ name: 'register' }" class="btn btn-secondary">Créer un compte</router-link>
      </div>
    </section>

    <template v-else>
      <div class="intro">
        <h1>Bonjour {{ auth.firstName }}</h1>
        <p>{{ auth.isAdmin ? "Administrateur" : "Delay Lama" }}</p>
      </div>

      <!-- Pending account: no feature until an admin activates it -->
      <div v-if="!auth.isActivated" class="pending">
        <span class="icon orange"><Icon name="hourglass" :size="28" /></span>
        <div>
          <h2>Votre compte est en attente d'activation</h2>
          <p>
            Un administrateur doit valider votre compte avant que vous puissiez accéder à Delay Lama.
            Vous recevrez un e-mail dès qu'il sera activé.
          </p>
          <button type="button" class="btn btn-primary btn-outline" :disabled="checking" @click="check">
            <Icon name="refresh" :size="16" /> {{ checking ? "Vérification…" : "Vérifier à nouveau" }}
          </button>
          <p v-if="stillPending" class="info">Votre compte n'est pas encore activé.</p>
        </div>
      </div>

      <div v-else class="grid">
        <router-link v-for="tile in tiles" :key="tile.title" class="tile" :to="tile.to">
          <span class="icon" :class="tile.color"><Icon :name="tile.icon" :size="28" /></span>
          <span class="text">
            <span class="title">{{ tile.title }}</span>
            <span class="description">{{ tile.description }}</span>
          </span>
          <Icon name="chevron_right" class="arrow" />
        </router-link>
      </div>
    </template>
  </div>
</template>


<script setup>
import { computed, ref } from "vue"
import Header from "@/apps/Header.vue"
import Icon from "@/components/Icon.vue"
import { useAuthStore } from "@/stores/auth"

const auth = useAuthStore()

// Reloads the account: if an admin has just activated it, the tiles appear
const checking = ref(false)
const stillPending = ref(false)

async function check() {
  checking.value = true
  stillPending.value = false
  try {
    await auth.fetchMe()
    stillPending.value = !auth.isActivated
  } finally {
    checking.value = false
  }
}

const tiles = computed(() => [
  {
    title: "Personnages",
    description: "Consulter la move list de chaque personnage et composer ses combos.",
    icon: "fist",
    color: "blue",
    to: { name: "characters" },
  },
  {
    title: "Exercice DP",
    description: "S'entraîner au Dragon Punch avec sa manette, input par input.",
    icon: "gamepad",
    color: "green",
    to: { name: "input-breaker", params: { tab: "dp" } },
  },
  {
    title: "Boards",
    description: "Schématiser ses stratégies sur un tableau blanc partagé, en temps réel.",
    icon: "board",
    color: "orange",
    to: { name: "boards" },
  },
  {
    title: "Mon profil",
    description: "Consulter et modifier vos informations personnelles.",
    icon: "user",
    color: "violet",
    to: { name: "profile" },
  },
  auth.isAdmin && {
    title: "Gérer les utilisateurs",
    description: "Activer les nouveaux comptes et nommer les administrateurs.",
    icon: "users",
    color: "blue",
    to: { name: "users" },
  },
  auth.isAdmin && {
    title: "Ajouter un utilisateur",
    description: "Créer un compte et envoyer l’invitation à choisir son mot de passe.",
    icon: "user_plus",
    color: "red",
    to: { name: "add-user" },
  },
].filter(Boolean))
</script>

<style lang="scss" scoped>
.main {
  max-width: 1100px;
  margin: 2.5rem auto;
  padding: 0 1.5rem;
}

.landing {
  box-sizing: border-box;
  padding: 2.5rem 2rem;
  background-color: white;
  border: 1px solid #e5e9f0;
  border-radius: 15px;

  h1 {
    margin: 0 0 0.75rem;
    font-size: 2.3em;
  }

  text-align: center;

  p {
    margin: 0 auto;
    max-width: 620px;
    line-height: 1.5;
  }

  .logo {
    display: block;
    width: min(320px, 70%);
    height: auto;
    margin: 0 auto 1.5rem;
  }

  .actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.75rem;
  }

  .btn-primary:hover {
    color: #fff;
  }
}

.intro {
  margin-bottom: 2rem;

  h1 {
    margin: 0;
    font-size: 2.4em;
    color: #4f5fd6;
  }

  p {
    margin: 0.3rem 0 0;
    font-size: 1.1rem;
    color: oklch(0.38 0.05 265);
  }
}

.pending {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 2rem;
  background-color: white;
  border-radius: 15px;
  border-left: 5px solid #E0922B;
  box-shadow: 0 2px 40px rgba(0, 0, 0, 0.06);

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  p {
    margin: 0 0 1.25rem;
    line-height: 1.5;
  }

  .info {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
    color: #8a909b;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.tile {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.75rem 1.5rem;
  background-color: white;
  border: 2px solid transparent;
  border-radius: 15px;
  box-shadow: 0 2px 40px rgba(0, 0, 0, 0.06);
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
    border-color: #d4ddf9;
    text-decoration: none;

    .arrow {
      color: #4f5fd6;
      transform: translateX(3px);
    }
  }

  &:focus-visible {
    outline: 3px solid #E0922B;
    outline-offset: 2px;
  }
}

.icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;

  &.blue { background-color: #e6ebfb; color: #4f5fd6; }
  &.green { background-color: #dcf5ec; color: #12805a; }
  &.orange { background-color: #fdf0dc; color: #e07b00; }
  &.violet { background-color: #ecebf5; color: #3f4580; }
  &.red { background-color: #fbe9ea; color: #d6213a; }
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #3f4580;
}

.description {
  font-size: 0.92rem;
  font-weight: 400;
  line-height: 1.45;
  color: #8a909b;
}

.arrow {
  flex-shrink: 0;
  color: #c5cfdc;
  transition: color 0.15s, transform 0.15s;
}

@media (max-width: 540px) {
  .main {
    margin-top: 1.5rem;
    padding: 0 1rem;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .tile {
    padding: 1.1rem;
  }

  .pending {
    flex-direction: column;
    padding: 1.5rem;
  }
}
</style>
