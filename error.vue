<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: notFound.value ? 'Page introuvable' : 'Erreur' })
</script>

<template>
  <main class="error-page themed">
    <h1 class="error-page__title">{{ notFound ? 'Page introuvable' : 'Oups…' }}</h1>
    <p class="error-page__text">
      {{ notFound
        ? 'Ce lien ne mène nulle part. Vérifie le lien de la partie, ou saisis son code.'
        : 'Une erreur inattendue est survenue. Recharge la page pour réessayer.' }}
    </p>
    <AppButton v-if="notFound" size="lg" @click="clearError({ redirect: '/' })">Saisir un code de partie</AppButton>
    <AppButton v-else size="lg" @click="clearError({ redirect: $route.fullPath })">Recharger</AppButton>
  </main>
</template>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  min-height: 100dvh;
  max-width: 480px;
  margin: 0 auto;
  padding: 15vh var(--space-5) var(--space-8);
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

.error-page__title {
  font-size: 2.25rem;
  font-weight: 800;
}

.error-page__text {
  color: var(--color-text-muted);
  font-size: 1.0625rem;
}
</style>
