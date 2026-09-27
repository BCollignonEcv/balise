import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Mission, ScoreAdjustment, TeamSubmission } from '~/types/database'

interface PlayerGameData {
  key: string | null
  missions: Mission[]
  submissions: TeamSubmission[]
  adjustments: ScoreAdjustment[]
  loaded: boolean
  error: string | null
}

let channel: RealtimeChannel | null = null
let refreshTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Missions de la partie + soumissions et ajustements de l'équipe, tenus à jour
 * en direct. Démarré par la page /j/[code] dès que le participant est identifié.
 */
export function usePlayerGameData() {
  const supabase = usePlayerSupabase()
  const data = useState<PlayerGameData>('player-game-data', () => ({
    key: null,
    missions: [],
    submissions: [],
    adjustments: [],
    loaded: false,
    error: null,
  }))

  async function fetchAll(gameId: string, teamId: string) {
    const [missionsRes, submissionsRes, adjustmentsRes] = await Promise.all([
      supabase.from('missions').select('*').eq('game_id', gameId).order('position').order('created_at'),
      supabase
        .from('submissions')
        .select('*, participant:participants(name), media:submission_media(*)')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false }),
      supabase.from('score_adjustments').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    ])
    const error = missionsRes.error ?? submissionsRes.error ?? adjustmentsRes.error
    if (error) {
      data.value.error = friendlyError(error)
      return
    }
    data.value.missions = missionsRes.data as Mission[]
    data.value.submissions = submissionsRes.data as TeamSubmission[]
    data.value.adjustments = adjustmentsRes.data as ScoreAdjustment[]
    data.value.error = null
    data.value.loaded = true
  }

  /** Recharge en regroupant les événements rapprochés (plusieurs changements d'affilée). */
  function scheduleRefresh(gameId: string, teamId: string) {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => fetchAll(gameId, teamId), 300)
  }

  async function start(gameId: string, teamId: string) {
    const key = `${gameId}:${teamId}`
    if (data.value.key === key && channel) return
    stop()
    data.value = { key, missions: [], submissions: [], adjustments: [], loaded: false, error: null }
    await fetchAll(gameId, teamId)

    const refresh = () => scheduleRefresh(gameId, teamId)
    channel = supabase
      .channel(`team:${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `team_id=eq.${teamId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_adjustments', filter: `team_id=eq.${teamId}` }, refresh)
      // Mission ajoutée, modifiée ou supprimée par l'admin pendant la partie
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions', filter: `game_id=eq.${gameId}` }, refresh)
      .subscribe()
  }

  function stop() {
    clearTimeout(refreshTimer)
    if (channel) supabase.removeChannel(channel)
    channel = null
    data.value.key = null
  }

  /** Rechargement complet (retour sur l'onglet, modification des missions par l'admin…). */
  function refresh() {
    const [gameId, teamId] = data.value.key?.split(':') ?? []
    if (gameId && teamId) return fetchAll(gameId, teamId)
  }

  return { data, start, stop, refresh }
}
