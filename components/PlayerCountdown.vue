<script setup lang="ts">
import { Timer } from '@lucide/vue'

withDefaults(defineProps<{ variant?: 'banner' | 'pill' }>(), { variant: 'banner' })

const { game } = usePlayerSession()
const { now, remainingMs, gameOver, notStarted, urgent, startsAtMs } = useGameClock()

const deadlineLabel = computed(() => (game.value ? formatDeadline(game.value.deadline_at, now.value) : ''))
const startLabel = computed(() => (startsAtMs.value ? formatDeadline(new Date(startsAtMs.value).toISOString(), now.value) : ''))
</script>

<template>
  <div
    v-if="game"
    class="countdown"
    :class="[`countdown--${variant}`, { 'countdown--urgent': urgent, 'countdown--over': gameOver }]"
    role="timer"
    aria-live="off"
  >
    <Timer :size="variant === 'banner' ? 26 : 16" :stroke-width="2" aria-hidden="true" />

    <template v-if="variant === 'banner'">
      <div class="countdown__text">
        <template v-if="gameOver">
          <span class="countdown__caption">Réponses closes depuis {{ deadlineLabel }}</span>
          <span class="countdown__value">Partie terminée</span>
        </template>
        <template v-else>
          <span class="countdown__caption">
            {{ notStarted ? `Début du jeu ${startLabel} · fin des réponses ${deadlineLabel}` : `Fin des réponses ${deadlineLabel.includes(' à ') ? 'le ' : 'à '}${deadlineLabel}` }}
          </span>
          <span class="countdown__value">{{ formatCountdown(remainingMs) }}</span>
        </template>
      </div>
    </template>

    <span v-else class="countdown__pill-text">
      {{ gameOver ? 'Terminé' : `Fin dans ${formatCountdown(remainingMs)}` }}
    </span>
  </div>
</template>

<style scoped>
.countdown {
  display: flex;
  align-items: center;
  background: var(--color-text);
  color: var(--color-surface);
}

.countdown--banner {
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--card-radius);
}

.countdown--pill {
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: 0.9375rem;
  white-space: nowrap;
}

.countdown--urgent {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.countdown--over {
  background: var(--status-refused-bg);
  color: var(--status-refused-fg);
}

.countdown__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.countdown__caption {
  font-size: 0.875rem;
  opacity: 0.85;
}

.countdown__value {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.countdown__pill-text {
  font-variant-numeric: tabular-nums;
}
</style>
