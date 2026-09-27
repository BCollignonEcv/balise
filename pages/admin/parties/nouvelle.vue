<script setup lang="ts">
import type { GameFormValues } from '~/types/database'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Nouvelle partie · Admin Balise' })

const supabase = useAdminSupabase()
const saving = ref(false)
const error = ref<string | null>(null)

async function create(values: GameFormValues) {
  saving.value = true
  error.value = null
  const { code, ...rest } = values
  // Sans code saisi, la base en génère un automatiquement.
  const payload = code ? values : rest
  const { data, error: err } = await supabase.from('games').insert(payload).select('id').single()
  saving.value = false
  if (err) {
    error.value = friendlyError(err)
    return
  }
  await navigateTo(`/admin/parties/${data.id}`, { replace: true })
}
</script>

<template>
  <div class="page">
    <AdminTopBar title="Nouvelle partie" :back="{ to: '/admin', label: 'Mes parties' }" />
    <section class="panel">
      <AdminGameForm submit-label="Créer la partie" :saving="saving" :error="error" @submit="create" />
    </section>
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

.panel {
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
</style>
