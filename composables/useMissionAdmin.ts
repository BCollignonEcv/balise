import type { AnswerType } from '~/types/game'
import type { Mission, MissionSecret, ValidationMode } from '~/types/database'

/** Valeurs du formulaire de mission (mission + réponse attendue). */
export interface MissionFormValues {
  title: string
  description: string
  base_points: number
  answer_types: AnswerType[]
  validation_mode: ValidationMode
  max_validations: number
  bonus_label: string | null
  bonus_points: number | null
  bonus_max: number | null
  expected_answer: string | null
  target_lat: number | null
  target_lng: number | null
  radius_m: number | null
}

export interface MissionImageChange {
  /** Nouvelle image choisie, à envoyer. */
  file: File | null
  /** L'image existante doit être retirée. */
  remove: boolean
}

/** Une réponse attendue n'est utile qu'en validation automatique texte ou GPS. */
export function needsSecret(values: Pick<MissionFormValues, 'answer_types' | 'validation_mode'>) {
  return values.validation_mode === 'auto'
    && (values.answer_types.includes('text') || values.answer_types.includes('gps'))
}

export function useMissionAdmin(gameId: string) {
  const supabase = useAdminSupabase()

  async function uploadImage(file: File): Promise<string> {
    const { blob } = await compressImage(file, { maxSize: 1200, quality: 0.82 })
    const mime = blob.type || file.type
    const path = `games/${gameId}/missions/${randomId()}.${extensionFor(mime)}`
    const { error } = await supabase.storage.from(ASSETS_BUCKET).upload(path, blob, {
      contentType: mime,
      cacheControl: '31536000',
    })
    if (error) throw error
    return path
  }

  async function nextPosition(): Promise<number> {
    const { data, error } = await supabase
      .from('missions')
      .select('position')
      .eq('game_id', gameId)
      .order('position', { ascending: false })
      .limit(1)
    if (error) throw error
    return (data?.[0]?.position ?? 0) + 1
  }

  /**
   * Crée ou met à jour une mission et sa réponse attendue. Les fichiers
   * d'image remplacés ne sont pas supprimés : une partie dupliquée peut les partager.
   */
  async function save(missionId: string | null, values: MissionFormValues, image: MissionImageChange): Promise<string> {
    const { expected_answer, target_lat, target_lng, radius_m, ...missionFields } = values
    const row: Partial<Mission> = { ...missionFields }
    if (image.file) row.image_path = await uploadImage(image.file)
    else if (image.remove) row.image_path = null

    let id = missionId
    if (id) {
      const { error } = await supabase.from('missions').update(row).eq('id', id)
      if (error) throw error
    }
    else {
      const { data, error } = await supabase
        .from('missions')
        .insert({ ...row, game_id: gameId, position: await nextPosition() })
        .select('id')
        .single()
      if (error) throw error
      id = data.id as string
    }

    if (needsSecret(values)) {
      const hasText = values.answer_types.includes('text')
      const hasGps = values.answer_types.includes('gps')
      const secret: MissionSecret = {
        mission_id: id,
        expected_answer: hasText ? expected_answer : null,
        target_lat: hasGps ? target_lat : null,
        target_lng: hasGps ? target_lng : null,
        radius_m: hasGps ? radius_m : null,
      }
      const { error } = await supabase.from('mission_secrets').upsert(secret)
      if (error) throw error
    }
    else {
      const { error } = await supabase.from('mission_secrets').delete().eq('mission_id', id)
      if (error) throw error
    }

    return id
  }

  async function remove(missionId: string) {
    const { error } = await supabase.from('missions').delete().eq('id', missionId)
    if (error) throw error
  }

  return { save, remove }
}
