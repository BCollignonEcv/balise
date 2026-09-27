<template>
  <div class="admin">
    <slot />
  </div>
</template>

<style scoped>
/* L'admin n'est jamais thématisé : il consomme uniquement le thème par défaut. */
.admin {
  min-height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--admin-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}
</style>
