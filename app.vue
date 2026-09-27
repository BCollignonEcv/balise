<script setup lang="ts">
// Thème par défaut appliqué à toute l'application (admin compris).
useHead({ style: [{ key: 'default-tokens', innerHTML: defaultTokensCss() }] })
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
