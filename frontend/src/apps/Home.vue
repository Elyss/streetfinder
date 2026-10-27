<template>
  <Header />

  <!-- Fighting game HUD: two life bars and the round timer -->
  <div class="hud" aria-hidden="true">
    <span class="life p1"></span>
    <span class="timer">99</span>
    <span class="life p2"></span>
  </div>

  <!-- Logged out: presentation and access to login / registration -->
  <template v-if="!auth.isLoggedIn">
    <section class="hero">
      <h1>
        <span>Frame data.</span>
        <span>Combo practice.</span>
        <span class="hot">Boards collaboratifs.</span>
      </h1>
      <div class="art">
        <img src="/logo.webp" alt="Delay Lama">
      </div>
    </section>

    <section class="coin">
      <h2>Insert coin</h2>
      <div class="coin-actions">
        <router-link :to="{ name: 'register' }" class="coin-btn dark">Créer un compte</router-link>
        <router-link :to="{ name: 'login' }" class="coin-btn outline">Se connecter</router-link>
      </div>
    </section>
  </template>

  <div v-else class="main">
    <div class="intro">
      <h1>Bonjour <span class="hot">{{ auth.pseudo }}</span></h1>
      <p>{{ auth.isAdmin ? "Administrateur" : "Joueur" }} · Ready? Fight!</p>
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
    title: "Input breaker",
    description: "Visualiser ses inputs à la manette, s'entraîner au DP et à ses combos.",
    icon: "gamepad",
    color: "green",
    to: { name: "input-breaker" },
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
// ------------------------------------------------------------------ HUD
.hud {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  width: 100%;
  max-width: 1200px;
  box-sizing: border-box;
  margin: 2.5rem auto 0;
  padding: 0 1.5rem;

  .life {
    height: 18px;
    border: 2px solid #fff3d6;
    box-sizing: border-box;

    &.p1 {
      background: var(--yellow);
      transform: skewX(-30deg);
    }

    &.p2 {
      background: var(--accent);
      transform: skewX(30deg);
    }
  }

  .timer {
    display: grid;
    place-items: center;
    width: 76px;
    height: 66px;
    border: 2px solid var(--text);
    font-family: var(--font-display);
    font-size: 2.6rem;
    color: var(--text);
  }
}

.hot {
  color: var(--accent);
}

// ------------------------------------------------------------------ landing
.hero {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  align-items: center;
  gap: 2rem;
  width: 100%;
  max-width: 1200px;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 4rem 1.5rem 7rem;

  // Lighter diagonal band crossing the stage
  &::before {
    content: "";
    position: absolute;
    left: calc(50% - 50vw);
    right: calc(50% - 50vw);
    bottom: 3rem;
    height: 200px;
    background: var(--bg-2);
    clip-path: polygon(0 35%, 100% 0, 100% 75%, 0 100%);
    z-index: -1;
  }

  h1 {
    display: flex;
    flex-direction: column;
    margin: 0;
    font-size: clamp(2.2rem, 4.6vw, 5.4rem);
    line-height: 1.04;

    // One sentence per line, like a title screen
    span {
      white-space: nowrap;
    }
  }

  .art {
    position: relative;
    display: grid;
    place-items: center;

    // Fire glow behind the logo
    &::before {
      content: "";
      position: absolute;
      inset: -15%;
      // Soft glow: it must not blur the title next to it
      background: radial-gradient(closest-side, rgba(255, 122, 47, 0.14), rgba(255, 122, 47, 0.03) 60%, transparent);
      z-index: -1;
    }

    img {
      width: min(100%, 560px);
      height: auto;
      filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.45));
    }
  }
}

.coin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
  width: calc(100% - 3rem);
  max-width: 1200px;
  box-sizing: border-box;
  margin: 0 auto 6rem;
  padding: 3rem 4rem;
  background: var(--accent);
  // Arcade cabinet cut corner
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 36px), calc(100% - 36px) 100%, 0 100%);

  h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(3rem, 6vw, 5rem);
    font-weight: 400;
    letter-spacing: 0;
    color: var(--on-accent);
  }
}

.coin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.coin-btn {
  padding: 1rem 2.4rem;
  font-family: var(--font-condensed);
  font-size: 1.35rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 2px solid var(--on-accent);
  transition: transform 0.1s;

  &:hover {
    text-decoration: none;
    transform: translateY(-2px);
  }

  &.dark {
    background: var(--on-accent);
    color: var(--yellow);

    &:hover {
      color: var(--yellow);
    }
  }

  &.outline {
    color: var(--on-accent);

    &:hover {
      color: var(--on-accent);
      background: rgba(0, 0, 0, 0.08);
    }
  }
}

// ------------------------------------------------------------------ logged-in home
.main {
  width: 100%;
  max-width: 1200px;
  box-sizing: border-box;
  margin: 2.5rem auto 4rem;
  padding: 0 1.5rem;
}

.intro {
  margin-bottom: 2.5rem;

  h1 {
    margin: 0;
    font-size: clamp(2.6rem, 5vw, 4rem);
  }

  p {
    margin: 0.4rem 0 0;
    font-family: var(--font-condensed);
    font-size: 1.2rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
}

.pending {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 2rem;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-left: 5px solid var(--yellow);

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.4rem;
  }

  p {
    margin: 0 0 1.25rem;
    line-height: 1.5;
    color: var(--muted);
  }

  .info {
    margin: 0.75rem 0 0;
    font-size: 0.9rem;
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
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-strong);
  text-decoration: none;
  transition: transform 0.15s, border-color 0.15s, background-color 0.15s;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--accent-border);
    border-left-color: var(--accent);
    background-color: var(--surface-2);
    text-decoration: none;

    .arrow {
      color: var(--accent);
      transform: translateX(3px);
    }
  }

  &:focus-visible {
    outline: 3px solid var(--yellow);
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
  border-radius: var(--radius);

  &.blue { background-color: rgba(96, 165, 250, 0.14); color: #7db6ff; }
  &.green { background-color: rgba(52, 211, 153, 0.14); color: #4ade9b; }
  &.orange { background-color: var(--accent-soft); color: #ff7a3d; }
  &.violet { background-color: rgba(167, 139, 250, 0.16); color: #bba7ff; }
  &.red { background-color: rgba(255, 77, 94, 0.14); color: #ff6b7a; }
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 0;
}

.title {
  font-family: var(--font-condensed);
  font-size: 1.35rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text);
}

.description {
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.45;
  color: var(--muted);
}

.arrow {
  flex-shrink: 0;
  color: var(--border-strong);
  transition: color 0.15s, transform 0.15s;
}

@media (max-width: 760px) {
  .hero {
    grid-template-columns: 1fr;
    padding-bottom: 4rem;

    .art {
      order: -1;
    }
  }

  .coin {
    padding: 2rem 1.5rem;
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
