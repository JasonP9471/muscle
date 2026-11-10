import { EXERCISE_SCORE_WEIGHTS } from '../../config/training'
import type { Exercise, ExerciseScoreContext } from '../../types'

const preferenceScore = (preference: ExerciseScoreContext['preference']): number => {
  if (preference === 'favorite') return EXERCISE_SCORE_WEIGHTS.favorite
  if (preference === 'more') return EXERCISE_SCORE_WEIGHTS.recommendMore
  if (preference === 'less') return EXERCISE_SCORE_WEIGHTS.recommendLess
  return 0
}

export function hasAvailableEquipment(exercise: Exercise, available: string[]): boolean {
  return exercise.requiredEquipment.every((item) => available.includes(item))
}

export function calculateExerciseScore(exercise: Exercise, context: ExerciseScoreContext): number {
  if (context.excluded || context.preference === 'exclude' || !hasAvailableEquipment(exercise, context.equipment)) return Number.NEGATIVE_INFINITY
  const primaryTargets = exercise.primaryMuscles.filter(({ muscle }) => context.targetMuscles.includes(muscle))
  const secondaryTargets = exercise.secondaryMuscles.filter(({ muscle }) => context.targetMuscles.includes(muscle))
  if (primaryTargets.length === 0 && secondaryTargets.length === 0 && exercise.movementPattern !== 'cardio') return Number.NEGATIVE_INFINITY

  let score = primaryTargets.length * EXERCISE_SCORE_WEIGHTS.targetMuscle
    + secondaryTargets.length * EXERCISE_SCORE_WEIGHTS.targetMuscle * 0.35
    + preferenceScore(context.preference)
  const recoveryValues = exercise.primaryMuscles.map(({ muscle }) => context.muscleRecovery[muscle] ?? 100)
  const averageRecovery = recoveryValues.reduce((sum, value) => sum + value, 0) / Math.max(1, recoveryValues.length)
  score += (averageRecovery / 100) * EXERCISE_SCORE_WEIGHTS.recovery
  if (context.neededPatterns.includes(exercise.movementPattern)) score += EXERCISE_SCORE_WEIGHTS.movementNeed
  if (exercise.compound && context.goal === 'build_strength') score += EXERCISE_SCORE_WEIGHTS.compoundPriority
  if (exercise.compound && context.goal === 'build_muscle') score += EXERCISE_SCORE_WEIGHTS.goalAlignment * 0.65
  if (!exercise.compound && context.goal === 'muscular_endurance') score += EXERCISE_SCORE_WEIGHTS.goalAlignment
  const recentlyUsed = context.recentExerciseIds.includes(exercise.id)
  if (recentlyUsed) score += context.varietyPreference === 'low'
    ? EXERCISE_SCORE_WEIGHTS.varietyLowFamiliarity
    : EXERCISE_SCORE_WEIGHTS.recentRepeat
  else if (context.varietyPreference === 'high') score += EXERCISE_SCORE_WEIGHTS.varietyHighNovelty
  if (exercise.difficulty === context.experienceLevel) score += EXERCISE_SCORE_WEIGHTS.difficultyMatch
  if (context.experienceLevel === 'beginner' && exercise.difficulty === 'advanced') score -= 35
  if (averageRecovery < 40) score -= 40
  return Math.round(score * 100) / 100
}

