import type { MissionStatus } from '~/types/game'
import type { Mission, ScoreAdjustment, Submission } from '~/types/database'

export interface MissionProgress {
  status: MissionStatus
  validatedCount: number
  pendingCount: number
  /** Pendant la partie : la dernière réponse a été refusée (la mission reste à faire). */
  lastRefused: boolean
  /** Nombre maximum de validations atteint : plus aucune réponse possible. */
  completed: boolean
}

/**
 * Statut d'une mission pour une équipe.
 * - Pendant la partie, un refus ne ferme jamais la mission : elle reste « à faire ».
 * - Une fois la partie terminée, une mission sans réponse validée ni en attente est « refusée ».
 */
export function missionProgress(mission: Mission, submissions: Submission[], gameOver: boolean): MissionProgress {
  const own = submissions.filter(s => s.mission_id === mission.id)
  const validatedCount = own.filter(s => s.status === 'validated').length
  const pendingCount = own.filter(s => s.status === 'pending').length
  const latest = own.reduce<Submission | null>((acc, s) => (!acc || s.created_at > acc.created_at ? s : acc), null)

  let status: MissionStatus
  if (validatedCount > 0) status = 'validated'
  else if (pendingCount > 0) status = 'pending'
  else status = gameOver ? 'refused' : 'todo'

  return {
    status,
    validatedCount,
    pendingCount,
    lastRefused: !gameOver && status === 'todo' && latest?.status === 'refused',
    completed: validatedCount >= mission.max_validations,
  }
}

/** Points d'une soumission : base + bonus obtenus, uniquement si validée. */
export function submissionPoints(submission: Submission, mission: Mission | undefined) {
  if (submission.status !== 'validated' || !mission) return { base: 0, bonus: 0 }
  return {
    base: mission.base_points,
    bonus: submission.bonus_count * (mission.bonus_points ?? 0),
  }
}

export interface TeamScore {
  base: number
  bonus: number
  adjustments: number
  total: number
  validatedMissions: number
}

/** Score d'une équipe = soumissions validées (base + bonus) + ajustements manuels. */
export function teamScore(missions: Mission[], submissions: Submission[], adjustments: ScoreAdjustment[]): TeamScore {
  const byId = new Map(missions.map(m => [m.id, m]))
  let base = 0
  let bonus = 0
  const validated = new Set<string>()
  for (const s of submissions) {
    const pts = submissionPoints(s, byId.get(s.mission_id))
    base += pts.base
    bonus += pts.bonus
    if (s.status === 'validated') validated.add(s.mission_id)
  }
  const adj = adjustments.reduce((sum, a) => sum + a.points, 0)
  return { base, bonus, adjustments: adj, total: base + bonus + adj, validatedMissions: validated.size }
}
