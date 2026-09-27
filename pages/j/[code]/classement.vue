<script setup lang="ts">
const { game, me } = usePlayerSession()
</script>

<template>
  <main v-if="game && me" class="player-page">
    <h1 class="title">Classement</h1>
    <p class="muted">Le classement en direct arrive à l’étape 8.</p>
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

.title {
  font-size: 2.5rem;
  font-weight: 800;
}

.muted {
  color: var(--color-text-muted);
}
</style>
