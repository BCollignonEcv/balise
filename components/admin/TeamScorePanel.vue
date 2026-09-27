<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import type { ScoreAdjustment } from '~/types/database'

const props = defineProps<{
  score: TeamScore
  adjustments: ScoreAdjustment[]
  add: (points: number, reason: string) => Promise<void>
  remove: (adjustment: ScoreAdjustment) => Promise<void>
}>()

const open = ref(false)
const points = ref<number | ''>('')
const reason = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

async function submit() {
  error.value = null
  if (typeof points.value !== 'number' || !Number.isInteger(points.value) || points.value === 0) {
    error.value = 'Indique un nombre de points entier, positif (bonus) ou négatif (malus).'
    return
  }
  if (!reason.value.trim()) {
    error.value = 'Indique le motif : il sera visible par l’équipe.'
    return
  }
  busy.value = true
  try {
    await props.add(points.value, reason.value)
    points.value = ''
    reason.value = ''
    open.value = false
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    busy.value = false
  }
}

async function destroy(adjustment: ScoreAdjustment) {
  if (!window.confirm(`Supprimer l’ajustement ${signed(adjustment.points)} pts (« ${adjustment.reason} ») ?`)) return
  try {
    await props.remove(adjustment)
  }
  catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <section class="score">
    <div class="score__head">
      <h2 class="score__title">Score détaillé</h2>
      <p class="score__total">{{ score.total }} pts</p>
    </div>

    <div class="score__tiles">
      <div class="tile"><span>Base</span><strong>{{ score.base }}</strong></div>
      <div class="tile"><span>Bonus</span><strong>{{ score.bonus }}</strong></div>
      <div class="tile"><span>Ajustements</span><strong>{{ score.adjustments ? signed(score.adjustments) : 0 }}</strong></div>
    </div>

    <ul v-if="adjustments.length" class="adjustments">
      <li v-for="a in adjustments" :key="a.id" class="adjustment">
        <strong :class="a.points > 0 ? 'plus' : 'minus'">{{ signed(a.points) }}</strong>
        <span class="adjustment__reason">{{ a.reason }}</span>
        <span class="adjustment__time">{{ formatTime(a.created_at) }}</span>
        <button type="button" class="icon-btn" :aria-label="`Supprimer l’ajustement ${a.reason}`" @click="destroy(a)">
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </li>
    </ul>

    <form v-if="open" class="adjust-form" @submit.prevent="submit">
      <div class="adjust-form__row">
        <input v-model.number="points" class="input adjust-form__points" type="number" inputmode="numeric" step="1" placeholder="+20 ou -10" aria-label="Points">
        <input v-model="reason" class="input" type="text" placeholder="Motif (visible par l’équipe)" aria-label="Motif">
      </div>
      <div class="adjust-form__actions">
        <AppButton variant="outline" :disabled="busy" @click="open = false">Annuler</AppButton>
        <AppButton type="submit" variant="secondary" :loading="busy">Ajouter</AppButton>
      </div>
    </form>
    <AppButton v-else variant="outline" block @click="open = true">Ajuster les points (bonus / malus)</AppButton>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.score {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.score__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.score__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.score__total {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 800;
}

.score__tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.tile {
  display: flex;
  flex-direction: column;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--admin-bg);
}

.tile span {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.tile strong {
  font-size: 1.125rem;
}

.adjustments {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adjustment {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9375rem;
}

.plus {
  color: var(--status-validated-fg);
}

.minus {
  color: var(--status-refused-fg);
}

.adjustment__reason {
  flex: 1;
  min-width: 0;
}

.adjustment__time {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--status-refused-fg);
}

.adjust-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.adjust-form__row {
  display: flex;
  gap: var(--space-2);
}

.adjust-form__points {
  flex: none;
  width: 120px;
}

.adjust-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
