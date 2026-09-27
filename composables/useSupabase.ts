import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Deux clients Supabase distincts, chacun avec sa propre session stockée
 * séparément dans le navigateur : l'organisateur peut ainsi être connecté à
 * l'admin et tester la vue participant sur le même téléphone.
 */
type ClientKind = 'admin' | 'player'

const clients: Partial<Record<ClientKind, SupabaseClient>> = {}

function getClient(kind: ClientKind): SupabaseClient {
  const existing = clients[kind]
  if (existing) return existing

  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL et SUPABASE_KEY doivent être définis dans le fichier .env')
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storageKey: `balise-${kind}`,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  clients[kind] = client
  return client
}

/** Client utilisé par les pages d'administration. */
export const useAdminSupabase = () => getClient('admin')

/** Client utilisé par les pages participant (session anonyme). */
export const usePlayerSupabase = () => getClient('player')
