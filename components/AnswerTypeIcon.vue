<script setup lang="ts">
import { AlignLeft, Camera, MapPin, Video } from '@lucide/vue'
import { ANSWER_TYPE_LABELS, sortAnswerTypes, type AnswerType } from '~/types/game'

const props = withDefaults(defineProps<{
  /** Types de réponse acceptés (au moins un). */
  types: AnswerType[]
  /** Affiche le libellé à côté des icônes (ex. vue détaillée). */
  withLabel?: boolean
}>(), { withLabel: false })

const ICONS = { photo: Camera, video: Video, text: AlignLeft, gps: MapPin }

const sorted = computed(() => sortAnswerTypes(props.types))
const label = computed(() => sorted.value.map(t => ANSWER_TYPE_LABELS[t]).join(' ou '))
</script>

<template>
  <span
    class="answer-type"
    :class="{ 'answer-type--label': withLabel, 'answer-type--multi': sorted.length > 1 }"
    :title="label"
  >
    <component :is="ICONS[t]" v-for="t in sorted" :key="t" :size="16" :stroke-width="2" aria-hidden="true" />
    <span :class="withLabel ? '' : 'visually-hidden'">{{ label }}</span>
  </span>
</template>

<style scoped>
.answer-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
}

.answer-type--multi,
.answer-type--label {
  padding: 0 10px;
}

.answer-type--label {
  gap: var(--space-2);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
