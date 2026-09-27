<script setup lang="ts">
import type { PlayerIdentity } from '~/types/database'

defineProps<{ me: PlayerIdentity }>()
</script>

<template>
  <header class="player-header">
    <span class="player-header__dot" :style="{ background: me.team_color }" aria-hidden="true" />
    <div class="player-header__text">
      <p class="player-header__team">{{ me.team_name }}</p>
      <p class="player-header__me">Connecté en tant que {{ me.name }}</p>
    </div>
    <slot name="aside" />
  </header>
</template>

<style scoped>
.player-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.player-header__dot {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.player-header__text {
  flex: 1;
  min-width: 0;
}

.player-header__team {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.2;
}

.player-header__me {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
