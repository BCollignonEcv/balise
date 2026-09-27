<script setup lang="ts">
import { LayoutGrid, List } from '@lucide/vue'

const { game, me } = usePlayerSession()

/* Affichage grille ou liste : mémorisé sur ce téléphone (confort, sans garantie de stockage). */
const LAYOUT_KEY = 'balise-missions-layout'
const layout = ref<'grid' | 'list'>('grid')
onMounted(() => {
  try {
    if (localStorage.getItem(LAYOUT_KEY) === 'list') layout.value = 'list'
  }
  catch { /* stockage indisponible (navigation privée…) */ }
})
function setLayout(value: 'grid' | 'list') {
  layout.value = value
  try {
    localStorage.setItem(LAYOUT_KEY, value)
  }
  catch { /* idem */ }
}
const { data } = usePlayerGameData()
const { gameOver, notStarted } = useGameClock()

type Filter = 'all' | 'todo' | 'validated'
// useState : le filtre est conservé en revenant d'une mission
const filter = useState<Filter>('missions-filter', () => 'all')

const cards = computed(() =>
  data.value.missions.map(mission => ({
    mission,
    progress: missionProgress(mission, data.value.submissions, gameOver.value),
  })),
)

const counts = computed(() => ({
  all: cards.value.length,
  todo: cards.value.filter(c => c.progress.status === 'todo').length,
  validated: cards.value.filter(c => c.progress.status === 'validated').length,
}))

const visible = computed(() =>
  filter.value === 'all' ? cards.value : cards.value.filter(c => c.progress.status === filter.value),
)

const score = computed(() => teamScore(data.value.missions, data.value.submissions, data.value.adjustments))

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'todo', label: 'À faire' },
  { value: 'validated', label: 'Validées' },
]
</script>

<template>
  <main v-if="game && me" class="player-page">
    <PlayerHeader :me="me">
      <template #aside>
        <PlayerRankPill :team-id="me.team_id" :to="`/j/${game.code}/classement`" />
      </template>
    </PlayerHeader>

    <PlayerCountdown />

    <p v-if="gameOver" class="notice">
      La partie est terminée : les missions et le classement restent consultables, mais plus aucune réponse ne peut être envoyée.
    </p>
    <p v-else-if="notStarted" class="notice">Le jeu n’a pas encore commencé : découvre les missions en attendant !</p>

    <PlayerScoreCard :score="score" />

    <div class="toolbar">
      <div class="filters" role="tablist" aria-label="Filtrer les missions">
        <button
          v-for="f in filters"
          :key="f.value"
          type="button"
          role="tab"
          class="filter"
          :class="{ 'is-active': filter === f.value }"
          :aria-selected="filter === f.value"
          @click="filter = f.value"
        >
          {{ f.label }} · {{ counts[f.value] }}
        </button>
      </div>
      <div class="layout-toggle" role="group" aria-label="Affichage des missions">
        <button type="button" :class="{ 'is-active': layout === 'grid' }" :aria-pressed="layout === 'grid'" aria-label="Grille" @click="setLayout('grid')">
          <LayoutGrid :size="18" aria-hidden="true" />
        </button>
        <button type="button" :class="{ 'is-active': layout === 'list' }" :aria-pressed="layout === 'list'" aria-label="Liste" @click="setLayout('list')">
          <List :size="18" aria-hidden="true" />
        </button>
      </div>
    </div>

    <p v-if="data.error" class="form-error" role="alert">{{ data.error }}</p>
    <p v-else-if="!data.loaded" class="muted">Chargement des missions…</p>
    <p v-else-if="!cards.length" class="muted">Aucune mission pour l’instant.</p>
    <p v-else-if="!visible.length" class="muted">
      {{ filter === 'todo' ? 'Plus aucune mission à faire. Bravo !' : 'Aucune mission validée pour l’instant.' }}
    </p>

    <div v-else :class="layout === 'list' ? 'list' : 'grid'">
      <MissionCard
        :layout="layout"
        v-for="{ mission, progress } in visible"
        :key="mission.id"
        :to="`/j/${game.code}/missions/${mission.id}`"
        :title="mission.title"
        :base-points="mission.base_points"
        :answer-types="mission.answer_types"
        :status="progress.status"
        :image-url="assetUrl(mission.image_path)"
        :has-bonus="!!mission.bonus_label"
        :validated-count="progress.validatedCount"
        :max-validations="mission.max_validations"
        :last-refused="progress.lastRefused"
      />
    </div>

    <PlayerTabBar :code="game.code" />
  </main>
</template>

<style scoped>
.player-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4) calc(96px + env(safe-area-inset-bottom, 0px));
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
  font-weight: 600;
}

.muted {
  padding: var(--space-6) 0;
  color: var(--color-text-muted);
  text-align: center;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filters {
  display: flex;
  flex: 1;
  gap: var(--space-2);
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.layout-toggle {
  display: flex;
  flex: none;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}

.layout-toggle button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 36px;
  border: none;
  border-radius: var(--radius-pill);
  background: none;
  color: var(--color-text-muted);
}

.layout-toggle button.is-active {
  background: var(--color-text);
  color: var(--color-surface);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filter {
  flex: none;
  min-height: var(--tap-min);
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font-weight: 600;
}

.filter.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
