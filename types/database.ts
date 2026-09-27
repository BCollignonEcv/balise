import type { GameTheme } from '~/utils/theme'
import type { AnswerType } from '~/types/game'

export type ValidationMode = 'manual' | 'auto'

export interface Mission {
  id: string
  game_id: string
  position: number
  title: string
  description: string
  image_path: string | null
  base_points: number
  /** Types acceptés : l'équipe envoie au moins l'un d'eux. */
  answer_types: AnswerType[]
  validation_mode: ValidationMode
  max_validations: number
  bonus_label: string | null
  bonus_points: number | null
  bonus_max: number | null
  created_at: string
  updated_at: string
}

/** Réponse attendue (admin uniquement). */
export interface MissionSecret {
  mission_id: string
  expected_answer: string | null
  target_lat: number | null
  target_lng: number | null
  radius_m: number | null
}

export type GameStatus = 'draft' | 'live' | 'finished'

export interface Game {
  id: string
  code: string
  name: string
  starts_at: string | null
  deadline_at: string
  status: GameStatus
  archived_at: string | null
  theme: GameTheme
  custom_css: string
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  game_id: string
  name: string
  color: string
  position: number
  created_at: string
}

export interface Participant {
  id: string
  game_id: string
  team_id: string | null
  name: string
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
}

export type SubmissionStatus = 'pending' | 'validated' | 'refused'
export type BonusState = 'none' | 'pending' | 'reviewed'

export interface Submission {
  id: string
  game_id: string
  mission_id: string
  team_id: string
  participant_id: string | null
  status: SubmissionStatus
  auto_validated: boolean
  text_answer: string | null
  lat: number | null
  lng: number | null
  accuracy_m: number | null
  distance_m: number | null
  team_comment: string | null
  admin_comment: string | null
  bonus_count: number
  bonus_state: BonusState
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SubmissionMedia {
  id: string
  submission_id: string
  path: string
  kind: 'photo' | 'video'
  mime: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
  duration_s: number | null
  created_at: string
}

/** Soumission enrichie pour l'affichage (auteur, médias). */
export interface TeamSubmission extends Submission {
  participant: { name: string } | null
  media: SubmissionMedia[]
}

export interface ScoreAdjustment {
  id: string
  game_id: string
  team_id: string
  points: number
  reason: string
  created_at: string
}

/** Partie telle que visible par un participant (RPC get_join_info). */
export type PublicGame = Pick<Game, 'id' | 'code' | 'name' | 'status' | 'starts_at' | 'deadline_at' | 'theme' | 'custom_css'>

export interface JoinParticipant {
  id: string
  name: string
  team_name: string
  team_color: string
  taken: boolean
}

export interface PlayerIdentity {
  id: string
  name: string
  team_id: string
  team_name: string
  team_color: string
}

export type JoinInfo =
  | { error: 'not_found' }
  | { error: 'not_open'; name: string }
  | { error?: undefined; game: PublicGame; participants: JoinParticipant[]; me: PlayerIdentity | null; server_now: string }

/** Champs éditables d'une partie (formulaire de réglages). */
export interface GameFormValues {
  name: string
  code: string | null
  starts_at: string | null
  deadline_at: string
  status: GameStatus
}

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  draft: 'Brouillon',
  live: 'En cours',
  finished: 'Terminée',
}
