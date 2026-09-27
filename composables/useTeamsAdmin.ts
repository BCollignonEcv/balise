import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Participant, Team } from '~/types/database'

/** Couleurs proposées pour les équipes (contrastées sur fond clair). */
export const TEAM_COLORS = ['#0F5E63', '#9A3412', '#3F4B8C', '#6B4F12', '#4A504C', '#BE185D', '#15803D', '#7C3AED']

/** Équipes et participants d'une partie, avec suivi en direct des sélections. */
export function useTeamsAdmin(gameId: string) {
  const supabase = useAdminSupabase()

  const teams = ref<Team[]>([])
  const participants = ref<Participant[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  let channel: RealtimeChannel | null = null

  async function load() {
    const [teamsRes, participantsRes] = await Promise.all([
      supabase.from('teams').select('*').eq('game_id', gameId).order('position').order('created_at'),
      supabase.from('participants').select('*').eq('game_id', gameId).order('name'),
    ])
    if (teamsRes.error || participantsRes.error) {
      error.value = friendlyError(teamsRes.error ?? participantsRes.error)
    }
    else {
      teams.value = teamsRes.data as Team[]
      participants.value = participantsRes.data as Participant[]
    }
    loading.value = false
  }

  function subscribe() {
    channel = supabase
      .channel(`admin-participants:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `game_id=eq.${gameId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          participants.value = participants.value.filter(p => p.id !== (payload.old as Participant).id)
          return
        }
        const row = payload.new as Participant
        const index = participants.value.findIndex(p => p.id === row.id)
        if (index === -1) participants.value.push(row)
        else participants.value[index] = row
      })
      .subscribe()
  }

  onMounted(async () => {
    await load()
    subscribe()
  })
  onBeforeUnmount(() => {
    if (channel) supabase.removeChannel(channel)
  })

  /** Exécute une action et remonte une erreur lisible. */
  async function run(action: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
    error.value = null
    const { error: err } = await action()
    if (err) {
      error.value = friendlyError(err)
      return false
    }
    return true
  }

  /* ---- Équipes ---- */
  async function addTeam(name: string, color: string) {
    const position = (teams.value.at(-1)?.position ?? 0) + 1
    const { data, error: err } = await supabase
      .from('teams')
      .insert({ game_id: gameId, name: name.trim(), color, position })
      .select('*')
      .single()
    if (err) {
      error.value = friendlyError(err)
      return false
    }
    teams.value.push(data as Team)
    return true
  }

  async function updateTeam(team: Team, changes: Pick<Team, 'name' | 'color'>) {
    const ok = await run(() => supabase.from('teams').update(changes).eq('id', team.id))
    if (ok) Object.assign(team, changes)
    return ok
  }

  async function deleteTeam(team: Team) {
    const ok = await run(() => supabase.from('teams').delete().eq('id', team.id))
    if (ok) {
      teams.value = teams.value.filter(t => t.id !== team.id)
      for (const p of participants.value) if (p.team_id === team.id) p.team_id = null
    }
    return ok
  }

  /* ---- Participants ---- */
  async function addParticipants(names: string[], teamId: string | null) {
    const existing = new Set(participants.value.map(p => p.name.toLowerCase()))
    const unique = [...new Set(names.map(n => n.trim()).filter(Boolean))]
    const fresh = unique.filter(n => !existing.has(n.toLowerCase()))
    const skipped = unique.length - fresh.length
    if (!fresh.length) {
      error.value = skipped ? 'Ces noms existent déjà dans la partie.' : 'Saisis au moins un nom.'
      return { added: 0, skipped }
    }
    const { data, error: err } = await supabase
      .from('participants')
      .insert(fresh.map(name => ({ game_id: gameId, name, team_id: teamId })))
      .select('*')
    if (err) {
      error.value = friendlyError(err)
      return { added: 0, skipped }
    }
    for (const row of data as Participant[]) {
      if (!participants.value.some(p => p.id === row.id)) participants.value.push(row)
    }
    return { added: data.length, skipped }
  }

  async function assignTeam(participant: Participant, teamId: string | null) {
    const ok = await run(() => supabase.from('participants').update({ team_id: teamId }).eq('id', participant.id))
    if (ok) participant.team_id = teamId
    return ok
  }

  async function renameParticipant(participant: Participant, name: string) {
    const ok = await run(() => supabase.from('participants').update({ name: name.trim() }).eq('id', participant.id))
    if (ok) participant.name = name.trim()
    return ok
  }

  /** Rend le nom à nouveau disponible et déconnecte l'appareil qui l'avait choisi. */
  async function resetParticipant(participant: Participant) {
    const ok = await run(() =>
      supabase.from('participants').update({ claimed_by: null, claimed_at: null }).eq('id', participant.id),
    )
    if (ok) {
      participant.claimed_by = null
      participant.claimed_at = null
    }
    return ok
  }

  async function deleteParticipant(participant: Participant) {
    const ok = await run(() => supabase.from('participants').delete().eq('id', participant.id))
    if (ok) participants.value = participants.value.filter(p => p.id !== participant.id)
    return ok
  }

  return {
    teams,
    participants,
    loading,
    error,
    addTeam,
    updateTeam,
    deleteTeam,
    addParticipants,
    assignTeam,
    renameParticipant,
    resetParticipant,
    deleteParticipant,
  }
}
