<script setup lang="ts">
import type { Participant } from '~/types/database'

const supabase = usePlayerSupabase()
const { game, me } = usePlayerSession()
const { data } = usePlayerGameData()

useHead({ title: 'Mon équipe · Jeu de piste' })

/* ---- Membres ---- */
const members = ref<Pick<Participant, 'id' | 'name' | 'claimed_by'>[]>([])
const membersLoading = ref(true)
const membersError = ref<string | null>(null)

onMounted(async () => {
  if (!me.value) return
  const { data: rows, error } = await supabase
    .from('participants')
    .select('id, name, claimed_by')
    .eq('team_id', me.value.team_id)
    .order('name')
  if (error) membersError.value = friendlyError(error)
  else members.value = rows
  membersLoading.value = false
})

/* ---- Score détaillé ---- */
const score = computed(() => teamScore(data.value.missions, data.value.submissions, data.value.adjustments))

/** Points gagnés mission par mission (réponses validées uniquement). */
const breakdown = computed(() =>
  data.value.missions
    .map((mission) => {
      const validated = data.value.submissions.filter(s => s.mission_id === mission.id && s.status === 'validated')
      const base = validated.length * mission.base_points
      const bonus = validated.reduce((sum, s) => sum + s.bonus_count * (mission.bonus_points ?? 0), 0)
      const bonusPending = validated.some(s => s.bonus_state === 'pending')
      return { mission, count: validated.length, base, bonus, total: base + bonus, bonusPending }
    })
    .filter(line => line.count > 0),
)

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <main v-if="game && me" class="player-page">
    <PlayerHeader :me="me">
      <template #aside>
        <PlayerRankPill :team-id="me.team_id" :to="`/j/${game.code}/classement`" />
      </template>
    </PlayerHeader>

    <PlayerScoreCard :score="score" />

    <!-- Détail du calcul -->
    <section class="panel">
      <h2 class="panel__title">Détail des points</h2>
      <p v-if="!data.loaded" class="muted">Chargement…</p>
      <p v-else-if="!breakdown.length && !data.adjustments.length" class="muted">
        Aucun point pour l’instant : à vous de jouer !
      </p>

      <ul v-if="breakdown.length" class="lines">
        <li v-for="line in breakdown" :key="line.mission.id" class="line">
          <div class="line__text">
            <span class="line__title">
              {{ line.mission.title }}<template v-if="line.count > 1"> × {{ line.count }}</template>
            </span>
            <span class="line__detail">
              {{ line.base }} base<template v-if="line.bonus"> + {{ line.bonus }} bonus</template>
              <template v-if="line.bonusPending"> · bonus en cours de vérification</template>
            </span>
          </div>
          <span class="line__points">+{{ line.total }}</span>
        </li>
      </ul>

      <template v-if="data.adjustments.length">
        <h3 class="panel__subtitle">Ajustements de l’organisateur</h3>
        <ul class="lines">
          <li v-for="a in data.adjustments" :key="a.id" class="line">
            <div class="line__text">
              <span class="line__title">{{ a.reason }}</span>
              <span class="line__detail">{{ formatTime(a.created_at) }}</span>
            </div>
            <span class="line__points" :class="{ 'line__points--minus': a.points < 0 }">{{ signed(a.points) }}</span>
          </li>
        </ul>
      </template>

      <div v-if="breakdown.length || data.adjustments.length" class="total">
        <span>Total</span>
        <span>{{ score.base }} + {{ score.bonus }} {{ score.adjustments < 0 ? '−' : '+' }} {{ Math.abs(score.adjustments) }} = <strong>{{ score.total }} pts</strong></span>
      </div>
    </section>

    <!-- Membres -->
    <section class="panel">
      <h2 class="panel__title">Membres</h2>
      <p v-if="membersLoading" class="muted">Chargement…</p>
      <p v-else-if="membersError" class="form-error">{{ membersError }}</p>
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
  font-size: 1.375rem;
  font-weight: 800;
}

.panel__subtitle {
  margin-top: var(--space-2);
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 700;
}

.muted {
  color: var(--color-text-muted);
}

.lines,
.members {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.line__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.line__title {
  font-weight: 600;
}

.line__detail {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.line__points {
  flex: none;
  color: var(--status-validated-fg);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.line__points--minus {
  color: var(--status-refused-fg);
}

.total {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
  font-weight: 600;
}

.total strong {
  color: var(--color-primary);
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
