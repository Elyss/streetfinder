<template>
  <!-- SF6 notation: icons inserted at the caret, by click or from the controller -->
  <div class="input-palette" :class="`on-${shown}`">
    <!-- Icon set: follows the text color (auto), or forced -->
    <div class="variant" role="radiogroup" aria-label="Couleur des icônes">
      <span>Icônes</span>
      <button v-for="(label, v) in VARIANT_LABELS" :key="v" type="button" role="radio" :aria-checked="variant === v"
        :class="{ active: variant === v }" :title="VARIANT_TITLES[v]" @click="setVariant(v)">{{ label }}</button>
    </div>
    <div class="groups">
      <div class="group">
        <p class="popover-title">Directions</p>
        <div class="grid dirs">
          <button v-for="i in DIRECTIONS" :key="i.key" type="button" :title="i.label" @click="insert(i.key)">
            <img :src="inputSrc(i.key)" :alt="i.alt" /><small>{{ i.notation || i.alt }}</small>
          </button>
        </div>
      </div>
      <div class="group">
        <p class="popover-title">Classique</p>
        <div class="grid buttons">
          <button v-for="i in CLASSIC" :key="i.key" type="button" :title="i.label" @click="insert(i.key)">
            <img :src="inputSrc(i.key)" :alt="i.alt" /><small>{{ i.notation || i.alt }}</small>
          </button>
        </div>
        <p class="popover-title">Moderne</p>
        <div class="grid buttons">
          <button v-for="i in MODERN" :key="i.key" type="button" :title="i.label" @click="insert(i.key)">
            <img :src="inputSrc(i.key)" :alt="i.alt" /><small>{{ i.notation || i.alt }}</small>
          </button>
        </div>
        <p class="popover-title">Drive · Super</p>
        <div class="grid buttons">
          <button v-for="i in [...DRIVE, ...SUPERS]" :key="i.key" type="button" :title="i.label" @click="insert(i.key)">
            <img :src="inputSrc(i.key)" :alt="i.alt" /><small>{{ i.notation || i.alt }}</small>
          </button>
          <button v-for="t in SEPARATORS" :key="t" type="button" class="sep-key" :title="`Insérer « ${t.trim()} »`"
            @click="emit('insert', t)">{{ t.trim() }}</button>
        </div>
      </div>
    </div>

    <p class="popover-title dragon-title">Dragon punch</p>
    <div class="grid dragon">
      <button v-for="i in DRAGON" :key="i.key" type="button" :title="i.label" @click="insert(i.key)">
        <img :src="inputSrc(i.key)" :alt="i.alt" /><small>{{ i.notation || i.alt }}</small>
      </button>
    </div>

    <!-- Leverless / stick: each step played is written as icons -->
    <div class="pad" :class="{ on: !!pad.selected.value }">
      <template v-if="!pad.supported">Manette non prise en charge par ce navigateur.</template>
      <template v-else-if="!pad.selected.value">Branche ta manette (leverless, stick…) et appuie sur un bouton pour l'utiliser.</template>
      <template v-else>
        <span class="dot"></span>
        <span class="pad-name" :title="pad.selected.value.id">Manette : joue les inputs, ils s'écrivent dans le texte</span>
        <button type="button" class="side" :title="'Directions lues pour un personnage tourné vers la ' + (facing === 'right' ? 'droite' : 'gauche')"
          @click="facing = facing === 'right' ? 'left' : 'right'">
          {{ facing === "right" ? "P1 →" : "← P2" }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue"
import { useGamepad } from "@/apps/inputbreaker/useGamepad"
import { recordedMotion } from "@/apps/combobuilder/inputs"
import { useStepCapture } from "@/apps/combobuilder/useStepCapture"
import { CLASSIC, DIRECTIONS, DRAGON, DRIVE, MODERN, SUPERS, inputHtml, inputSrc as iconSrc, stepHtml } from "../lib/inputs"
import { boardTheme } from "../lib/theme"

const emit = defineEmits(["insert"])

const SEPARATORS = [" + ", " > ", ", "]

// Same names as the icon set: "Claire" for dark backgrounds, "Sombre" for white backgrounds
const VARIANT_LABELS = { auto: "Auto", light: "Claire (fond sombre)", dark: "Sombre (fond blanc)" }
const VARIANT_TITLES = {
  auto: "Suit la couleur du texte : sombre sur fond clair, claire sur fond sombre",
  light: "Toujours le jeu clair, fait pour les fonds sombres",
  dark: "Toujours le jeu sombre, fait pour les fonds blancs",
}
const VARIANT_KEY = "boards.iconVariant"
const readVariant = () => {
  try {
    return VARIANT_LABELS[localStorage.getItem(VARIANT_KEY)] ? localStorage.getItem(VARIANT_KEY) : "auto"
  } catch {
    return "auto"
  }
}
const variant = ref(readVariant())
function setVariant(v) {
  variant.value = v
  try {
    localStorage.setItem(VARIANT_KEY, v)
  } catch {
    // Private browsing: kept for the session
  }
}
const forced = computed(() => (variant.value === "auto" ? null : variant.value))
// Set shown in the palette: the forced one, or the one matching the palette background
const shown = computed(() => forced.value || (boardTheme.dark ? "light" : "dark"))
const inputSrc = (key) => iconSrc(key, shown.value)

const insert = (key) => emit("insert", inputHtml(key, forced.value))

const pad = useGamepad()
const facing = ref("right")

useStepCapture(pad, facing, {
  active: () => true,
  onStep(g) {
    emit("insert", `${stepHtml(recordedMotion(g.changes, g.held), g.buttons, forced.value)} `)
  },
})
</script>

<style scoped lang="scss">
.input-palette {
  padding: 6px 4px 4px;
  width: 300px;
  white-space: normal;

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;

    &:hover {
      background: var(--surface-2);
    }
  }
}

.popover-title {
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
}

.variant {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  margin: 0 4px 6px;
  font-size: 0.8em;

  span {
    flex-basis: 100%;
    margin-bottom: 2px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--muted);
  }

  button {
    padding: 3px 7px;
    border-radius: 6px;
    background: var(--surface-2);

    &.active {
      background: var(--accent-soft);
      color: var(--accent-hover);
      font-weight: 700;
    }
  }
}

// Forced set shown on a background where it reads (sombres: light, claires: dark)
.on-dark .grid button:not(.sep-key) {
  background: #f1f3f6;

  small {
    color: #5c626c;
  }
}

.on-light .grid button:not(.sep-key) {
  background: #2e333d;

  small {
    color: #c9cdd6;
  }
}

.on-dark .grid button:not(.sep-key):hover,
.on-light .grid button:not(.sep-key):hover {
  box-shadow: 0 0 0 2px var(--accent) inset;
}

.groups {
  display: flex;
  gap: 10px;
}

.group .popover-title,
.dragon-title {
  margin: 4px 4px;
}

.dragon-title {
  margin-top: 8px;
}

.grid {
  display: grid;
  gap: 2px;
  padding: 0 4px;

  &.dirs {
    grid-template-columns: repeat(3, 34px);
  }

  &.buttons {
    grid-template-columns: repeat(4, 34px);
  }

  // Wide icons (motion + button)
  &.dragon {
    grid-template-columns: repeat(4, 66px);

    button {
      width: 66px;
    }

    img {
      width: 58px;
      object-fit: contain;
    }
  }

  button {
    width: 34px;
    height: 46px;
    padding: 3px 3px 2px;
    border-radius: 7px;
    flex-direction: column;
    gap: 1px;
  }

  img {
    width: 28px;
    height: 28px;
    display: block;
    flex: none;
  }

  // Notation under the icon
  small {
    font-size: 9.5px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.02em;
    color: var(--muted);
    white-space: nowrap;
  }
}

.sep-key {
  height: 46px;
  font-weight: 800;
  font-size: 1.25em;
  color: var(--text) !important;
  background: var(--surface-2) !important;
}

.pad {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 4px 2px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--bg-2);
  color: var(--muted);
  font-size: 0.85em;
  line-height: 1.3;

  &.on {
    background: var(--success-soft);
    color: var(--success);
  }
}

.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
}

.pad-name {
  flex: 1;
}

.side {
  flex: none;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 0.95em;
  background: var(--surface) !important;
}
</style>
