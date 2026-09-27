export type AnswerType = 'photo' | 'video' | 'text' | 'gps'

/** Ordre d'affichage canonique des types de réponse. */
export const ANSWER_TYPES: AnswerType[] = ['photo', 'video', 'text', 'gps']

export function sortAnswerTypes(types: AnswerType[]): AnswerType[] {
  return ANSWER_TYPES.filter(t => types.includes(t))
}

/** Statut d'une mission pour une équipe (calculé, voir règles de fin de partie). */
export type MissionStatus = 'todo' | 'pending' | 'validated' | 'refused'

export const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  photo: 'Photo',
  video: 'Vidéo',
  text: 'Texte',
  gps: 'Position GPS',
}

export const MISSION_STATUS_LABELS: Record<MissionStatus, string> = {
  todo: 'À faire',
  pending: 'En attente',
  validated: 'Validée',
  refused: 'Refusée',
}
