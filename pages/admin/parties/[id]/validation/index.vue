<script setup lang="ts">
// /validation sans équipe : renvoie vers la vue globale, qui liste les équipes.
definePageMeta({ layout: 'admin' })

const route = useRoute()
await navigateTo(`/admin/parties/${route.params.id}/soumissions`, { replace: true })
</script>

<template>
  <div />
</template>
