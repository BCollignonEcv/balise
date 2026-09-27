<script setup lang="ts">
import { Minus, Pencil, Plus, Trash2, Undo2 } from '@lucide/vue'
import type { SubmissionStatus, Team, TeamSubmission } from '~/types/database'
import type { MissionWithSecret } from '~/composables/useAdminReview'

const props = defineProps<{
  submission: TeamSubmission
  mission: MissionWithSecret
  /** Affiche l'équipe (vue globale). */
  team?: Team | null
  review: (s: TeamSubmission, status: SubmissionStatus, bonus?: number, comment?: string) => Promise<void>
  remove: (s: TeamSubmission) => Promise<void>
}>()

const s = computed(() => props.submission)
const hasBonus = computed(() => !!props.mission.bonus_label)
const bonusMax = computed(() => props.mission.bonus_max ?? 0)
const bonusPoints = computed(() => props.mission.bonus_points ?? 0)

/* Formulaire de décision : ouvert d'office si une action est attendue. */
const editing = ref(needsReview(props.submission))
const bonusCount = ref(props.submission.bonus_count)
const comment = ref(props.submission.admin_comment ?? '')
const busy = ref(false)
const error = ref<string | null>(null)

watch(() => props.submission.updated_at, () => {
  editing.value = needsReview(props.submission)
  bonusCount.value = props.submission.bonus_count
  comment.value = props.submission.admin_comment ?? ''
})

const totalIfValidated = computed(() => props.mission.base_points + bonusCount.value * bonusPoints.value)

const statusPill = computed(() => {
  const { status, auto_validated: auto } = s.value
  if (status === 'pending') return { tone: 'pending', label: 'En attente' }
  if (status === 'validated') return { tone: 'validated', label: auto ? 'Validée auto' : 'Validée' }
  return { tone: 'refused', label: auto ? 'Refusée auto' : 'Refusée' }
})

const earned = computed(() => submissionPoints(s.value, props.mission))

const target = computed(() => {
  const secret = props.mission.secret
  return secret?.target_lat != null && secret?.target_lng != null && secret?.radius_m != null
    ? { lat: secret.target_lat, lng: secret.target_lng, radius: secret.radius_m }
    : null
})

async function decide(status: SubmissionStatus) {
  busy.value = true
  error.value = null
  try {
    await props.review(s.value, status, status === 'validated' ? bonusCount.value : 0, comment.value)
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    busy.value = false
  }
}

async function destroy() {
  if (!window.confirm(`Supprimer définitivement cette réponse à « ${props.mission.title} » ?\nLes fichiers joints seront aussi supprimés.`)) return
  busy.value = true
  error.value = null
  try {
    await props.remove(s.value)
  }
  catch (e) {
    error.value = (e as Error).message
    busy.value = false
  }
}
</script>

<template>
  <article class="card" :class="`card--${statusPill.tone}`">
    <header class="card__head">
      <div class="card__title-block">
        <h3 class="card__title">
          <AnswerTypeIcon class="card__icon" :types="mission.answer_types" />
          {{ mission.title }}
        </h3>
        <p class="card__meta">
          <template v-if="team"><span class="dot" :style="{ background: team.color }" /> {{ team.name }} · </template>
          {{ s.participant?.name ?? 'Participant supprimé' }} · {{ formatTime(s.created_at) }} · {{ mission.base_points }} pts de base
        </p>
      </div>
      <div class="card__pills">
        <span class="pill" :class="`pill--${statusPill.tone}`">{{ statusPill.label }}</span>
        <span v-if="s.bonus_state === 'pending'" class="pill pill--pending">Bonus à vérifier</span>
      </div>
    </header>

    <!-- Contenu de la réponse -->
    <SubmissionMediaGallery :media="s.media" client="admin" size="lg" />

    <div v-if="s.text_answer" class="box">
      <p><strong>Réponse :</strong> « {{ s.text_answer }} »</p>
      <p v-if="mission.secret?.expected_answer" class="muted">Attendu : « {{ mission.secret.expected_answer }} »</p>
    </div>

    <template v-if="s.lat !== null && s.lng !== null">
      <AdminGpsMap :lat="s.lat" :lng="s.lng" :accuracy="s.accuracy_m" :target="target" />
      <p class="muted">
        <template v-if="s.distance_m !== null">À {{ Math.round(s.distance_m) }} m de la cible<template v-if="target"> (rayon {{ target.radius }} m)</template> · </template>
        précision ± {{ s.accuracy_m ? Math.round(s.accuracy_m) : '?' }} m ·
        <a :href="`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`" target="_blank" rel="noopener">ouvrir la carte</a>
      </p>
    </template>

    <p v-if="s.team_comment" class="box">Équipe : « {{ s.team_comment }} »</p>

    <!-- Décision -->
    <template v-if="editing">
      <div v-if="hasBonus" class="bonus">
        <div class="bonus__text">
          <strong>Bonus obtenus</strong>
          <span class="muted">{{ mission.bonus_label }} · +{{ bonusPoints }} pts · max {{ bonusMax }}</span>
          <span class="bonus__earned">+{{ bonusCount * bonusPoints }} pts</span>
        </div>
        <div class="stepper">
          <button type="button" class="stepper__btn" :disabled="bonusCount <= 0 || busy" aria-label="Retirer un bonus" @click="bonusCount--">
            <Minus :size="18" aria-hidden="true" />
          </button>
          <span class="stepper__value">{{ bonusCount }} / {{ bonusMax }}</span>
          <button type="button" class="stepper__btn" :disabled="bonusCount >= bonusMax || busy" aria-label="Ajouter un bonus" @click="bonusCount++">
            <Plus :size="18" aria-hidden="true" />
          </button>
        </div>
      </div>

      <input v-model="comment" class="input" type="text" placeholder="Commentaire pour l’équipe (optionnel)" :disabled="busy" aria-label="Commentaire pour l’équipe">

      <div class="actions">
        <AppButton variant="danger" :disabled="busy" @click="decide('refused')">Refuser</AppButton>
        <AppButton variant="secondary" :disabled="busy" @click="decide('validated')">Valider · {{ totalIfValidated }} pts</AppButton>
      </div>
      <button v-if="!needsReview(s)" type="button" class="link-btn" @click="editing = false">Annuler la modification</button>
    </template>

    <template v-else>
      <p v-if="s.status === 'validated'" class="earned">
        +{{ earned.base + earned.bonus }} pts<template v-if="earned.bonus"> ({{ earned.base }} + {{ earned.bonus }} de bonus)</template>
      </p>
      <p v-if="s.admin_comment" class="muted">Ton commentaire : « {{ s.admin_comment }} »</p>
      <div class="actions actions--secondary">
        <AppButton variant="outline" :disabled="busy" @click="editing = true">
          <Pencil :size="16" aria-hidden="true" /> Modifier la décision
        </AppButton>
        <AppButton v-if="s.status !== 'pending'" variant="outline" :disabled="busy" @click="decide('pending')">
          <Undo2 :size="16" aria-hidden="true" /> Remettre en attente
        </AppButton>
      </div>
    </template>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <button type="button" class="delete" :disabled="busy" @click="destroy">
      <Trash2 :size="14" aria-hidden="true" /> Supprimer cette réponse
    </button>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.card--pending {
  border: 2px solid color-mix(in srgb, var(--status-pending-fg) 45%, var(--status-pending-bg));
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.card__title-block {
  min-width: 0;
}

.card__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-body);
  font-size: 1.0625rem;
  font-weight: 700;
}

.card__icon {
  flex: none;
  min-width: 0;
  height: auto;
  padding: 0;
  background: none;
}

.card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25em;
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.card__pills {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
}

.pill {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.pill--pending {
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
}

.pill--validated {
  background: var(--status-validated-bg);
  color: var(--status-validated-fg);
}

.pill--refused {
  background: var(--status-refused-bg);
  color: var(--status-refused-fg);
}

.box {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--admin-bg);
}

.muted {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.muted a {
  color: var(--color-secondary);
}

.bonus {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.bonus__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bonus__earned {
  color: var(--color-secondary);
  font-weight: 700;
}

.stepper {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.stepper__btn {
  display: grid;
  place-items: center;
  width: var(--tap-min);
  height: var(--tap-min);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.stepper__btn:disabled {
  opacity: 0.4;
}

.stepper__value {
  min-width: 3.5em;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--space-2);
}

.actions--secondary {
  display: flex;
  flex-wrap: wrap;
}

.earned {
  color: var(--status-validated-fg);
  font-weight: 700;
}

.link-btn,
.delete {
  align-self: flex-start;
  padding: var(--space-1) 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  text-decoration: underline;
}

.delete {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  align-self: flex-end;
  color: var(--status-refused-fg);
  text-decoration: none;
}
</style>
