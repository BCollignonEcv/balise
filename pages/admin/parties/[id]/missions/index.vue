<script setup lang="ts">
import { ArrowDown, ArrowUp, Plus } from '@lucide/vue'
import type { Game, Mission } from '~/types/database'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const supabase = useAdminSupabase()
const gameId = route.params.id as string

const game = ref<Pick<Game, 'id' | 'name'> | null>(null)
const missions = ref<Mission[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const reordering = ref(false)

useHead(() => ({ title: `Missions · ${game.value?.name ?? 'Partie'} · Admin Balise` }))

const totalBase = computed(() => missions.value.reduce((sum, m) => sum + m.base_points * m.max_validations, 0))

async function load() {
  loading.value = true
  const [gameRes, missionsRes] = await Promise.all([
    supabase.from('games').select('id, name').eq('id', gameId).maybeSingle(),
    supabase.from('missions').select('*').eq('game_id', gameId).order('position').order('created_at'),
  ])
  if (gameRes.error || missionsRes.error) error.value = friendlyError(gameRes.error ?? missionsRes.error)
  else if (!gameRes.data) error.value = 'Partie introuvable.'
  else {
    game.value = gameRes.data
    missions.value = missionsRes.data as Mission[]
  }
  loading.value = false
}

async function move(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= missions.value.length) return
  const previous = [...missions.value]
  const next = [...missions.value]
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  missions.value = next
  reordering.value = true
  const { error: err } = await supabase.rpc('reorder_missions', {
    p_game_id: gameId,
    p_mission_ids: next.map(m => m.id),
  })
  reordering.value = false
  if (err) {
    missions.value = previous
    error.value = friendlyError(err)
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <AdminTopBar
      title="Missions"
      :subtitle="game?.name"
      :back="{ to: `/admin/parties/${gameId}`, label: game?.name ?? 'Partie' }"
    >
      <template #aside>
        <AppButton :to="`/admin/parties/${gameId}/missions/nouvelle`" variant="secondary">
          <Plus :size="18" aria-hidden="true" /> Ajouter
        </AppButton>
      </template>
    </AdminTopBar>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Chargement…</p>

    <template v-else-if="game">
      <p v-if="!missions.length" class="empty">Aucune mission pour l’instant. Ajoute la première !</p>

      <template v-else>
        <p class="summary">
          {{ missions.length }} mission{{ missions.length > 1 ? 's' : '' }} ·
          {{ totalBase }} pts de base au maximum (hors bonus)
        </p>

        <ol class="missions">
          <li v-for="(mission, index) in missions" :key="mission.id" class="mission">
            <NuxtLink :to="`/admin/parties/${gameId}/missions/${mission.id}`" class="mission__main">
              <span class="mission__index">{{ index + 1 }}</span>
              <div class="mission__thumb" :class="{ placeholder: !mission.image_path }">
                <img v-if="mission.image_path" :src="assetUrl(mission.image_path)!" alt="" loading="lazy">
                <AnswerTypeIcon class="mission__type" :types="mission.answer_types" />
              </div>
              <div class="mission__text">
                <span class="mission__title">{{ mission.title }}</span>
                <span class="mission__tags">
                  <span class="tag tag--points">{{ mission.base_points }} pts</span>
                  <span class="tag">{{ mission.validation_mode === 'auto' ? 'Auto' : 'Manuelle' }}</span>
                  <span v-if="mission.max_validations > 1" class="tag">×{{ mission.max_validations }}</span>
                  <span v-if="mission.bonus_label" class="tag tag--bonus">+ Bonus</span>
                </span>
              </div>
            </NuxtLink>
            <div class="mission__order">
              <button
                type="button"
                class="order-btn"
                :disabled="index === 0 || reordering"
                :aria-label="`Monter « ${mission.title} »`"
                @click="move(index, -1)"
              >
                <ArrowUp :size="18" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="order-btn"
                :disabled="index === missions.length - 1 || reordering"
                :aria-label="`Descendre « ${mission.title} »`"
                @click="move(index, 1)"
              >
                <ArrowDown :size="18" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ol>
      </template>
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
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.summary {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.missions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mission {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.mission__main {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-3);
  color: inherit;
  text-decoration: none;
}

.mission__index {
  flex: none;
  width: 1.5rem;
  color: var(--color-text-muted);
  font-weight: 700;
  text-align: center;
}

.mission__thumb {
  position: relative;
  flex: none;
  width: 72px;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.mission__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mission__type {
  position: absolute;
  bottom: 4px;
  left: 4px;
  transform: scale(0.8);
  transform-origin: bottom left;
}

.mission__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.mission__title {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mission__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.tag {
  padding: 1px 8px;
  border-radius: 6px;
  background: var(--status-todo-bg);
  color: var(--status-todo-fg);
  font-size: 0.75rem;
  font-weight: 600;
}

.tag--points {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.tag--bonus {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.mission__order {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--color-border);
}

.order-btn {
  display: grid;
  flex: 1;
  place-items: center;
  width: var(--tap-min);
  border: none;
  background: none;
  color: var(--color-text);
}

.order-btn + .order-btn {
  border-top: 1px solid var(--color-border);
}

.order-btn:disabled {
  color: var(--color-border);
  cursor: default;
}
</style>
