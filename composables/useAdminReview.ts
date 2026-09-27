import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  Game, Mission, MissionSecret, ScoreAdjustment, SubmissionStatus, Team, TeamSubmission,
} from '~/types/database'

export type MissionWithSecret = Mission & { secret: MissionSecret | null }

/** Une soumission demande une action de l'admin : en attente, ou bonus à vérifier. */
export function needsReview(s: TeamSubmission) {
  return s.status === 'pending' || s.bonus_state === 'pending'
}

const REVIEW_ERRORS: Record<string, string> = {
  max_reached: 'Impossible : cette équipe a déjà atteint le nombre maximum de validations pour cette mission.',
  invalid_bonus: 'Nombre de bonus invalide.',
  submission_not_found: 'Cette réponse n’existe plus.',
}

function reviewError(error: unknown) {
  const message = (error as { message?: string })?.message ?? ''
  const key = Object.keys(REVIEW_ERRORS).find(k => message.includes(k))
  return key ? REVIEW_ERRORS[key]! : friendlyError(error)
}

/**
 * Données de validation d'une partie (admin), tenues à jour en direct :
 * équipes, missions (avec réponses attendues), soumissions, ajustements.
 */
export function useAdminReview(gameId: string) {
  const supabase = useAdminSupabase()

  const game = ref<Game | null>(null)
  const teams = ref<Team[]>([])
  const missions = ref<MissionWithSecret[]>([])
  const submissions = ref<TeamSubmission[]>([])
  const adjustments = ref<ScoreAdjustment[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  let channel: RealtimeChannel | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | undefined

  async function fetchSubmissions() {
    const [subsRes, adjRes] = await Promise.all([
      supabase
        .from('submissions')
        .select('*, participant:participants(name), media:submission_media(*)')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false }),
      supabase.from('score_adjustments').select('*').eq('game_id', gameId).order('created_at', { ascending: false }),
    ])
    if (subsRes.error || adjRes.error) {
      error.value = friendlyError(subsRes.error ?? adjRes.error)
      return
    }
    submissions.value = subsRes.data as TeamSubmission[]
    adjustments.value = adjRes.data as ScoreAdjustment[]
  }

  async function load() {
    loading.value = true
    const [gameRes, teamsRes, missionsRes] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('teams').select('*').eq('game_id', gameId).order('position').order('created_at'),
      supabase.from('missions').select('*, secret:mission_secrets(*)').eq('game_id', gameId).order('position'),
    ])
    const err = gameRes.error ?? teamsRes.error ?? missionsRes.error
    if (err) error.value = friendlyError(err)
    else if (!gameRes.data) error.value = 'Partie introuvable.'
    else {
      game.value = gameRes.data as Game
      teams.value = teamsRes.data as Team[]
      missions.value = missionsRes.data as MissionWithSecret[]
      await fetchSubmissions()
    }
    loading.value = false
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(fetchSubmissions, 300)
  }

  onMounted(async () => {
    await load()
    channel = supabase
      .channel(`admin-review:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_adjustments', filter: `game_id=eq.${gameId}` }, scheduleRefresh)
      .subscribe()
  })

  onBeforeUnmount(() => {
    clearTimeout(refreshTimer)
    if (channel) supabase.removeChannel(channel)
  })

  const missionById = computed(() => new Map(missions.value.map(m => [m.id, m])))
  const teamById = computed(() => new Map(teams.value.map(t => [t.id, t])))

  function pendingCount(teamId?: string) {
    return submissions.value.filter(s => needsReview(s) && (!teamId || s.team_id === teamId)).length
  }

  function scoreOf(teamId: string) {
    return teamScore(
      missions.value,
      submissions.value.filter(s => s.team_id === teamId),
      adjustments.value.filter(a => a.team_id === teamId),
    )
  }

  /* ---- Actions ---- */

  async function review(submission: TeamSubmission, status: SubmissionStatus, bonusCount = 0, comment = '') {
    const { error: err } = await supabase.rpc('review_submission', {
      p_submission_id: submission.id,
      p_status: status,
      p_bonus_count: bonusCount,
      p_comment: comment,
    })
    if (err) throw new Error(reviewError(err))
    await fetchSubmissions()
  }

  async function removeMediaFiles(paths: string[]) {
    // Par paquets : l'API de stockage limite le nombre de fichiers par appel.
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from(SUBMISSIONS_BUCKET).remove(paths.slice(i, i + 100))
    }
  }

  async function deleteSubmission(submission: TeamSubmission) {
    const { error: err } = await supabase.from('submissions').delete().eq('id', submission.id)
    if (err) throw new Error(friendlyError(err))
    await removeMediaFiles(submission.media.map(m => m.path))
    await fetchSubmissions()
  }

  async function addAdjustment(teamId: string, points: number, reason: string) {
    const { error: err } = await supabase
      .from('score_adjustments')
      .insert({ game_id: gameId, team_id: teamId, points, reason: reason.trim() })
    if (err) throw new Error(friendlyError(err))
    await fetchSubmissions()
  }

  async function deleteAdjustment(adjustment: ScoreAdjustment) {
    const { error: err } = await supabase.from('score_adjustments').delete().eq('id', adjustment.id)
    if (err) throw new Error(friendlyError(err))
    await fetchSubmissions()
  }

  return {
    game, teams, missions, submissions, adjustments, loading, error,
    missionById, teamById, pendingCount, scoreOf,
    review, deleteSubmission, addAdjustment, deleteAdjustment, removeMediaFiles,
  }
}
