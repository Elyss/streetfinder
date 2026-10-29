<template>
  <div class="overlay" @pointerdown.self="emit('close')">
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <header>
        <h2 id="help-title">Raccourcis clavier</h2>
        <button type="button" aria-label="Fermer" @click="emit('close')"><Icon name="close" /></button>
      </header>
      <div class="cols">
        <div v-for="group in GROUPS" :key="group.title">
          <h3>{{ group.title }}</h3>
          <dl>
            <template v-for="[keys, label] in group.items" :key="label">
              <dt><kbd v-for="k in keys.split(' + ')" :key="k">{{ k }}</kbd></dt>
              <dd>{{ label }}</dd>
            </template>
          </dl>
        </div>
      </div>
      <p class="tip">Astuce : survolez un objet et cliquez sur l'une des flèches « + » pour créer un objet relié, déjà aligné.</p>
    </section>
  </div>
</template>

<script setup>
import Icon from "@/components/Icon.vue"

const emit = defineEmits(["close"])
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"

const GROUPS = [
  {
    title: "Outils",
    items: [
      ["V", "Sélection"], ["H", "Main (déplacement)"], ["R", "Rectangle"], ["O", "Ellipse"], ["D", "Losange"],
      ["S", "Sticky note"], ["T", "Texte"], ["L", "Connecteur"], ["F", "Cadre"], ["G", "Tableau"], ["I", "Image"],
    ],
  },
  {
    title: "Édition",
    items: [
      [`${mod} + Z`, "Annuler"], [`${mod} + Maj + Z`, "Rétablir"], [`${mod} + C`, "Copier"], [`${mod} + X`, "Couper"],
      [`${mod} + V`, "Coller"], [`${mod} + Maj + V`, "Coller à l'emplacement d'origine"], [`${mod} + D`, "Dupliquer"],
      [`${mod} + Alt + C`, "Copier le style"], [`${mod} + Alt + V`, "Coller le style"],
      ["Suppr", "Supprimer"], ["Entrée", "Éditer le texte"], ["Tab / Maj + Tab", "Cellule suivante / précédente (tableau)"], ["Suppr", "Supprimer la colonne / ligne choisie par sa poignée (tableau)"], ["Échap", "Désélectionner / quitter l'édition"],
    ],
  },
  {
    title: "Organisation",
    items: [
      [`${mod} + A`, "Tout sélectionner"], [`${mod} + G`, "Grouper"], [`${mod} + Maj + G`, "Dégrouper"],
      [`${mod} + Maj + L`, "Verrouiller / déverrouiller"], [`${mod} + ]`, "Avancer"], [`${mod} + [`, "Reculer"],
      [`${mod} + Maj + ]`, "Premier plan"], [`${mod} + Maj + [`, "Arrière-plan"],
      ["Flèches", "Déplacer de 1 px"], ["Maj + Flèches", "Déplacer de 10 px"], ["Alt (maintenu)", "Désactiver le magnétisme"],
      ["Maj + redimensionner", "Conserver les proportions"],
    ],
  },
  {
    title: "Navigation",
    items: [
      ["Espace + glisser", "Se déplacer"], [`${mod} + molette`, "Zoomer"], ["Maj + 1", "Tout afficher"], ["Maj + 2", "Zoom sur la sélection"],
      [`${mod} + 0`, "Zoom 100 %"], [`${mod} + +`, "Zoom avant"], [`${mod} + -`, "Zoom arrière"], [`${mod} + F`, "Rechercher"], ["?", "Cette aide"],
    ],
  },
]
</script>

<style scoped lang="scss">
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(27, 36, 51, 0.35);
}

.panel {
  width: min(900px, 100%);
  max-height: calc(100vh - 32px);
  overflow: auto;
  background: var(--surface);
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: 0 20px 60px rgba(27, 36, 51, 0.25);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: 1.3em;
  }

  button {
    border: 0;
    background: none;
    cursor: pointer;
    color: var(--muted);
  }
}

.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 20px;
  margin-top: 12px;
}

h3 {
  font-size: 0.78em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 8px 0;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 10px;
  margin: 0;
  font-size: 0.85em;
}

dt {
  white-space: nowrap;
}

dd {
  margin: 0;
  color: var(--text);
}

kbd {
  display: inline-block;
  min-width: 18px;
  padding: 1px 5px;
  margin-right: 2px;
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.85em;
  text-align: center;
  background: var(--bg-2);
}

.tip {
  margin: 18px 0 0;
  font-size: 0.85em;
  color: var(--muted);
}
</style>
