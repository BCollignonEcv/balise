export const ASSETS_BUCKET = 'assets'

/** URL publique d'un fichier du bucket « assets » (images de missions et de thème). */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const { supabaseUrl } = useRuntimeConfig().public
  return `${supabaseUrl}/storage/v1/object/public/${ASSETS_BUCKET}/${path}`
}
