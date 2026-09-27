import type { JoinInfo, JoinParticipant, PlayerIdentity, PublicGame } from '~/types/database'

interface PlayerSessionState {
  code: string | null
  info: JoinInfo | null
  loading: boolean
  error: string | null
  /** Message ponctuel à afficher sur l'écran « rejoindre » (ex. après réinitialisation). */
  notice: string | null
  /** Heure serveur − heure du téléphone, en ms : le compte à rebours ne se fie pas à l'horloge locale. */
  clockOffsetMs: number
}

const CLAIM_ERRORS: Record<string, string> = {
  already_taken: 'Ce nom vient d’être choisi sur un autre appareil.',
  game_not_open: 'Cette partie n’est pas ouverte.',
  participant_not_found: 'Ce nom n’existe plus dans la partie.',
  not_authenticated: 'Session introuvable, recharge la page.',
}

/** Session participant : partie courante, identité choisie sur cet appareil. */
export function usePlayerSession() {
  const supabase = usePlayerSupabase()
  const state = useState<PlayerSessionState>('player-session', () => ({
    code: null,
    info: null,
    loading: false,
    error: null,
    notice: null,
    clockOffsetMs: 0,
  }))
  const theme = useState<GameTheme | null>('game-theme', () => null)

  const game = computed<PublicGame | null>(() => (state.value.info && !state.value.info.error ? state.value.info.game : null))
  const participants = computed<JoinParticipant[]>(() => (state.value.info && !state.value.info.error ? state.value.info.participants : []))
  const me = computed<PlayerIdentity | null>(() => (state.value.info && !state.value.info.error ? state.value.info.me : null))

  /** Charge (ou recharge) la partie à partir de son code. */
  async function load(code: string, { silent = false } = {}) {
    if (!silent) state.value.loading = true
    state.value.code = code
    const requestedAt = Date.now()
    const { data, error } = await supabase.rpc('get_join_info', { p_code: code })
    if (error) {
      if (!silent) state.value.error = friendlyError(error)
    }
    else {
      const info = data as JoinInfo
      state.value.info = info
      state.value.error = null
      if (!info.error) {
        const localMidpoint = (requestedAt + Date.now()) / 2
        state.value.clockOffsetMs = new Date(info.server_now).getTime() - localMidpoint
        theme.value = info.game.theme ?? null
      }
    }
    state.value.loading = false
  }

  /** Choisit un nom : crée si besoin une session anonyme, puis verrouille le nom côté serveur. */
  async function claim(participantId: string) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) {
        throw new Error(error.status === 429
          ? 'Trop de connexions en même temps. Réessaie dans quelques instants.'
          : friendlyError(error))
      }
    }

    const { error } = await supabase.rpc('claim_participant', { p_participant_id: participantId })
    if (state.value.code) await load(state.value.code, { silent: true })
    if (error) {
      const key = Object.keys(CLAIM_ERRORS).find(k => error.message.includes(k))
      throw new Error(key ? CLAIM_ERRORS[key] : friendlyError(error))
    }
  }

  function setNotice(message: string | null) {
    state.value.notice = message
  }

  return { state: readonly(state), game, participants, me, load, claim, setNotice }
}
