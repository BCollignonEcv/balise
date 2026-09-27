<script setup lang="ts">
import { WifiOff } from '@lucide/vue'

/** Prévient l'équipe quand le téléphone perd le réseau (rien n'est envoyé pendant ce temps). */
const online = ref(true)
const update = () => (online.value = navigator.onLine)

onMounted(() => {
  update()
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', update)
  window.removeEventListener('offline', update)
})
</script>

<template>
  <Transition name="slide">
    <div v-if="!online" class="offline" role="alert">
      <WifiOff :size="18" aria-hidden="true" />
      Pas de connexion : tes réponses ne partiront qu’une fois le réseau revenu.
    </div>
  </Transition>
</template>

<style scoped>
.offline {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: calc(var(--space-2) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-2);
  background: var(--status-refused-fg);
  color: var(--color-on-primary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-100%);
}
</style>
