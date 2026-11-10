import { LIMITATION_RULES, SUBSTITUTION_SCORE_WEIGHTS } from '../../config/substitutions'
import { EXERCISES } from '../../data/exercises'
import type { Difficulty, Exercise, ExercisePreferenceLevel, Muscle, WorkoutGenerationInput } from '../../types'
import { hasAvailableEquipment } from '../workoutGenerator/scoring'

const DIFFICULTY_ORDER: Difficulty[] = ['beginner', 'intermediate', 'advanced']

export interface ExerciseAlternative {
  exercise: Exercise
  score: number
  reasons: string[]
  matchQuality: 'Best match' | 'Strong match' | 'Related option'
}

export interface ExerciseSubstitutionSet {
  source: Exercise
  alternatives: ExerciseAlternative[]
  limitationLabels: string[]
}

const hasAlias = (text: string, alias: string): boolean => {
  const index = text.indexOf(alias)
  if (index < 0) return false
  const prefixClause = text.slice(0, index).split(/\bbut\b|[.!;,]/).at(-1) ?? ''
  return !/\b(?:no|without|none)\b/.test(prefixClause)
}

export function getRecognizedLimitationLabels(limitations = ''): string[] {
  const normalized = limitations.toLowerCase().trim()
  if (!normalized) return []
  return LIMITATION_RULES
    .filter((rule) => rule.aliases.some((alias) => hasAlias(normalized, alias)))
    .map((rule) => rule.label)
}

export function isExerciseBlockedByLimitations(exercise: Exercise, limitations = ''): boolean {
  const normalized = limitations.toLowerCase().trim()
  if (!normalized) return false
  const exerciseName = exercise.name.toLowerCase()
  return LIMITATION_RULES.some((rule) => rule.aliases.some((alias) => hasAlias(normalized, alias))
    && (rule.blockedPatterns.includes(exercise.movementPattern)
      || rule.blockedNameTerms.some((term) => exerciseName.includes(term))))
}

const muscleNames = (exercise: Exercise): Set<Muscle> => new Set([
  ...exercise.primaryMuscles.map(({ muscle }) => muscle),
  ...exercise.secondaryMuscles.map(({ muscle }) => muscle),
])

const sharedMuscles = (left: Exercise, right: Exercise): Muscle[] => {
  const rightTargets = muscleNames(right)
  return [...muscleNames(left)].filter((muscle) => rightTargets.has(muscle))
}

const listText = (values: string[]): string => values.length > 1
  ? `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`
  : values[0] ?? ''

const titleCase = (value: string): string => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

function scoreAlternative(
  current: Exercise,
  exercise: Exercise,
  input: WorkoutGenerationInput,
  preferenceMap: Record<string, ExercisePreferenceLevel>,
  limitationLabels: string[],
): ExerciseAlternative {
  const currentPrimary = new Set(current.primaryMuscles.map(({ muscle }) => muscle))
  const candidatePrimary = new Set(exercise.primaryMuscles.map(({ muscle }) => muscle))
  const candidateSecondary = new Set(exercise.secondaryMuscles.map(({ muscle }) => muscle))
  const primaryOverlap = [...currentPrimary].filter((muscle) => candidatePrimary.has(muscle))
  const secondaryOverlap = [...currentPrimary].filter((muscle) => candidateSecondary.has(muscle))
  const allShared = sharedMuscles(current, exercise)
  const samePattern = exercise.movementPattern === current.movementPattern
  const difficultyDelta = DIFFICULTY_ORDER.indexOf(exercise.difficulty) - DIFFICULTY_ORDER.indexOf(current.difficulty)
  const preference = preferenceMap[exercise.id] ?? 'neutral'
  let score = (samePattern ? SUBSTITUTION_SCORE_WEIGHTS.sameMovementPattern : 0)
    + primaryOverlap.length * SUBSTITUTION_SCORE_WEIGHTS.primaryMuscleOverlap
    + secondaryOverlap.length * SUBSTITUTION_SCORE_WEIGHTS.secondaryMuscleOverlap
    + (difficultyDelta === 0 ? SUBSTITUTION_SCORE_WEIGHTS.sameDifficulty : Math.abs(difficultyDelta) === 1 ? SUBSTITUTION_SCORE_WEIGHTS.adjacentDifficulty : 0)
    + (exercise.compound === current.compound ? SUBSTITUTION_SCORE_WEIGHTS.sameCompoundType : 0)
    + (exercise.unilateral === current.unilateral ? SUBSTITUTION_SCORE_WEIGHTS.sameLaterality : 0)
  if (preference === 'favorite') score += SUBSTITUTION_SCORE_WEIGHTS.favorite
  if (preference === 'more') score += SUBSTITUTION_SCORE_WEIGHTS.recommendMore
  if (preference === 'less') score += SUBSTITUTION_SCORE_WEIGHTS.recommendLess

  const reasons: string[] = []
  if (samePattern) reasons.push(`Same ${titleCase(current.movementPattern).toLowerCase()} pattern`)
  else reasons.push(`Keeps ${titleCase(current.primaryMuscles[0]?.muscle ?? 'target muscle').toLowerCase()} work with a different setup`)
  const targetOverlap = primaryOverlap.length > 0 ? primaryOverlap : allShared
  if (targetOverlap.length > 0) reasons.push(`Targets ${listText(targetOverlap.slice(0, 3).map(titleCase))}`)
  reasons.push(exercise.requiredEquipment.length > 0
    ? `Uses your available ${listText(exercise.requiredEquipment)}`
    : 'Needs no equipment')
  if (difficultyDelta === 0) reasons.push(`Same ${exercise.difficulty} difficulty`)
  else if (difficultyDelta < 0) reasons.push('One step easier to execute')
  else reasons.push('One step more advanced')
  if (limitationLabels.length > 0) reasons.push(`Not flagged by your saved ${listText(limitationLabels)} filter${limitationLabels.length > 1 ? 's' : ''}`)

  const matchQuality: ExerciseAlternative['matchQuality'] = samePattern && primaryOverlap.length > 0 && Math.abs(difficultyDelta) <= 1
    ? 'Best match'
    : samePattern || primaryOverlap.length > 0 ? 'Strong match' : 'Related option'
  return { exercise, score, reasons, matchQuality }
}

export function buildExerciseSubstitutions(
  current: Exercise,
  input: WorkoutGenerationInput,
  preferenceMap: Record<string, ExercisePreferenceLevel> = input.exercisePreferences,
): ExerciseSubstitutionSet {
  const limitationLabels = getRecognizedLimitationLabels(input.limitations)
  const alternatives = EXERCISES
    .filter((exercise) => exercise.id !== current.id
      && hasAvailableEquipment(exercise, input.equipment)
      && !input.excludedExercises.includes(exercise.id)
      && preferenceMap[exercise.id] !== 'exclude'
      && !isExerciseBlockedByLimitations(exercise, input.limitations)
      && !(input.experienceLevel === 'beginner' && exercise.difficulty === 'advanced')
      && exercise.primaryMuscles.some(({ muscle }) => current.primaryMuscles.some((target) => target.muscle === muscle)
        || current.primaryMuscles.some(({ muscle }) => exercise.secondaryMuscles.some((target) => target.muscle === muscle))))
    .map((exercise) => scoreAlternative(current, exercise, input, preferenceMap, limitationLabels))
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
  return { source: current, alternatives, limitationLabels }
}

export function rankExerciseAlternatives(
  current: Exercise,
  input: WorkoutGenerationInput,
  preferenceMap: Record<string, ExercisePreferenceLevel> = input.exercisePreferences,
): ExerciseAlternative[] {
  return buildExerciseSubstitutions(current, input, preferenceMap).alternatives
}
