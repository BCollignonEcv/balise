<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const gameId = route.params.id as string

const {
  game, teams, missions, submissions, loading, error,
  missionById, teamById, pendingCount, scoreOf,
  review, deleteSubmission,
} = useAdminReview(gameId)

useHead(() => ({ title: `Soumissions · ${game.value?.name ?? 'Partie'} · Admin Balise` }))

type StatusFilter = 'pending' | 'validated' | 'refused' | 'all'
const status = ref<StatusFilter>('pending')
const teamFilter = ref<string>('')
const missionFilter = ref<string>('')

const visible = computed(() =>
  submissions.value.filter((s) => {
    if (teamFilter.value && s.team_id !== teamFilter.value) return false
    if (missionFilter.value && s.mission_id !== missionFilter.value) return false
    if (status.value === 'pending') return needsReview(s)
    if (status.value === 'all') return true
    return s.status === status.value
  }),
)

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'En attente' },
  { value: 'validated', label: 'Validées' },
  { value: 'refused', label: 'Refusées' },
  { value: 'all', label: 'Toutes' },
]
</script>

<template>
  <div class="page">
    <AdminTopBar
      title="Soumissions"
      :subtitle="game ? `${game.name} · en direct` : undefined"
      :back="{ to: `/admin/parties/${gameId}`, label: game?.name ?? 'Partie' }"
    />

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Chargement…</p>

    <template v-else>
      <!-- Validation par équipe -->
      <section class="panel">
        <h2 class="panel__title">Validation par équipe</h2>
        <p v-if="!teams.length" class="muted">Aucune équipe dans cette partie.</p>
        <ul class="teams">
          <li v-for="t in teams" :key="t.id">
            <NuxtLink :to="`/admin/parties/${gameId}/validation/${t.id}`" class="team">
              <span class="dot" :style="{ background: t.color }" />
              <span class="team__name">{{ t.name }}</span>
              <span class="team__score">{{ scoreOf(t.id).total }} pts</span>
              <span class="team__pending" :class="{ 'is-zero': !pendingCount(t.id) }">
                {{ pendingCount(t.id) ? `${pendingCount(t.id)} en attente` : 'à jour' }}
              </span>
              <ChevronRight :size="18" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Filtres -->
      <div class="filters">
        <select v-model="status" class="input" aria-label="Statut">
          <option v-for="o in statusOptions" :key="o.value" :value="o.value">
            {{ o.label }}<template v-if="o.value === 'pending'"> ({{ pendingCount() }})</template>
          </option>
        </select>
        <select v-model="teamFilter" class="input" aria-label="Équipe">
          <option value="">Toutes les équipes</option>
          <option v-for="t in teams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <select v-model="missionFilter" class="input" aria-label="Mission">
          <option value="">Toutes les missions</option>
          <option v-for="m in missions" :key="m.id" :value="m.id">{{ m.title }}</option>
        </select>
      </div>

      <p class="muted">{{ visible.length }} réponse{{ visible.length > 1 ? 's' : '' }}</p>

      <p v-if="!visible.length" class="empty">
        {{ status === 'pending' ? 'Rien à traiter pour le moment.' : 'Aucune réponse ne correspond à ces filtres.' }}
      </p>

      <AdminSubmissionCard
        v-for="s in visible"
        :key="s.id"
        :submission="s"
        :mission="missionById.get(s.mission_id)!"
        :team="teamById.get(s.team_id)"
        :review="review"
        :remove="deleteSubmission"
      />
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

.muted {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.panel__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.teams {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.team {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  text-decoration: none;
}

.teams li:last-child .team {
  border-bottom: none;
}

.dot {
  flex: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.team__name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.team__score {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.team__pending {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.team__pending.is-zero {
  background: none;
  color: var(--admin-live-fg);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
}
</style>
