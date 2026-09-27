import * as tus from 'tus-js-client'
import type { Mission } from '~/types/database'

/** Fichier préparé dans le formulaire (photo déjà compressée). */
export interface DraftFile {
  id: string
  kind: 'photo' | 'video'
  blob: Blob
  mime: string
  name: string
  previewUrl: string
  width: number | null
  height: number | null
  duration: number | null
}

export interface DraftPosition {
  lat: number
  lng: number
  accuracy: number
}

export interface SubmitInput {
  mission: Mission
  gameId: string
  teamId: string
  text: string
  position: DraftPosition | null
  comment: string
  files: DraftFile[]
}

export interface SubmitResult {
  id: string
  status: 'pending' | 'validated' | 'refused'
  auto: boolean
  wrong_text: boolean
  too_far: boolean
  bonus_pending: boolean
}

export interface SubmitProgress {
  label: string
  /** 0–100, ou null si indéterminé. */
  percent: number | null
}

const SUBMIT_ERRORS: Record<string, string> = {
  deadline_passed: 'La date limite est dépassée : ta réponse n’a pas été prise en compte.',
  not_started: 'Le jeu n’a pas encore commencé.',
  max_reached: 'Cette mission a déjà atteint son nombre maximum de validations (ou une réponse est déjà en attente).',
  empty_answer: 'Ajoute au moins une réponse avant d’envoyer.',
  type_not_allowed: 'Ce type de réponse n’est pas accepté pour cette mission.',
  invalid_media: 'Un fichier joint est invalide. Retire-le et réessaie.',
  not_a_member: 'Ta session a expiré : recharge la page et choisis à nouveau ton nom.',
  not_authenticated: 'Ta session a expiré : recharge la page.',
  mission_not_found: 'Cette mission n’existe plus.',
}

function submitErrorMessage(error: unknown): string {
  const message = (error as { message?: string })?.message ?? ''
  const key = Object.keys(SUBMIT_ERRORS).find(k => message.includes(k))
  if (key) return SUBMIT_ERRORS[key]!
  if (/row-level security|unauthorized|403/i.test(message)) {
    return 'Envoi refusé par le serveur : la partie est peut-être terminée.'
  }
  if (/payload too large|413|exceeded the maximum/i.test(message)) return 'Fichier trop volumineux.'
  if (/failed to fetch|network/i.test(message)) return 'Connexion perdue pendant l’envoi. Vérifie ton réseau et réessaie.'
  return friendlyError(error, 'L’envoi a échoué. Réessaie.')
}

export function useSubmitAnswer() {
  const supabase = usePlayerSupabase()
  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public

  const progress = ref<SubmitProgress | null>(null)

  async function uploadPhoto(path: string, file: DraftFile) {
    const { error } = await supabase.storage.from(SUBMISSIONS_BUCKET).upload(path, file.blob, {
      contentType: file.mime,
      upsert: false,
    })
    if (error) throw error
  }

  /** Envoi reprenable (TUS) : par morceaux, avec progression, reprise si le réseau coupe. */
  async function uploadVideo(path: string, file: DraftFile, onProgress: (percent: number) => void) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('not_authenticated')

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file.blob, {
        endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${token}`, apikey: supabaseKey, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: SUBMISSIONS_BUCKET,
          objectName: path,
          contentType: file.mime,
          cacheControl: '3600',
        },
        // Taille de morceau imposée par Supabase
        chunkSize: 6 * 1024 * 1024,
        onProgress: (sent, total) => onProgress(total ? Math.round((sent / total) * 100) : 0),
        onSuccess: () => resolve(),
        onError: (err) => {
          const status = (err as tus.DetailedError).originalResponse?.getStatus()
          reject(new Error(status === 413 ? 'Payload too large' : status === 403 ? '403' : err.message))
        },
      })
      upload.findPreviousUploads().then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
    })
  }

  async function submit(input: SubmitInput): Promise<SubmitResult> {
    try {
      const folder = `games/${input.gameId}/teams/${input.teamId}/${input.mission.id}`
      const media: Record<string, unknown>[] = []

      for (const [index, file] of input.files.entries()) {
        const step = input.files.length > 1 ? ` ${index + 1}/${input.files.length}` : ''
        const ext = file.kind === 'photo' ? extensionFor(file.mime) : videoExtension(file.mime, file.name)
        const path = `${folder}/${randomId()}.${ext}`

        if (file.kind === 'video') {
          progress.value = { label: `Envoi de la vidéo${step}…`, percent: 0 }
          await uploadVideo(path, file, (percent) => {
            progress.value = { label: `Envoi de la vidéo${step}…`, percent }
          })
        }
        else {
          progress.value = { label: `Envoi de la photo${step}…`, percent: null }
          await uploadPhoto(path, file)
        }

        media.push({
          path,
          kind: file.kind,
          mime: file.mime,
          size_bytes: file.blob.size,
          width: file.width,
          height: file.height,
          duration_s: file.duration,
        })
      }

      progress.value = { label: 'Validation de la réponse…', percent: null }
      const { data, error } = await supabase.rpc('submit_answer', {
        p_mission_id: input.mission.id,
        p_text: input.text.trim() || null,
        p_lat: input.position?.lat ?? null,
        p_lng: input.position?.lng ?? null,
        p_accuracy: input.position?.accuracy ?? null,
        p_comment: input.comment.trim() || null,
        p_media: media,
      })
      if (error) throw error
      return data as SubmitResult
    }
    catch (e) {
      throw new Error(submitErrorMessage(e))
    }
    finally {
      progress.value = null
    }
  }

  return { submit, progress }
}
