<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { AnswerType, MissionStatus } from '~/types/game'

const props = defineProps<{
  title: string
  basePoints: number
  answerTypes: AnswerType[]
  status: MissionStatus
  imageUrl?: string | null
  hasBonus?: boolean
  /** Nombre de validations obtenues (missions répétables). */
  validatedCount?: number
  /** Nombre maximum de validations ; > 1 = mission répétable. */
  maxValidations?: number
  /** Dernière réponse refusée pendant la partie : la mission reste à faire. */
  lastRefused?: boolean
  to?: RouteLocationRaw
}>()

const repeatable = computed(() => (props.maxValidations ?? 1) > 1)

const statusLabel = computed(() => {
  if (props.status === 'validated' && repeatable.value && (props.validatedCount ?? 0) > 1) {
    return `Validée ${props.validatedCount} fois`
  }
  return undefined
})

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : 'article'))
</script>

<template>
  <component :is="tag" :to="to" class="mission-card" :class="`mission-card--${status}`">
    <div class="mission-card__media" :class="{ placeholder: !imageUrl }">
      <img v-if="imageUrl" :src="imageUrl" alt="" loading="lazy">
      <AnswerTypeIcon class="mission-card__type" :types="answerTypes" />
      <PointsBadge class="mission-card__points" :points="basePoints" />
    </div>

    <div class="mission-card__body">
      <h3 class="mission-card__title">{{ title }}</h3>

      <div class="mission-card__meta">
        <BonusBadge v-if="hasBonus" />
        <span v-if="repeatable" class="mission-card__repeat">{{ validatedCount ?? 0 }} / {{ maxValidations }}</span>
      </div>

      <div class="mission-card__footer">
        <StatusBadge :status="status" :label="statusLabel" />
        <span v-if="lastRefused && status === 'todo'" class="mission-card__hint">Réponse refusée, réessaie</span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.mission-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: var(--card-border-width) solid var(--card-border-color);
  border-radius: var(--card-radius);
  background-color: var(--card-bg);
  background-image: var(--card-bg-image);
  background-size: cover;
  background-position: center;
  box-shadow: var(--card-shadow);
  color: var(--color-text);
  text-decoration: none;
  transition: transform 0.1s;
}

a.mission-card:active {
  transform: scale(0.98);
}

/* Statut lisible d'un coup d'œil : bordure appuyée pour les missions validées */
.mission-card--validated {
  border-color: var(--status-validated-fg);
  border-width: max(2px, var(--card-border-width));
}

.mission-card--refused .mission-card__media {
  filter: grayscale(0.7);
  opacity: 0.8;
}

.mission-card__media {
  position: relative;
  aspect-ratio: 16 / 9;
}

.mission-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mission-card__type {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
}

.mission-card__points {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.mission-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-4);
}

.mission-card__title {
  font-size: 1.0625rem;
  font-weight: 700;
}

.mission-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.mission-card__meta:empty {
  display: none;
}

.mission-card__repeat {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--status-todo-bg);
  color: var(--status-todo-fg);
  font-size: 0.8125rem;
  font-weight: 600;
}

.mission-card__footer {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: auto;
}

.mission-card__hint {
  color: var(--status-refused-fg);
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
