<script setup lang="ts">
import type { Participant } from '~/types/database'

const supabase = usePlayerSupabase()
const { game, me } = usePlayerSession()

const members = ref<Pick<Participant, 'id' | 'name' | 'claimed_by'>[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  if (!me.value) return
  const { data, error: err } = await supabase
    .from('participants')
    .select('id, name, claimed_by')
    .eq('team_id', me.value.team_id)
    .order('name')
  if (err) error.value = friendlyError(err)
  else members.value = data
  loading.value = false
})

const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <main v-if="game && me" class="player-page">
    <PlayerHeader :me="me" />

    <section class="panel">
      <h1 class="panel__title">Mon équipe</h1>
      <p v-if="loading" class="muted">Chargement…</p>
      <p v-else-if="error" class="form-error">{{ error }}</p>
      <ul v-else class="members">
        <li v-for="m in members" :key="m.id" class="member">
          <span class="member__avatar" :style="{ background: me.team_color }">{{ initial(m.name) }}</span>
          <span class="member__name">
            {{ m.name }}<template v-if="m.id === me.id"> (toi)</template>
          </span>
          <span class="member__state" :class="{ 'is-on': m.claimed_by }">
            {{ m.claimed_by ? 'Connecté' : 'Pas encore connecté' }}
          </span>
        </li>
      </ul>
    </section>

    <p class="muted">Le détail du score de l’équipe arrive à l’étape 8.</p>

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

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
}

.panel__title {
  font-size: 1.5rem;
  font-weight: 800;
}

.muted {
  color: var(--color-text-muted);
}

.members {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.member {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.member:last-child {
  border-bottom: none;
}

.member__avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-on-secondary);
  font-weight: 700;
}

.member__name {
  flex: 1;
  font-weight: 600;
}

.member__state {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.member__state.is-on {
  color: var(--status-validated-fg);
  font-weight: 600;
}
</style>
