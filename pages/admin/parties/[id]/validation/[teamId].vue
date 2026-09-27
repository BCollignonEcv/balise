<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const gameId = route.params.id as string

const {
  game, teams, missions, submissions, adjustments, loading, error,
  missionById, teamById, pendingCount, scoreOf,
  review, deleteSubmission, addAdjustment, deleteAdjustment,
} = useAdminReview(gameId)

// Changer d'équipe ne recharge pas la page : les données de la partie restent en mémoire.
const teamId = computed(() => route.params.teamId as string)
const team = computed(() => teamById.value.get(teamId.value) ?? null)
const teamIndex = computed(() => teams.value.findIndex(t => t.id === teamId.value))

useHead(() => ({ title: `${team.value?.name ?? 'Équipe'} · Validation · Admin Balise` }))

function goToTeam(offset: number) {
  if (!teams.value.length) return
  const next = teams.value[(teamIndex.value + offset + teams.value.length) % teams.value.length]!
  router.replace(`/admin/parties/${gameId}/validation/${next.id}`)
}

/** Prochaine équipe ayant des réponses à traiter (sinon simplement la suivante). */
const nextPendingTeam = computed(() => {
  const n = teams.value.length
  for (let i = 1; i < n; i++) {
    const t = teams.value[(teamIndex.value + i) % n]!
    if (pendingCount(t.id) > 0) return t
  }
  return null
})

const clock = ref(Date.now())
const timer = setInterval(() => (clock.value = Date.now()), 30000)
onBeforeUnmount(() => clearInterval(timer))
const gameOver = computed(() => !!game.value && (game.value.status === 'finished' || clock.value >= new Date(game.value.deadline_at).getTime()))

const subtitle = computed(() => {
  if (!game.value) return ''
  const deadline = new Date(game.value.deadline_at).getTime()
  return gameOver.value
    ? `Réponses closes depuis ${formatDeadline(game.value.deadline_at, clock.value)}`
    : `Fin des réponses ${formatDeadline(game.value.deadline_at, clock.value)} · dans ${formatCountdown(deadline - clock.value)}`
})

/* ---- Soumissions de l'équipe ---- */
type Filter = 'pending' | 'validated' | 'refused' | 'all'
const filter = ref<Filter>('all')

const teamSubmissions = computed(() => submissions.value.filter(s => s.team_id === teamId.value))
const counts = computed(() => ({
  pending: teamSubmissions.value.filter(needsReview).length,
  validated: teamSubmissions.value.filter(s => s.status === 'validated').length,
  refused: teamSubmissions.value.filter(s => s.status === 'refused').length,
  all: teamSubmissions.value.length,
}))

// À l'arrivée sur une équipe : on montre d'abord ce qui est à traiter.
watch([teamId, loading], () => {
  if (!loading.value) filter.value = counts.value.pending ? 'pending' : 'all'
}, { immediate: true })

const visible = computed(() => {
  const list = teamSubmissions.value.filter((s) => {
    if (filter.value === 'pending') return needsReview(s)
    if (filter.value === 'all') return true
    return s.status === filter.value
  })
  // À traiter : les plus anciennes d'abord ; sinon les plus récentes d'abord.
  return filter.value === 'pending' ? [...list].reverse() : list
})

const missionsWithoutAnswer = computed(() => {
  const answered = new Set(teamSubmissions.value.map(s => s.mission_id))
  return missions.value.filter(m => !answered.has(m.id))
})

const filters: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Validées' },
  { value: 'refused', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
]
</script>

<template>
  <div class="page">
    <AdminTopBar
      :title="game?.name ?? 'Validation'"
      :subtitle="subtitle"
      :back="{ to: `/admin/parties/${gameId}/soumissions`, label: 'Toutes les soumissions' }"
    >
      <template v-if="game" #aside>
        <AdminGameStatusPill :status="game.status" />
      </template>
    </AdminTopBar>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="!team" class="empty">Équipe introuvable.</p>

    <template v-else>
      <!-- Sélecteur d'équipe -->
      <nav class="switcher" aria-label="Changer d’équipe">
        <button type="button" class="switcher__btn" aria-label="Équipe précédente" :disabled="teams.length < 2" @click="goToTeam(-1)">
          <ChevronLeft :size="22" aria-hidden="true" />
        </button>
        <div class="switcher__current">
          <span class="switcher__name"><span class="dot" :style="{ background: team.color }" /> {{ team.name }}</span>
          <span class="switcher__pending" :class="{ 'is-zero': !counts.pending }">
            {{ counts.pending ? `${counts.pending} en attente` : 'Rien en attente' }}
          </span>
        </div>
        <button type="button" class="switcher__btn" aria-label="Équipe suivante" :disabled="teams.length < 2" @click="goToTeam(1)">
          <ChevronRight :size="22" aria-hidden="true" />
        </button>
      </nav>

      <div class="team-chips">
        <NuxtLink
          v-for="t in teams"
          :key="t.id"
          :to="`/admin/parties/${gameId}/validation/${t.id}`"
          replace
          class="team-chip"
          :class="{ 'is-active': t.id === teamId }"
        >
          <span class="dot" :style="{ background: t.color }" /> {{ t.name }}
          <span v-if="pendingCount(t.id)" class="team-chip__count">{{ pendingCount(t.id) }}</span>
        </NuxtLink>
      </div>

      <AdminTeamScorePanel
        :score="scoreOf(team.id)"
        :adjustments="adjustments.filter(a => a.team_id === team!.id)"
        :add="(points, reason) => addAdjustment(team!.id, points, reason)"
        :remove="deleteAdjustment"
      />

      <div class="filters" role="tablist" aria-label="Filtrer les réponses">
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
          {{ f.label }}<template v-if="f.value !== 'all'"> · {{ counts[f.value] }}</template>
        </button>
      </div>

      <p v-if="!visible.length" class="empty">
        {{ filter === 'pending' ? 'Tout est traité pour cette équipe.' : 'Aucune réponse.' }}
      </p>

      <AdminSubmissionCard
        v-for="s in visible"
        :key="s.id"
        :submission="s"
        :mission="missionById.get(s.mission_id)!"
        :review="review"
        :remove="deleteSubmission"
      />

      <AppButton v-if="filter === 'pending' && !counts.pending && nextPendingTeam" variant="dark" block @click="router.replace(`/admin/parties/${gameId}/validation/${nextPendingTeam.id}`)">
        Équipe suivante à traiter : {{ nextPendingTeam.name }} <ChevronRight :size="18" aria-hidden="true" />
      </AppButton>

      <section v-if="missionsWithoutAnswer.length" class="panel">
        <h2 class="panel__title">Missions sans réponse · {{ missionsWithoutAnswer.length }}</h2>
        <ul class="no-answer">
          <li v-for="m in missionsWithoutAnswer" :key="m.id">
            <span>{{ m.title }}</span>
            <StatusBadge :status="gameOver ? 'refused' : 'todo'" />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
  margin: 0 auto;
  padding: 0 var(--space-4) var(--space-8);
}

.empty {
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.dot {
  display: inline-block;
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.switcher {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.switcher__btn {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--tap-min);
  height: var(--tap-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.switcher__current {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.switcher__name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 1.25rem;
  font-weight: 700;
}

.switcher__pending {
  color: var(--status-pending-fg);
  font-size: 0.875rem;
  font-weight: 600;
}

.switcher__pending.is-zero {
  color: var(--admin-live-fg);
}

.team-chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;
}

.team-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
}

.team-chip.is-active {
  border-color: var(--color-text);
}

.team-chip__count {
  padding: 0 6px;
  border-radius: var(--radius-pill);
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
  font-size: 0.75rem;
}

.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.filter {
  min-height: var(--tap-min);
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-size: 0.875rem;
  font-weight: 600;
}

.filter.is-active {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.panel__title {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 700;
}

.no-answer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.no-answer li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
</style>
