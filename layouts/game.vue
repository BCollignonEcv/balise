<script setup lang="ts">
/**
 * Mise en page des pages participant : seule zone thématisée de l'application.
 * Les pages renseignent le thème de la partie via useState('game-theme').
 */
const theme = useState<GameTheme | null>('game-theme', () => null)
const { style } = useGameTheme(theme)
</script>

<template>
  <div class="game themed" :style="style">
    <slot />
  </div>
</template>

<style scoped>
.game {
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: var(--color-bg);
  background-image: var(--page-bg-image);
  background-size: cover;
  background-position: center top;
  color: var(--color-text);
  font-family: var(--font-body);
}
</style>
