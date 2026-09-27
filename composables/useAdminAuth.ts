interface AdminAuthState {
  ready: boolean
  email: string | null
  isAdmin: boolean
}

/** Session de l'organisateur (compte Supabase listé dans la table admins). */
export function useAdminAuth() {
  const supabase = useAdminSupabase()
  const state = useState<AdminAuthState>('admin-auth', () => ({ ready: false, email: null, isAdmin: false }))

  async function refresh() {
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    let isAdmin = false
    if (user && !user.is_anonymous) {
      const { data: row } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
      isAdmin = !!row
    }
    state.value = { ready: true, email: user?.email ?? null, isAdmin }
  }

  async function ensureReady() {
    if (!state.value.ready) await refresh()
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message)
    }
    await refresh()
    if (!state.value.isAdmin) {
      await signOut()
      throw new Error('Ce compte n’a pas les droits administrateur.')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    state.value = { ready: true, email: null, isAdmin: false }
  }

  return { state: readonly(state), ensureReady, signIn, signOut }
}
