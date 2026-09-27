<script setup lang="ts">
import { Archive, ArchiveRestore, Check, Copy, Inbox, ListChecks, Palette, RotateCcw, Users } from '@lucide/vue'
import type { Game, GameFormValues } from '~/types/database'
import { NuxtLink } from '#components'

// key : recharge la page quand on passe d'une partie à une autre (ex. après duplication)
definePageMeta({ layout: 'admin', key: route => route.fullPath })

const route = useRoute()
const supabase = useAdminSupabase()
const gameId = route.params.id as string

const game = ref<Game | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const savedAt = ref<number | null>(null)
const actionError = ref<string | null>(null)
const actionNotice = ref<string | null>(null)
const busy = ref(false)
const copied = ref(false)

useHead(() => ({ title: `${game.value?.name ?? 'Partie'} · Admin Balise` }))

const shareUrl = computed(() => (game.value ? `${window.location.origin}/j/${game.value.code}` : ''))

const missionCount = ref<number | null>(null)
const participantCount = ref<number | null>(null)
const pendingCount = ref<number | null>(null)

const sections = computed(() => [
  {
    label: 'Missions',
    icon: ListChecks,
    to: `/admin/parties/${gameId}/missions`,
    detail: missionCount.value === null ? '' : `${missionCount.value} mission${missionCount.value > 1 ? 's' : ''}`,
  },
  {
    label: 'Équipes et participants',
    icon: Users,
    to: `/admin/parties/${gameId}/equipes`,
    detail: participantCount.value === null ? '' : `${participantCount.value} participant${participantCount.value > 1 ? 's' : ''}`,
  },
  {
    label: 'Soumissions',
    icon: Inbox,
    to: `/admin/parties/${gameId}/soumissions`,
    detail: pendingCount.value === null ? '' : pendingCount.value ? `${pendingCount.value} en attente` : 'Rien en attente',
  },
  { label: 'Thème graphique', icon: Palette, detail: 'Étape 9' },
])

async function load() {
  loading.value = true
  const [gameRes, missionsRes, participantsRes, pendingRes] = await Promise.all([
    supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('game_id', gameId),
    supabase.from('participants').select('id', { count: 'exact', head: true }).eq('game_id', gameId),
    supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .or('status.eq.pending,bonus_state.eq.pending'),
  ])
  pendingCount.value = pendingRes.count ?? null
  if (gameRes.error) loadError.value = friendlyError(gameRes.error)
  else if (!gameRes.data) loadError.value = 'Partie introuvable.'
  else game.value = gameRes.data as Game
  missionCount.value = missionsRes.count ?? null
  participantCount.value = participantsRes.count ?? null
  loading.value = false
}

async function save(values: GameFormValues) {
  saving.value = true
  saveError.value = null
  savedAt.value = null
  const { data, error } = await supabase.from('games').update(values).eq('id', gameId).select('*').single()
  saving.value = false
  if (error) {
    saveError.value = friendlyError(error)
    return
  }
  game.value = data as Game
  savedAt.value = Date.now()
  justDuplicated.value = false
}

async function copyLink() {
  copied.value = await copyText(shareUrl.value)
  if (copied.value) setTimeout(() => (copied.value = false), 2000)
}

async function duplicate() {
  busy.value = true
  actionError.value = null
  const { data, error } = await supabase.rpc('duplicate_game', { p_game_id: gameId })
  busy.value = false
  if (error) {
    actionError.value = friendlyError(error)
    return
  }
  await navigateTo({ path: `/admin/parties/${data}`, query: { copie: '1' } })
}

/* ---- Arrivée après duplication : focus sur le nom de la nouvelle partie ---- */
const settingsPanel = ref<HTMLElement | null>(null)
const gameForm = ref<{ focusName: () => void } | null>(null)
const justDuplicated = ref(route.query.copie === '1')

function editSettings() {
  settingsPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Laisse le défilement démarrer avant de donner le focus (sinon iOS saute brutalement).
  setTimeout(() => gameForm.value?.focusName(), 300)
}

/** Efface toutes les réponses et ajustements (répétition avant le vrai jeu). */
async function resetResponses() {
  if (!game.value) return
  const confirmation = window.prompt(
    `Toutes les réponses, fichiers et ajustements de points de « ${game.value.name} » seront définitivement supprimés.\n`
    + 'Missions, équipes et participants sont conservés.\n\n'
    + `Pour confirmer, tape le code de la partie : ${game.value.code}`,
  )
  if (confirmation === null) return
  if (confirmation.trim().toUpperCase() !== game.value.code) {
    actionError.value = 'Code incorrect : rien n’a été supprimé.'
    return
  }
  busy.value = true
  actionError.value = null
  actionNotice.value = null
  const { data, error } = await supabase.rpc('reset_game_responses', { p_game_id: gameId })
  if (error) {
    busy.value = false
    actionError.value = friendlyError(error)
    return
  }
  const paths = (data ?? []) as string[]
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(SUBMISSIONS_BUCKET).remove(paths.slice(i, i + 100))
  }
  busy.value = false
  pendingCount.value = 0
  actionNotice.value = 'Toutes les réponses ont été effacées.'
}

async function toggleArchive() {
  if (!game.value) return
  busy.value = true
  actionError.value = null
  const archived_at = game.value.archived_at ? null : new Date().toISOString()
  const { error } = await supabase.from('games').update({ archived_at }).eq('id', gameId)
  busy.value = false
  if (error) {
    actionError.value = friendlyError(error)
    return
  }
  game.value.archived_at = archived_at
}

onMounted(async () => {
  await load()
  if (justDuplicated.value && game.value) {
    await nextTick()
    editSettings()
  }
})
</script>

<template>
  <div class="page">
    <p v-if="loading" class="empty">Chargement…</p>

    <template v-else-if="loadError || !game">
      <AdminTopBar title="Partie" :back="{ to: '/admin', label: 'Mes parties' }" />
      <p class="form-error" role="alert">{{ loadError }}</p>
    </template>

    <template v-else>
      <AdminTopBar
        :title="game.name"
        :subtitle="`Fin des réponses ${formatDateTime(game.deadline_at)}`"
        :back="{ to: '/admin', label: 'Mes parties' }"
      >
        <template #aside>
          <AdminGameStatusPill :status="game.status" :archived="!!game.archived_at" />
        </template>
      </AdminTopBar>

      <p v-if="justDuplicated" class="notice" role="status">
        Partie dupliquée avec ses missions et son thème. Donne-lui un nom ci-dessous, puis enregistre.
      </p>

      <!-- Lien à partager -->
      <section class="panel share">
        <h2 class="panel__title">Lien pour les participants</h2>
        <div class="share__row">
          <code class="share__url">{{ shareUrl }}</code>
          <AppButton variant="outline" @click="copyLink">
            <component :is="copied ? Check : Copy" :size="16" aria-hidden="true" />
            {{ copied ? 'Copié' : 'Copier' }}
          </AppButton>
        </div>
        <p class="field__hint">
          Code de la partie : <strong class="share__code">{{ game.code }}</strong>
          <template v-if="game.status === 'draft'"> · la partie est en brouillon, les participants ne peuvent pas encore la rejoindre.</template>
        </p>
      </section>

      <!-- Gestion de la partie -->
      <nav class="sections" aria-label="Gestion de la partie">
        <component
          :is="s.to ? NuxtLink : 'div'"
          v-for="s in sections"
          :key="s.label"
          :to="s.to"
          class="section"
          :class="{ 'is-soon': !s.to }"
        >
          <component :is="s.icon" :size="20" aria-hidden="true" />
          <span class="section__label">{{ s.label }}</span>
          <span class="section__soon">{{ s.detail }}</span>
        </component>
      </nav>

      <!-- Réglages -->
      <section id="reglages" ref="settingsPanel" class="panel">
        <h2 class="panel__title">Réglages</h2>
        <AdminGameForm ref="gameForm" :game="game" submit-label="Enregistrer" :saving="saving" :error="saveError" @submit="save" />
        <p v-if="savedAt" class="saved" role="status"><Check :size="16" aria-hidden="true" /> Modifications enregistrées</p>
      </section>

      <!-- Actions -->
      <section class="panel">
        <h2 class="panel__title">Actions</h2>
        <p class="field__hint">La duplication copie les missions et le thème, sans les équipes ni les participants.</p>
        <div class="actions">
          <AppButton variant="outline" :disabled="busy" @click="duplicate">
            <Copy :size="16" aria-hidden="true" /> Dupliquer
          </AppButton>
          <AppButton variant="outline" :disabled="busy" @click="toggleArchive">
            <component :is="game.archived_at ? ArchiveRestore : Archive" :size="16" aria-hidden="true" />
            {{ game.archived_at ? 'Désarchiver' : 'Archiver' }}
          </AppButton>
        </div>
        <div class="reset">
          <p class="field__hint">
            Pour une répétition : efface toutes les réponses et les ajustements de points, en gardant missions, équipes et participants.
          </p>
          <AppButton variant="danger" :disabled="busy" @click="resetResponses">
            <RotateCcw :size="16" aria-hidden="true" /> Réinitialiser les réponses
          </AppButton>
        </div>
        <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
        <p v-if="actionNotice" class="saved" role="status"><Check :size="16" aria-hidden="true" /> {{ actionNotice }}</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--status-validated-bg);
  color: var(--status-validated-fg);
  font-weight: 600;
}

.reset {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

#reglages {
  scroll-margin-top: var(--space-4);
}

.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
  margin: 0 auto;
  padding: 0 var(--space-4) var(--space-8);
}

.empty {
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.panel__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.share__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.share__url {
  flex: 1 1 220px;
  min-width: 0;
  padding: var(--space-3);
  overflow-wrap: anywhere;
  border-radius: var(--radius-md);
  background: var(--admin-bg);
  font-size: 0.875rem;
}

.share__code {
  color: var(--color-text);
  letter-spacing: 0.06em;
}

.sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
}

.section.is-soon {
  opacity: 0.55;
}

.section__label {
  font-weight: 600;
}

.section__soon {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.saved {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--admin-live-fg);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
