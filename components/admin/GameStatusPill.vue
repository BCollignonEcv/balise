<script setup lang="ts">
import { GAME_STATUS_LABELS, type GameStatus } from '~/types/database'

defineProps<{ status: GameStatus; archived?: boolean }>()
</script>

<template>
  <span class="pill" :class="archived ? 'pill--archived' : `pill--${status}`">
    <span v-if="status === 'live' && !archived" class="pill__dot" aria-hidden="true" />
    {{ archived ? 'Archivée' : GAME_STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.pill--draft {
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
}

.pill--live {
  background: var(--admin-live-bg);
  color: var(--admin-live-fg);
}

.pill--finished,
.pill--archived {
  background: var(--status-todo-bg);
  color: var(--status-todo-fg);
}
</style>
