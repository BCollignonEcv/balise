<script setup lang="ts">
defineProps<{ score: TeamScore }>()

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
</script>

<template>
  <section class="score" aria-label="Score de l’équipe">
    <div>
      <p class="score__label">Score de l’équipe</p>
      <p class="score__total">{{ score.total }} <span class="score__unit">pts</span></p>
    </div>
    <dl class="score__detail">
      <div><dt>base</dt><dd>{{ score.base }}</dd></div>
      <div><dt>bonus</dt><dd>{{ score.bonus }}</dd></div>
      <div><dt>ajustement{{ Math.abs(score.adjustments) > 1 ? 's' : '' }}</dt><dd>{{ score.adjustments ? signed(score.adjustments) : 0 }}</dd></div>
    </dl>
  </section>
</template>

<style scoped>
.score {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--card-radius);
  background: var(--color-surface);
}

.score__label {
  font-size: 0.9375rem;
}

.score__total {
  color: var(--color-primary);
  font-family: var(--font-heading);
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.score__unit {
  color: var(--color-text);
  font-size: 1.25rem;
}

.score__detail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.score__detail div {
  display: flex;
  flex-direction: row-reverse;
  gap: 0.3em;
}

.score__detail dd {
  margin: 0;
}
</style>
