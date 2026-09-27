interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
}

/** Message d'erreur lisible en français à partir d'une erreur Supabase/Postgres. */
export function friendlyError(error: unknown, fallback = 'Une erreur est survenue.'): string {
  if (!error) return fallback
  const e = error as SupabaseLikeError
  switch (e.code) {
    case '23505':
      if (e.message?.includes('games_code')) return 'Ce code de partie est déjà utilisé.'
      return 'Cette valeur existe déjà.'
    case '23514':
      if (e.message?.includes('games_code')) return 'Le code doit contenir 4 à 12 lettres majuscules ou chiffres.'
      if (e.message?.includes('games_check')) return 'La date de début doit précéder la date limite.'
      return 'Une valeur saisie n’est pas valide.'
    case '23503':
      if (e.message?.includes('submissions')) return 'Impossible : des réponses ont déjà été envoyées pour cet élément.'
      return 'Impossible : cet élément est utilisé ailleurs.'
    case '42501':
      return 'Action non autorisée.'
    case 'PGRST301':
    case 'PGRST303':
      return 'Session expirée, reconnecte-toi.'
  }
  if (e.message?.includes('Failed to fetch')) return 'Connexion impossible. Vérifie ton réseau.'
  return e.message || fallback
}
