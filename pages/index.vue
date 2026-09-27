<script setup lang="ts">
import { Compass } from '@lucide/vue'

definePageMeta({ layout: 'game' })
useHead({ title: 'Rejoindre une partie · Balise' })

const code = ref('')
const normalizedCode = computed(() => code.value.trim().toUpperCase().replace(/\s+/g, ''))

function join() {
  if (!normalizedCode.value) return
  navigateTo(`/j/${encodeURIComponent(normalizedCode.value)}`)
}
</script>

<template>
  <main class="home">
    <div class="home__logo" aria-hidden="true">
      <Compass :size="28" :stroke-width="2" />
    </div>

    <h1 class="home__title">Jeu de piste</h1>
    <p class="home__lead">Saisis le code de la partie donné par l'organisateur.</p>

    <form class="home__form" @submit.prevent="join">
      <label for="code" class="home__label">Code de la partie</label>
      <input
        id="code"
        v-model="code"
        class="home__input"
        type="text"
        inputmode="text"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        placeholder="Ex. : TRAQUE24"
      >
      <AppButton type="submit" size="lg" block :disabled="!normalizedCode">Rejoindre</AppButton>
    </form>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  max-width: 480px;
  margin: 0 auto;
  padding: 15vh var(--space-5) var(--space-8);
}

.home__logo {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.home__title {
  font-size: 2.5rem;
  font-weight: 800;
}

.home__lead {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 1.125rem;
}

.home__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.home__label {
  font-weight: 600;
}

.home__input {
  min-height: 56px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.home__input::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
}
</style>
