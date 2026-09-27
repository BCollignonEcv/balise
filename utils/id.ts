/** Identifiant aléatoire (crypto.randomUUID n'existe qu'en HTTPS / localhost). */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
