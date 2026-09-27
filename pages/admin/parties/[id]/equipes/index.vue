<script setup lang="ts">
import { Pencil, RotateCcw, Trash2, UserPlus } from '@lucide/vue'
import type { Game, Participant, Team } from '~/types/database'

definePageMeta({ layout: 'admin' })

const route = useRoute()
const supabase = useAdminSupabase()
const gameId = route.params.id as string

const {
  teams, participants, loading, error,
  addTeam, updateTeam, deleteTeam,
  addParticipants, assignTeam, renameParticipant, resetParticipant, deleteParticipant,
} = useTeamsAdmin(gameId)

const game = ref<Pick<Game, 'id' | 'name'> | null>(null)
onMounted(async () => {
  const { data } = await supabase.from('games').select('id, name').eq('id', gameId).maybeSingle()
  game.value = data
})

useHead(() => ({ title: `Équipes · ${game.value?.name ?? 'Partie'} · Admin Balise` }))

const claimedCount = computed(() => participants.value.filter(p => p.claimed_by).length)

/* ---- Équipes ---- */
const newTeam = reactive({ name: '', color: TEAM_COLORS[0]! })
const addingTeam = ref(false)

async function submitTeam() {
  if (!newTeam.name.trim()) return
  addingTeam.value = true
  const ok = await addTeam(newTeam.name, newTeam.color)
  addingTeam.value = false
  if (ok) {
    newTeam.name = ''
    newTeam.color = TEAM_COLORS[teams.value.length % TEAM_COLORS.length]!
  }
}

const editing = ref<{ id: string; name: string; color: string } | null>(null)

function startEdit(team: Team) {
  editing.value = { id: team.id, name: team.name, color: team.color }
}

async function saveEdit(team: Team) {
  if (!editing.value?.name.trim()) return
  if (await updateTeam(team, { name: editing.value.name.trim(), color: editing.value.color })) editing.value = null
}

async function removeTeam(team: Team) {
  const count = membersOf(team.id).length
  const warning = `Supprimer l’équipe « ${team.name} » ?`
    + (count ? `\n${count} participant(s) deviendront « sans équipe ».` : '')
    + '\nLes réponses déjà envoyées par cette équipe seront supprimées.'
  if (!window.confirm(warning)) return
  if (await deleteTeam(team)) editing.value = null
}

/* ---- Participants ---- */
const newNames = ref('')
const newNamesTeam = ref<string | null>(null)
const addingParticipants = ref(false)
const addFeedback = ref<string | null>(null)

watch(teams, (list) => {
  if (!newNamesTeam.value && list.length) newNamesTeam.value = list[0]!.id
}, { immediate: true })

async function submitParticipants() {
  addFeedback.value = null
  addingParticipants.value = true
  const { added, skipped } = await addParticipants(newNames.value.split(/\r?\n|,/), newNamesTeam.value)
  addingParticipants.value = false
  if (added) {
    newNames.value = ''
    addFeedback.value = `${added} participant${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}`
      + (skipped ? ` · ${skipped} déjà existant${skipped > 1 ? 's' : ''}` : '')
  }
}

function membersOf(teamId: string | null) {
  return participants.value
    .filter(p => p.team_id === teamId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

const groups = computed(() => {
  const list = teams.value.map(team => ({ key: team.id, team, members: membersOf(team.id) }))
  const orphans = membersOf(null)
  return orphans.length ? [...list, { key: 'none', team: null, members: orphans }] : list
})

function onAssign(participant: Participant, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  assignTeam(participant, value || null)
}

function rename(participant: Participant) {
  const name = window.prompt('Nouveau nom', participant.name)
  if (name && name.trim() && name.trim() !== participant.name) renameParticipant(participant, name)
}

function reset(participant: Participant) {
  if (window.confirm(`Réinitialiser « ${participant.name} » ?\nSon nom redevient disponible et l’appareil qui l’avait choisi est déconnecté. Les réponses de son équipe sont conservées.`)) {
    resetParticipant(participant)
  }
}

function remove(participant: Participant) {
  if (window.confirm(`Supprimer « ${participant.name} » de la partie ?`)) deleteParticipant(participant)
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <div class="page">
    <AdminTopBar
      title="Équipes et participants"
      :subtitle="game?.name"
      :back="{ to: `/admin/parties/${gameId}`, label: game?.name ?? 'Partie' }"
    />

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" class="empty">Chargement…</p>

    <template v-else>
      <p class="summary">
        {{ teams.length }} équipe{{ teams.length > 1 ? 's' : '' }} ·
        {{ participants.length }} participant{{ participants.length > 1 ? 's' : '' }} ·
        <strong>{{ claimedCount }} connecté{{ claimedCount > 1 ? 's' : '' }}</strong>
      </p>

      <!-- Équipes -->
      <section class="panel">
        <h2 class="panel__title">Équipes</h2>

        <ul v-if="teams.length" class="teams">
          <li v-for="team in teams" :key="team.id" class="team">
            <template v-if="editing?.id === team.id">
              <div class="team__edit">
                <input v-model="editing.name" class="input" type="text" aria-label="Nom de l’équipe" @keydown.enter.prevent="saveEdit(team)">
                <AdminColorPicker v-model="editing.color" :colors="TEAM_COLORS" />
                <div class="row">
                  <AppButton variant="secondary" @click="saveEdit(team)">Enregistrer</AppButton>
                  <AppButton variant="outline" @click="editing = null">Annuler</AppButton>
                  <AppButton variant="danger" class="push" @click="removeTeam(team)">
                    <Trash2 :size="16" aria-hidden="true" /> Supprimer
                  </AppButton>
                </div>
              </div>
            </template>
            <template v-else>
              <span class="dot" :style="{ background: team.color }" />
              <span class="team__name">{{ team.name }}</span>
              <span class="muted">{{ membersOf(team.id).length }} membre{{ membersOf(team.id).length > 1 ? 's' : '' }}</span>
              <button type="button" class="icon-btn" :aria-label="`Modifier ${team.name}`" @click="startEdit(team)">
                <Pencil :size="16" aria-hidden="true" />
              </button>
            </template>
          </li>
        </ul>

        <form class="add-team" @submit.prevent="submitTeam">
          <input v-model="newTeam.name" class="input" type="text" placeholder="Nom de la nouvelle équipe" aria-label="Nom de la nouvelle équipe">
          <AdminColorPicker v-model="newTeam.color" :colors="TEAM_COLORS" />
          <AppButton type="submit" variant="secondary" :disabled="!newTeam.name.trim()" :loading="addingTeam">
            Ajouter l’équipe
          </AppButton>
        </form>
      </section>

      <!-- Ajout de participants -->
      <section class="panel">
        <h2 class="panel__title">Ajouter des participants</h2>
        <form class="add-participants" @submit.prevent="submitParticipants">
          <div class="field">
            <label class="field__label" for="new-names">Noms</label>
            <textarea id="new-names" v-model="newNames" class="input" rows="4" placeholder="Un nom par ligne&#10;Camille&#10;Hugo" />
            <span class="field__hint">Un nom par ligne (ou séparés par des virgules). Les doublons sont ignorés.</span>
          </div>
          <div class="field">
            <label class="field__label" for="new-names-team">Équipe</label>
            <select id="new-names-team" v-model="newNamesTeam" class="input">
              <option :value="null">Sans équipe</option>
              <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
          </div>
          <AppButton type="submit" variant="secondary" :disabled="!newNames.trim()" :loading="addingParticipants">
            <UserPlus :size="16" aria-hidden="true" /> Ajouter
          </AppButton>
          <p v-if="addFeedback" class="feedback" role="status">{{ addFeedback }}</p>
        </form>
      </section>

      <!-- Participants par équipe -->
      <p v-if="!participants.length" class="empty">Aucun participant pour l’instant.</p>

      <section v-for="group in groups" :key="group.key" class="panel">
        <h2 class="panel__title group-title">
          <span v-if="group.team" class="dot" :style="{ background: group.team.color }" />
          {{ group.team?.name ?? 'Sans équipe' }}
          <span class="muted">· {{ group.members.length }}</span>
        </h2>
        <p v-if="!group.team" class="field__hint">Ces participants n’apparaissent pas dans la liste de choix tant qu’ils n’ont pas d’équipe.</p>
        <p v-if="!group.members.length" class="muted">Aucun membre.</p>

        <ul class="people">
          <li v-for="p in group.members" :key="p.id" class="person">
            <span class="avatar" :style="{ background: group.team?.color ?? 'var(--status-todo-fg)' }">{{ initial(p.name) }}</span>
            <div class="person__text">
              <button type="button" class="person__name" :title="`Renommer ${p.name}`" @click="rename(p)">{{ p.name }}</button>
              <span v-if="p.claimed_by" class="state state--taken">Sélectionné · {{ formatDateTime(p.claimed_at) }}</span>
              <span v-else class="state">Disponible</span>
            </div>
            <div class="person__actions">
              <select class="input input--compact" :value="p.team_id ?? ''" :aria-label="`Équipe de ${p.name}`" @change="onAssign(p, $event)">
                <option value="">Sans équipe</option>
                <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
              </select>
              <button v-if="p.claimed_by" type="button" class="icon-btn" :aria-label="`Réinitialiser ${p.name}`" title="Réinitialiser" @click="reset(p)">
                <RotateCcw :size="16" aria-hidden="true" />
              </button>
              <button type="button" class="icon-btn icon-btn--danger" :aria-label="`Supprimer ${p.name}`" title="Supprimer" @click="remove(p)">
                <Trash2 :size="16" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
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
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
  text-align: center;
}

.summary {
  color: var(--color-text-muted);
  font-size: 0.9375rem;
}

.summary strong {
  color: var(--admin-live-fg);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.panel__title {
  font-family: var(--font-body);
  font-size: 1.125rem;
  font-weight: 700;
}

.group-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.muted {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-weight: 400;
}

.dot {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.push {
  margin-left: auto;
}

.teams,
.people {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.team {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  border-bottom: 1px solid var(--color-border);
}

.team__name {
  flex: 1;
  font-weight: 600;
}

.team__edit {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.add-team,
.add-participants {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.feedback {
  color: var(--admin-live-fg);
  font-weight: 600;
}

.icon-btn {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.icon-btn--danger {
  color: var(--status-refused-fg);
}

.person {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.person:last-child {
  border-bottom: none;
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-on-secondary);
  font-weight: 700;
}

.person__text {
  display: flex;
  flex: 1 1 120px;
  flex-direction: column;
  min-width: 0;
}

.person__name {
  padding: 0;
  border: none;
  background: none;
  font-weight: 600;
  text-align: left;
}

.state {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.state--taken {
  color: var(--admin-live-fg);
  font-weight: 600;
}

.person__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

.input--compact {
  width: auto;
  max-width: 160px;
  min-height: 40px;
  padding: 0 var(--space-2);
  font-size: 0.9375rem;
}
</style>
