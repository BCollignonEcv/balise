<script setup lang="ts">
import { ChevronLeft, MapPin } from '@lucide/vue'
import type { TeamSubmission } from '~/types/database'
import type { SubmitResult } from '~/composables/useSubmitAnswer'

const route = useRoute()
const { game, me } = usePlayerSession()
const { data } = usePlayerGameData()
const { gameOver, notStarted } = useGameClock()

const missionId = computed(() => route.params.missionId as string)
const mission = computed(() => data.value.missions.find(m => m.id === missionId.value) ?? null)
const history = computed(() =>
  data.value.submissions
    .filter(s => s.mission_id === missionId.value)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)),
)
const progress = computed(() => (mission.value ? missionProgress(mission.value, data.value.submissions, gameOver.value) : null))

useHead(() => ({ title: mission.value ? `${mission.value.title} · Jeu de piste` : 'Mission' }))

const backUrl = computed(() => `/j/${game.value?.code}/missions`)

/** Pourquoi on ne peut pas (encore / plus) répondre, ou null si l'envoi est possible. */
const closedReason = computed(() => {
  if (!progress.value) return null
  if (gameOver.value) return 'La partie est terminée : plus aucune réponse ne peut être envoyée.'
  if (notStarted.value) return 'Le jeu n’a pas encore commencé.'
  if (progress.value.completed) {
    return mission.value!.max_validations > 1
      ? `Bravo ! Nombre maximum de validations atteint (${mission.value!.max_validations}).`
      : 'Mission validée, bravo !'
  }
  if (progress.value.pendingCount > 0 && mission.value!.max_validations - progress.value.validatedCount <= progress.value.pendingCount) {
    return 'Ta réponse est en attente de validation par l’organisateur.'
  }
  return null
})

/* ---- Résultat du dernier envoi ---- */
const gameData = usePlayerGameData()
const result = ref<{ tone: 'validated' | 'refused' | 'pending'; title: string; lines: string[] } | null>(null)

function onSubmitted(r: SubmitResult) {
  const m = mission.value!
  if (r.status === 'validated') {
    result.value = {
      tone: 'validated',
      title: `Réponse validée ! +${m.base_points} pts`,
      lines: r.bonus_pending ? ['Le bonus sera vérifié par l’organisateur.'] : [],
    }
  }
  else if (r.status === 'refused') {
    const lines: string[] = []
    if (r.wrong_text) lines.push('Ce n’est pas la bonne réponse.')
    if (r.too_far) lines.push('Tu n’es pas dans la zone de la mission.')
    lines.push('Tu peux réessayer.')
    result.value = { tone: 'refused', title: 'Réponse refusée', lines }
  }
  else {
    result.value = {
      tone: 'pending',
      title: 'Réponse envoyée !',
      lines: ['Elle est en attente de validation par l’organisateur.'],
    }
  }
  gameData.refresh()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function submissionLabel(s: TeamSubmission) {
  if (s.status === 'validated') return s.auto_validated ? 'Validée automatiquement' : 'Validée'
  if (s.status === 'refused') return 'Refusée'
  return 'En attente'
}

function submissionPointsLabel(s: TeamSubmission) {
  const pts = submissionPoints(s, mission.value ?? undefined)
  if (s.status !== 'validated') return null
  return pts.bonus ? `+${pts.base + pts.bonus} pts (dont ${pts.bonus} de bonus)` : `+${pts.base} pts`
}
</script>

<template>
  <main v-if="game && me" class="detail">
    <div class="detail__top">
      <NuxtLink :to="backUrl" class="detail__back">
        <ChevronLeft :size="22" aria-hidden="true" /> Missions
      </NuxtLink>
      <PlayerCountdown variant="pill" />
    </div>

    <p v-if="!data.loaded" class="muted">Chargement…</p>
    <div v-else-if="!mission" class="muted">
      <p>Cette mission n’existe plus.</p>
      <AppButton :to="backUrl" variant="outline">Retour aux missions</AppButton>
    </div>

    <template v-else-if="progress">
      <div class="detail__media" :class="{ placeholder: !mission.image_path }">
        <img v-if="mission.image_path" :src="assetUrl(mission.image_path)!" alt="">
        <AnswerTypeIcon class="detail__type" :types="mission.answer_types" with-label />
        <StatusBadge
          class="detail__status"
          :status="progress.status"
          :label="progress.status === 'validated' && mission.max_validations > 1 ? `Validée ${progress.validatedCount} / ${mission.max_validations}` : undefined"
        />
      </div>

      <h1 class="detail__title">{{ mission.title }}</h1>
      <p v-if="mission.description" class="detail__description">{{ mission.description }}</p>

      <section class="points">
        <div class="points__row">
          <span class="points__label">Points de base</span>
          <span class="points__value">{{ mission.base_points }} pts</span>
        </div>
        <div v-if="mission.max_validations > 1" class="points__row">
          <div>
            <span class="points__label">Mission répétable</span>
            <p class="points__hint">Jusqu’à {{ mission.max_validations }} validations · {{ progress.validatedCount }} obtenue{{ progress.validatedCount > 1 ? 's' : '' }}</p>
          </div>
          <span class="points__value points__value--small">{{ progress.validatedCount }} / {{ mission.max_validations }}</span>
        </div>
        <div v-if="mission.bonus_label" class="points__row">
          <div>
            <span class="points__label">Bonus</span>
            <p class="points__hint">
              {{ mission.bonus_label }}<template v-if="(mission.bonus_max ?? 1) > 1">, jusqu’à {{ mission.bonus_max }} fois</template>
            </p>
          </div>
          <span class="points__value points__value--small">
            +{{ mission.bonus_points }} pts<template v-if="(mission.bonus_max ?? 1) > 1"> × {{ mission.bonus_max }}</template>
          </span>
        </div>
      </section>

      <section class="answer">
        <h2 class="section-title">Ta réponse</h2>

        <div v-if="result" class="result" :class="`result--${result.tone}`" role="status">
          <p class="result__title">{{ result.title }}</p>
          <p v-for="line in result.lines" :key="line">{{ line }}</p>
        </div>

        <p v-if="closedReason" class="answer__closed">{{ closedReason }}</p>
        <template v-else>
          <p v-if="progress.lastRefused && !result" class="answer__retry">
            Ta dernière réponse a été refusée : tu peux en envoyer une nouvelle.
          </p>
          <p v-if="mission.max_validations > 1 && progress.validatedCount > 0" class="answer__again">
            Tu peux encore la réussir {{ mission.max_validations - progress.validatedCount - progress.pendingCount }} fois.
          </p>
          <PlayerAnswerForm :mission="mission" :game-id="game.id" :team-id="me.team_id" @submitted="onSubmitted" />
        </template>
      </section>

      <section v-if="history.length" class="history">
        <h2 class="section-title">Historique de l’équipe</h2>
        <article v-for="s in history" :key="s.id" class="entry">
          <div class="entry__head">
            <StatusBadge :status="s.status" :label="submissionLabel(s)" />
            <span class="entry__meta">
              {{ formatTime(s.created_at) }}<template v-if="s.participant"> · envoyée par {{ s.participant.name }}</template>
            </span>
          </div>
          <p v-if="s.text_answer" class="entry__text">« {{ s.text_answer }} »</p>
          <SubmissionMediaGallery :media="s.media" />
          <p v-if="s.lat !== null && s.lng !== null" class="entry__comment entry__gps">
            <MapPin :size="16" aria-hidden="true" /> Position envoyée<template v-if="s.accuracy_m"> (± {{ Math.round(s.accuracy_m) }} m)</template>
          </p>
          <p v-if="s.team_comment" class="entry__comment">Commentaire : {{ s.team_comment }}</p>
          <p v-if="s.admin_comment" class="entry__admin">Organisateur : « {{ s.admin_comment }} »</p>
          <p v-if="submissionPointsLabel(s)" class="entry__points">{{ submissionPointsLabel(s) }}</p>
          <p v-if="s.status === 'validated' && s.bonus_state === 'pending'" class="entry__bonus">Bonus en cours de vérification par l’organisateur.</p>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.detail__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.detail__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: var(--tap-min);
  color: var(--color-text);
  font-size: 1.0625rem;
  font-weight: 600;
  text-decoration: none;
}

.muted {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-8) 0;
  color: var(--color-text-muted);
}

.detail__media {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--card-radius);
}

.detail__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail__type {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
}

.detail__status {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
}

.detail__title {
  font-size: clamp(1.75rem, 8vw, 2.25rem);
  font-weight: 800;
}

.detail__description {
  color: var(--color-text-muted);
  font-size: 1.0625rem;
  white-space: pre-line;
}

.points {
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
}

.points__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
}

.points__row + .points__row {
  border-top: 1px solid var(--color-border);
}

.points__label {
  font-weight: 600;
}

.points__hint {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.points__value {
  flex: none;
  color: var(--color-primary);
  font-family: var(--font-heading);
  font-size: 1.375rem;
  font-weight: 800;
}

.points__value--small {
  font-family: var(--font-body);
  font-size: 1rem;
}

.section-title {
  margin-top: var(--space-2);
  font-size: 1.5rem;
  font-weight: 800;
}

.answer {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.answer__closed,
.answer__soon {
  padding: var(--space-4);
  border: 1px dashed var(--color-border);
  border-radius: var(--card-radius);
  color: var(--color-text-muted);
  text-align: center;
}

.answer__retry {
  color: var(--status-refused-fg);
  font-weight: 600;
}

.answer__again {
  color: var(--color-text-muted);
}

.result {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  border-radius: var(--card-radius);
}

.result__title {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  font-weight: 800;
}

.result--validated {
  background: var(--status-validated-bg);
  color: var(--status-validated-fg);
}

.result--refused {
  background: var(--status-refused-bg);
  color: var(--status-refused-fg);
}

.result--pending {
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
}

.history {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.entry {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
}

.entry__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.entry__meta {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.entry__text {
  font-weight: 600;
}

.entry__comment,
.entry__bonus {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.entry__gps {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.entry__points {
  color: var(--status-validated-fg);
  font-weight: 700;
}
</style>
