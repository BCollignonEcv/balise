<script setup lang="ts">
import { Check, Clock, X } from '@lucide/vue'
import { MISSION_STATUS_LABELS, type MissionStatus } from '~/types/game'

const props = defineProps<{
  status: MissionStatus
  /** Libellé personnalisé, ex. « Validée 3 fois ». */
  label?: string
}>()

const icon = computed(() => ({ todo: null, pending: Clock, validated: Check, refused: X })[props.status])
</script>

<template>
  <span class="status" :class="`status--${status}`">
    <component :is="icon" v-if="icon" :size="14" :stroke-width="2.5" aria-hidden="true" />
    {{ label ?? MISSION_STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.status--todo {
  background: var(--status-todo-bg);
  color: var(--status-todo-fg);
}

.status--pending {
  background: var(--status-pending-bg);
  color: var(--status-pending-fg);
}

.status--validated {
  background: var(--status-validated-bg);
  color: var(--status-validated-fg);
}

.status--refused {
  background: var(--status-refused-bg);
  color: var(--status-refused-fg);
}
</style>
