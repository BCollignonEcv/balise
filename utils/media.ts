/** Limites des médias envoyés par les équipes. */
export const MEDIA_LIMITS = {
  maxFiles: 6,
  /** Vidéo : 50 Mo (limite par fichier du plan gratuit Supabase). */
  maxVideoBytes: 50 * 1024 * 1024,
  maxVideoSeconds: 60,
  /** Photos : redimensionnées côté navigateur avant l'envoi. */
  photoMaxSize: 1920,
  photoQuality: 0.8,
}

export const SUBMISSIONS_BUCKET = 'submissions'

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`
}

export interface VideoMetadata {
  duration: number | null
  width: number | null
  height: number | null
}

/** Durée et dimensions d'une vidéo, lues dans le navigateur (null si illisible). */
export function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const done = (meta: VideoMetadata) => {
      clearTimeout(timeout)
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      resolve(meta)
    }
    // Certains formats ne livrent jamais leurs métadonnées : on n'attend pas indéfiniment.
    const timeout = setTimeout(() => done({ duration: null, width: null, height: null }), 8000)

    video.onloadedmetadata = () => done({
      duration: Number.isFinite(video.duration) ? video.duration : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
    })
    video.onerror = () => done({ duration: null, width: null, height: null })
    video.src = url
  })
}

export function videoExtension(mime: string, fileName: string): string {
  const known: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
  }
  return known[mime] ?? fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
}
