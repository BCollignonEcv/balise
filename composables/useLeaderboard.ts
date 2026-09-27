export interface LeaderboardRow {
  team_id: string
  name: string
  color: string
  base_points: number
  bonus_points: number
  adjustment_points: number
  total_points: number
  validated_missions: number
  rank: number
}

interface LeaderboardState {
  gameId: string | null
  rows: LeaderboardRow[]
  loaded: boolean
  error: string | null
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined

/** « 1er », « 2e », « 3e »… */
export function ordinal(rank: number) {
  return rank === 1 ? '1er' : `${rank}e`
}

/** Classement de la partie (totaux par équipe), rafraîchi sur le signal « scores_changed ». */
export function useLeaderboard() {
  const supabase = usePlayerSupabase()
  const state = useState<LeaderboardState>('leaderboard', () => ({ gameId: null, rows: [], loaded: false, error: null }))

  async function load(gameId: string) {
    if (state.value.gameId !== gameId) state.value = { gameId, rows: [], loaded: false, error: null }
    const { data, error } = await supabase.rpc('get_leaderboard', { p_game_id: gameId })
    if (error) {
      state.value.error = friendlyError(error)
      return
    }
    state.value.rows = (data ?? []) as LeaderboardRow[]
    state.value.error = null
    state.value.loaded = true
  }

  /** Regroupe les signaux rapprochés (validation en série, réinitialisation…). */
  function refresh() {
    const gameId = state.value.gameId
    if (!gameId) return
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => load(gameId), 500)
  }

  /** Position d'une équipe : { rank, total } (ex. 2 sur 5). */
  function positionOf(teamId: string | undefined) {
    const row = state.value.rows.find(r => r.team_id === teamId)
    return row ? { rank: row.rank, total: state.value.rows.length } : null
  }

  return { state, load, refresh, positionOf }
}
