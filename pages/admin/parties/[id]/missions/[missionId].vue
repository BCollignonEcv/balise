<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import type { Mission, MissionSecret } from '~/types/database'
import type { MissionFormValues, MissionImageChange } from '~/composables/useMissionAdmin'

definePageMeta({ layout: 'admin', key: route => route.fullPath })

const route = useRoute()
const supabase = useAdminSupabase()
const gameId = route.params.id as string
const missionId = route.params.missionId as string
const { save, remove } = useMissionAdmin(gameId)

const mission = ref<Mission | null>(null)
const secret = ref<MissionSecret | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const error = ref<string | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

useHead(() => ({ title: `${mission.value?.title ?? 'Mission'} · Admin Balise` }))

const listUrl = `/admin/parties/${gameId}/missions`

async function load() {
  const [missionRes, secretRes] = await Promise.all([
    supabase.from('missions').select('*').eq('id', missionId).eq('game_id', gameId).maybeSingle(),
    supabase.from('mission_secrets').select('*').eq('mission_id', missionId).maybeSingle(),
  ])
  if (missionRes.error || secretRes.error) loadError.value = friendlyError(missionRes.error ?? secretRes.error)
  else if (!missionRes.data) loadError.value = 'Mission introuvable.'
  else {
    mission.value = missionRes.data as Mission
    secret.value = secretRes.data as MissionSecret | null
  }
  loading.value = false
}

async function update(values: MissionFormValues, image: MissionImageChange) {
  saving.value = true
  error.value = null
  try {
    await save(missionId, values, image)
    await navigateTo(listUrl)
  }
  catch (e) {
    error.value = friendlyError(e)
  }
  finally {
    saving.value = false
  }
}

async function destroy() {
  if (!mission.value || !window.confirm(`Supprimer la mission « ${mission.value.title} » ?`)) return
  deleting.value = true
  deleteError.value = null
  try {
    await remove(missionId)
    await navigateTo(listUrl, { replace: true })
  }
  catch (e) {
    deleteError.value = friendlyError(e)
  }
  finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <AdminTopBar :title="mission?.title ?? 'Mission'" :back="{ to: listUrl, label: 'Missions' }" />

    <p v-if="loading" class="empty">Chargement…</p>
    <p v-else-if="loadError" class="form-error" role="alert">{{ loadError }}</p>

    <template v-else-if="mission">
      <AdminMissionForm
        :mission="mission"
        :secret="secret"
        submit-label="Enregistrer"
        :saving="saving"
        :error="error"
        @submit="update"
      />

      <section class="danger">
        <AppButton variant="danger" block :loading="deleting" @click="destroy">
          <Trash2 :size="16" aria-hidden="true" /> Supprimer la mission
        </AppButton>
        <p v-if="deleteError" class="form-error" role="alert">{{ deleteError }}</p>
      </section>
    </template>
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

.empty {
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.danger {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
</style>
