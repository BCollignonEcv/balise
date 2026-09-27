<script setup lang="ts">
import type { MissionFormValues, MissionImageChange } from '~/composables/useMissionAdmin'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Nouvelle mission · Admin Balise' })

const route = useRoute()
const gameId = route.params.id as string
const { save } = useMissionAdmin(gameId)

const saving = ref(false)
const error = ref<string | null>(null)

async function create(values: MissionFormValues, image: MissionImageChange) {
  saving.value = true
  error.value = null
  try {
    await save(null, values, image)
    await navigateTo(`/admin/parties/${gameId}/missions`, { replace: true })
  }
  catch (e) {
    error.value = friendlyError(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <AdminTopBar title="Nouvelle mission" :back="{ to: `/admin/parties/${gameId}/missions`, label: 'Missions' }" />
    <AdminMissionForm submit-label="Créer la mission" :saving="saving" :error="error" @submit="create" />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
  margin: 0 auto;
  padding: 0 var(--space-4) var(--space-8);
}
</style>
