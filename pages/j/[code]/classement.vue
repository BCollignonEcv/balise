<script setup lang="ts">
const { game, me } = usePlayerSession()
const { state } = useLeaderboard()
const { gameOver } = useGameClock()

useHead({ title: 'Classement · Jeu de piste' })
</script>

<template>
  <main v-if="game && me" class="player-page">
    <header class="head">
      <h1 class="title">Classement</h1>
      <span class="live" :class="{ 'live--over': gameOver }">
        <span class="live__dot" aria-hidden="true" />
        {{ gameOver ? 'Final' : 'En direct' }}
      </span>
    </header>

    <p v-if="state.error" class="form-error" role="alert">{{ state.error }}</p>
    <p v-else-if="!state.loaded" class="muted">Chargement…</p>
    <p v-else-if="!state.rows.length" class="muted">Aucune équipe pour l’instant.</p>

    <ol v-else class="board">
      <li
        v-for="row in state.rows"
        :key="row.team_id"
        class="row"
        :class="{ 'row--mine': row.team_id === me.team_id }"
        :aria-current="row.team_id === me.team_id ? 'true' : undefined"
      >
        <span class="row__rank">{{ row.rank }}</span>
        <span class="row__dot" :style="{ background: row.color }" aria-hidden="true" />
        <span class="row__text">
          <span class="row__name">{{ row.name }}</span>
          <span class="row__meta">
            {{ row.validated_missions }} mission{{ row.validated_missions > 1 ? 's' : '' }} validée{{ row.validated_missions > 1 ? 's' : '' }}<template v-if="row.team_id === me.team_id"> · ton équipe</template>
          </span>
        </span>
        <span class="row__score">{{ row.total_points }}</span>
      </li>
    </ol>

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
  padding: var(--space-6) var(--space-4) calc(96px + env(safe-area-inset-bottom, 0px));
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.title {
  font-size: clamp(2.25rem, 10vw, 2.75rem);
  font-weight: 800;
}

.live {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  font-weight: 700;
}

.live__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--status-validated-fg);
  animation: pulse 2s ease-in-out infinite;
}

.live--over .live__dot {
  background: var(--color-text-muted);
  animation: none;
}

@keyframes pulse {
  50% { opacity: 0.35; }
}

.muted {
  padding: var(--space-6) 0;
  color: var(--color-text-muted);
  text-align: center;
}

.board {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
}

.row--mine {
  border: 2px solid var(--color-primary);
  background: var(--color-primary-soft);
}

.row__rank {
  flex: none;
  width: 1.5em;
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  text-align: center;
}

.row__dot {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.row__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.row__name {
  font-size: 1.125rem;
  font-weight: 700;
}

.row__meta {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.row__score {
  flex: none;
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.row--mine .row__score {
  color: var(--color-primary);
}
</style>
