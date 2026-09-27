<script setup lang="ts">
import { ChevronRight, Copy, Archive, ArchiveRestore, Plus } from '@lucide/vue'
import type { Game } from '~/types/database'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Parties · Admin Balise' })

const supabase = useAdminSupabase()

const games = ref<Game[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)
const tab = ref<'active' | 'archived'>('active')

const visibleGames = computed(() =>
  games.value.filter(g => (tab.value === 'archived') === !!g.archived_at),
)
const archivedCount = computed(() => games.value.filter(g => g.archived_at).length)

async function load() {
  loading.value = true
  error.value = null
  const { data, error: err } = await supabase
    .from('games')
    .select('*')
    .order('created_at', { ascending: false })
  if (err) error.value = friendlyError(err)
  else games.value = data as Game[]
  loading.value = false
}

async function duplicate(game: Game) {
  busyId.value = game.id
  const { data, error: err } = await supabase.rpc('duplicate_game', { p_game_id: game.id })
  busyId.value = null
  if (err) {
    error.value = friendlyError(err)
    return
  }
  await navigateTo({ path: `/admin/parties/${data}`, query: { copie: '1' } })
}

async function toggleArchive(game: Game) {
  busyId.value = game.id
  const archived_at = game.archived_at ? null : new Date().toISOString()
  const { error: err } = await supabase.from('games').update({ archived_at }).eq('id', game.id)
  busyId.value = null
  if (err) {
    error.value = friendlyError(err)
    return
  }
  game.archived_at = archived_at
}

onMounted(load)
</script>

<template>
  <div class="page">
    <AdminTopBar title="Mes parties">
      <template #aside>
        <AppButton to="/admin/parties/nouvelle" variant="secondary">
          <Plus :size="18" aria-hidden="true" /> Nouvelle
        </AppButton>
      </template>
    </AdminTopBar>

    <div class="tabs" role="tablist">
      <button role="tab" :aria-selected="tab === 'active'" class="tab" :class="{ 'is-active': tab === 'active' }" @click="tab = 'active'">
        Actives
      </button>
      <button role="tab" :aria-selected="tab === 'archived'" class="tab" :class="{ 'is-active': tab === 'archived' }" @click="tab = 'archived'">
        Archivées · {{ archivedCount }}
      </button>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="!visibleGames.length" class="empty">
      {{ tab === 'active' ? 'Aucune partie pour l’instant. Crée ta première partie !' : 'Aucune partie archivée.' }}
    </p>

    <ul v-else class="games">
      <li v-for="game in visibleGames" :key="game.id" class="game">
        <NuxtLink :to="`/admin/parties/${game.id}`" class="game__main">
          <div class="game__head">
            <h2 class="game__name">{{ game.name }}</h2>
            <AdminGameStatusPill :status="game.status" :archived="!!game.archived_at" />
          </div>
          <p class="game__meta">
            Code <strong>{{ game.code }}</strong> · Fin des réponses {{ formatDateTime(game.deadline_at) }}
          </p>
          <ChevronRight class="game__chevron" :size="20" aria-hidden="true" />
        </NuxtLink>
        <div class="game__actions">
          <button type="button" class="game__action" :disabled="busyId === game.id" @click="duplicate(game)">
            <Copy :size="16" aria-hidden="true" /> Dupliquer
          </button>
          <button type="button" class="game__action" :disabled="busyId === game.id" @click="toggleArchive(game)">
            <component :is="game.archived_at ? ArchiveRestore : Archive" :size="16" aria-hidden="true" />
            {{ game.archived_at ? 'Désarchiver' : 'Archiver' }}
          </button>
        </div>
      </li>
    </ul>
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

.tabs {
  display: flex;
  gap: var(--space-2);
}

.tab {
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-weight: 600;
  font-size: 0.9375rem;
}

.tab.is-active {
  border-color: var(--color-text);
  background: var(--color-text);
  color: var(--color-surface);
}

.empty {
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.games {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.game {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.game__main {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-8) var(--space-3) var(--space-4);
  color: inherit;
  text-decoration: none;
}

.game__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.game__name {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.game__meta {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.game__meta strong {
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.game__chevron {
  position: absolute;
  top: 50%;
  right: var(--space-3);
  color: var(--color-text-muted);
  transform: translateY(-50%);
}

.game__actions {
  display: flex;
  border-top: 1px solid var(--color-border);
}

.game__action {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.game__action + .game__action {
  border-left: 1px solid var(--color-border);
}

.game__action:disabled {
  opacity: 0.5;
}
</style>
