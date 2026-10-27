<template>
  <div class="filters">
    <button
      v-for="filter in filters"
      :key="filter.key"
      class="btn"
      :class="filter.key === activeCategory ? 'btn-primary' : 'btn-secondary'"
      @click="activeCategory = filter.key"
    >
      {{ filter.label }}
    </button>
  </div>

  <section v-for="group in visibleGroups" :key="group.key" class="main">
    <h2>{{ group.label }}</h2>

    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="move">Coup</th>
            <th>Startup</th>
            <th>Active</th>
            <th>Recovery</th>
            <th>Hit</th>
            <th>Garde</th>
            <th>Cancel</th>
            <th>Dégâts</th>
            <th>Propriétés</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="move in group.moves" :key="move.order">
            <tr class="move-row" :class="{ open: expanded.has(move.order) }" @click="toggle(move.order)">
              <td class="move">
                <button class="toggle" :aria-expanded="expanded.has(move.order)">
                  <span class="chevron">›</span>
                  <span class="name">{{ move.name }}</span>
                </button>
                <span class="command">{{ move.command }}</span>
              </td>
              <td>{{ move.startup }}</td>
              <td>{{ move.active }}</td>
              <td>{{ move.recovery }}</td>
              <td :class="advantageClass(move.on_hit)">{{ signed(move.on_hit) }}</td>
              <td :class="advantageClass(move.on_block)">{{ signed(move.on_block) }}</td>
              <td>{{ move.cancel }}</td>
              <td>{{ move.damage }}</td>
              <td>{{ move.properties }}</td>
            </tr>
            <tr v-if="expanded.has(move.order)" class="details-row">
              <td colspan="9">
                <dl>
                  <template v-for="detail in details(move)" :key="detail.label">
                    <dt>{{ detail.label }}</dt>
                    <dd>{{ detail.value }}</dd>
                  </template>
                </dl>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>


<script setup>
import { computed, ref } from "vue"
import { CATEGORY_LABELS, advantageClass, signed } from "@/utils/moves"

const props = defineProps({
  moves: { type: Array, required: true },
})

const activeCategory = ref("all")
const expanded = ref(new Set())

const groups = computed(() =>
  Object.entries(CATEGORY_LABELS)
    .map(([key, label]) => ({ key, label, moves: props.moves.filter((m) => m.category === key) }))
    .filter((group) => group.moves.length)
)

const filters = computed(() => [{ key: "all", label: "Tous" }, ...groups.value])

const visibleGroups = computed(() =>
  activeCategory.value === "all" ? groups.value : groups.value.filter((g) => g.key === activeCategory.value)
)

const toggle = (id) => {
  if (!expanded.value.delete(id)) expanded.value.add(id)
}

const details = (move) =>
  [
    { label: "Active (détail)", value: move.active_detail },
    { label: "Combo scaling", value: move.combo_scaling },
    { label: "Jauge Drive (hit)", value: move.drive_gain_hit },
    { label: "Jauge Drive (garde)", value: move.drive_loss_block },
    { label: "Jauge Drive (punish counter)", value: move.drive_loss_punish },
    { label: "Jauge Super Art", value: move.sa_gain },
    { label: "Notes", value: move.notes },
  ].filter((detail) => detail.value !== null && detail.value !== "")
</script>

<style lang="scss" scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.main {
  box-sizing: border-box;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  background-color: white;
  border-radius: 15px;
  border: 1px solid #e5e9f0;
  width: 100%;

  h2 {
    margin-block: 0 1rem;
    font-size: 1.3em;
  }
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

th,
td {
  padding: 0.6rem 0.75rem;
  text-align: center;
  white-space: nowrap;
  border-bottom: 1px solid #e5e9f0;
}

th {
  font-size: 0.85em;
  font-weight: 700;
  color: #5c626c;
  background-color: #f9fafd;
}

.move {
  text-align: left;
}

td.move {
  white-space: normal;
  min-width: 240px;
}

.move-row {
  cursor: pointer;

  &:hover,
  &.open {
    background-color: #f9fafd;
  }

  &.open .chevron {
    transform: rotate(90deg);
  }
}

.toggle {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  .chevron {
    display: inline-block;
    color: #5c626c;
    transition: transform 0.15s ease;
  }

  .name {
    font-weight: 700;
    color: oklch(0.27 0.02 265);
  }
}

.command {
  display: block;
  margin-top: 0.2rem;
  padding-left: 0.9rem;
  font-size: 0.9em;
  color: #5c626c;
}

.plus {
  font-weight: 700;
  color: #27905C;
}

.minus {
  font-weight: 700;
  color: #C62525;
}

.details-row td {
  padding: 1rem 1.5rem;
  text-align: left;
  white-space: normal;
  background-color: #f9fafd;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.4rem 1.5rem;
  margin: 0;
}

dt {
  font-weight: 700;
  color: oklch(0.27 0.02 265);
}

dd {
  margin: 0;
  white-space: pre-line;
}
</style>
