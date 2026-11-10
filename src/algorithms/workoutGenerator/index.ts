import { DURATION_GUIDANCE, REP_RANGES, REST_RANGES, SPLIT_PATTERNS } from '../../config/training'
import { calculateWorkoutDuration } from '../duration'
import { rankExerciseAlternatives } from '../exerciseSubstitutions'
import { calculateNextPrescription } from '../progression'
import { EXERCISES } from '../../data/exercises'
import type {
  Exercise, ExerciseScoreContext, Goal, Muscle, PlannedExercise,
  SetPrescription, Units, WorkoutGenerationInput, WorkoutPlan,
} from '../../types'
import { calculateExerciseScore } from './scoring'

const SPLIT_SEQUENCE: Record<WorkoutGenerationInput['split'], string[]> = {
  'Full Body': ['Full Body'],
  'Upper / Lower': ['Upper', 'Lower'],
  'Push / Pull / Legs': ['Push', 'Pull', 'Legs'],
  'Push / Pull / Legs x2': ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
  Custom: ['Full Body'],
}

const SPLIT_MUSCLES: Record<string, Muscle[]> = {
  Push: ['chest', 'upper chest', 'front delts', 'side delts', 'triceps'],
  Pull: ['lats', 'upper back', 'traps', 'rear delts', 'biceps', 'forearms'],
  Legs: ['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves'],
  Upper: ['chest', 'upper chest', 'lats', 'upper back', 'front delts', 'side delts', 'rear delts', 'biceps', 'triceps'],
  Lower: ['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'spinal erectors'],
  'Full Body': ['chest', 'lats', 'upper back', 'front delts', 'quadriceps', 'hamstrings', 'glutes', 'abs'],
}

const UPPER_BODY_MUSCLES = new Set<Muscle>(['chest', 'upper chest', 'lats', 'upper back', 'traps', 'front delts', 'side delts', 'rear delts', 'biceps', 'triceps', 'forearms'])
const LOWER_BODY_MUSCLES = new Set<Muscle>(['glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves'])
const CORE_MUSCLES = new Set<Muscle>(['abs', 'obliques', 'spinal erectors'])

const titleCaseMuscle = (muscle: Muscle) => muscle.replace(/\b\w/g, (character) => character.toUpperCase())

export function deriveWorkoutFocusMuscles(exercises: Exercise[], splitDay: string): Muscle[] {
  const scores = new Map<Muscle, number>()
  for (const exercise of exercises) {
    for (const target of exercise.primaryMuscles) scores.set(target.muscle, (scores.get(target.muscle) ?? 0) + target.contribution)
    for (const target of exercise.secondaryMuscles) scores.set(target.muscle, (scores.get(target.muscle) ?? 0) + target.contribution * 0.5)
  }
  const ranked = [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([muscle]) => muscle)
  if (splitDay !== 'Full Body') return ranked.slice(0, 3)

  const regions = [UPPER_BODY_MUSCLES, LOWER_BODY_MUSCLES, CORE_MUSCLES]
  const representativeMuscles = regions.flatMap((region) => ranked.find((muscle) => region.has(muscle)) ?? [])
  return [...representativeMuscles, ...ranked.filter((muscle) => !representativeMuscles.includes(muscle))].slice(0, 3)
}

export function deriveWorkoutTitle(splitDay: string, focusMuscles: Muscle[]): string {
  const focus = focusMuscles.map(titleCaseMuscle).join(' / ')
  return focus ? `${splitDay} · ${focus}` : splitDay
}

export function determineNextSplit(input: Pick<WorkoutGenerationInput, 'split' | 'previousWorkouts' | 'manualSplitDay'>): string {
  if (input.manualSplitDay && SPLIT_MUSCLES[input.manualSplitDay]) return input.manualSplitDay
  const sequence = SPLIT_SEQUENCE[input.split]
  if (input.previousWorkouts.length === 0) return sequence[0]
  const latest = [...input.previousWorkouts].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
  const currentIndex = sequence.indexOf(latest.splitDay)
  return sequence[(currentIndex + 1 + sequence.length) % sequence.length]
}

const targetRangeFor = (exercise: Exercise, goal: Goal, order: number): [number, number] => {
  if (order === 0 && exercise.compound) return REP_RANGES[goal].main
  return exercise.compound ? REP_RANGES[goal].compound : REP_RANGES[goal].isolation
}

const setsFor = (exercise: Exercise, input: WorkoutGenerationInput): number => {
  const experienceBase = input.experienceLevel === 'beginner' ? 2 : input.experienceLevel === 'advanced' ? 4 : 3
  const durationAdjustment = input.workoutDuration <= 30 ? -1 : 0
  const strengthMainBonus = input.goal === 'build_strength' && exercise.compound ? 1 : 0
  return Math.max(2, Math.min(5, experienceBase + durationAdjustment + strengthMainBonus))
}

const latestPerformance = (exerciseId: string, input: WorkoutGenerationInput) => [...input.exerciseHistory]
  .filter((performance) => performance.exerciseId === exerciseId)
  .sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0]

const createSets = (
  exercise: Exercise,
  order: number,
  input: WorkoutGenerationInput,
  units: Units = 'lb',
): SetPrescription[] => {
  const targetRange = targetRangeFor(exercise, input.goal, order)
  const history = latestPerformance(exercise.id, input)
  const recommendation = calculateNextPrescription({
    exercise,
    previousSets: history?.sets ?? [],
    targetRepRange: targetRange,
    units,
  })
  const restSeconds = exercise.compound ? REST_RANGES[input.goal].compound : REST_RANGES[input.goal].isolation
  return Array.from({ length: setsFor(exercise, input) }, (_, index) => ({
    id: crypto.randomUUID(),
    setNumber: index + 1,
    targetRepMin: targetRange[0],
    targetRepMax: targetRange[1],
    recommendedWeight: recommendation.weight,
    restSeconds,
    completed: false,
    weight: recommendation.weight,
    reps: recommendation.targetReps,
    rir: 2,
  }))
}

function rankCandidates(input: WorkoutGenerationInput, splitDay: string): Array<{ exercise: Exercise; score: number }> {
  const targetMuscles = SPLIT_MUSCLES[splitDay] ?? SPLIT_MUSCLES['Full Body']
  const recentExerciseIds = input.previousWorkouts.slice(0, 3).flatMap((workout) => workout.exerciseIds)
  const neededPatterns = SPLIT_PATTERNS[splitDay] ?? SPLIT_PATTERNS['Full Body']
  return EXERCISES.map((exercise) => {
    const preference = input.exercisePreferences[exercise.id] ?? 'neutral'
    const context: ExerciseScoreContext = {
      goal: input.goal,
      experienceLevel: input.experienceLevel,
      equipment: input.equipment,
      targetMuscles,
      muscleRecovery: input.muscleRecovery,
      preference,
      excluded: input.excludedExercises.includes(exercise.id),
      recentExerciseIds,
      neededPatterns,
      varietyPreference: input.varietyPreference,
    }
    return { exercise, score: calculateExerciseScore(exercise, context) }
  }).filter(({ score }) => Number.isFinite(score)).sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
}

function chooseBalanced(candidates: Array<{ exercise: Exercise; score: number }>, targetCount: number, splitDay: string): Exercise[] {
  const chosen: Exercise[] = []
  const patterns = SPLIT_PATTERNS[splitDay] ?? SPLIT_PATTERNS['Full Body']
  for (const needed of patterns) {
    const match = candidates.find(({ exercise }) => exercise.movementPattern === needed && !chosen.includes(exercise))
    if (match && chosen.length < targetCount) chosen.push(match.exercise)
  }
  for (const { exercise } of candidates) {
    if (chosen.length >= targetCount) break
    if (chosen.includes(exercise)) continue
    const samePattern = chosen.filter((item) => item.movementPattern === exercise.movementPattern).length
    const samePrimary = chosen.filter((item) => item.primaryMuscles[0]?.muscle === exercise.primaryMuscles[0]?.muscle).length
    if (samePattern >= 2 || samePrimary >= 2) continue
    chosen.push(exercise)
  }
  if (chosen.length < targetCount) {
    for (const { exercise } of candidates) {
      if (chosen.length >= targetCount) break
      if (!chosen.includes(exercise)) chosen.push(exercise)
    }
  }
  return chosen
}

function addSupersets(exercises: PlannedExercise[], catalog: Exercise[]): PlannedExercise[] {
  const result = exercises.map((exercise) => ({ ...exercise }))
  for (let index = 0; index < result.length - 1; index += 1) {
    const first = catalog.find((exercise) => exercise.id === result[index].exerciseId)
    const second = catalog.find((exercise) => exercise.id === result[index + 1].exerciseId)
    if (first && second && !first.compound && !second.compound
      && first.primaryMuscles[0]?.muscle !== second.primaryMuscles[0]?.muscle) {
      const group = `superset-${index}`
      result[index].supersetGroup = group
      result[index + 1].supersetGroup = group
      index += 1
    }
  }
  return result
}

export function generateWorkout(input: WorkoutGenerationInput, units: Units = 'lb'): WorkoutPlan {
  const splitDay = determineNextSplit(input)
  const targetMuscles = SPLIT_MUSCLES[splitDay] ?? SPLIT_MUSCLES['Full Body']
  const ranked = rankCandidates(input, splitDay)
  const targetCount = DURATION_GUIDANCE[input.workoutDuration].target
  const selected = chooseBalanced(ranked, targetCount, splitDay)
  let planned = selected.map((exercise, order): PlannedExercise => ({
    id: crypto.randomUUID(),
    exerciseId: exercise.id,
    order,
    sets: createSets(exercise, order, input, units),
    notes: '',
  }))
  if (input.supersetsAllowed) planned = addSupersets(planned, selected)
  const focusMuscles = deriveWorkoutFocusMuscles(selected, splitDay)
  const leastReady = targetMuscles.reduce((lowest, muscle) => Math.min(lowest, input.muscleRecovery[muscle] ?? 100), 100)
  const readiness = Math.round(targetMuscles.reduce((sum, muscle) => sum + (input.muscleRecovery[muscle] ?? 100), 0) / targetMuscles.length)
  const readyText = focusMuscles.map((muscle) => muscle.replace(/\b\w/g, (char) => char.toUpperCase())).join(', ')
  const caution = leastReady < 55 ? ' Lower-readiness muscles receive reduced priority.' : ''
  const estimate = calculateWorkoutDuration(planned, {
    warmup: input.warmupEnabled,
    cardioMinutes: input.cardioFinishersAllowed && input.goal === 'general_fitness' ? 8 : 0,
  })
  return {
    id: crypto.randomUUID(),
    title: deriveWorkoutTitle(splitDay, focusMuscles),
    splitDay,
    focusMuscles,
    estimatedDuration: Math.min(input.workoutDuration + 8, Math.max(Math.round(input.workoutDuration * 0.7), estimate)),
    readiness,
    explanation: `${readyText} rank highest within today's ${splitDay.toLowerCase()} sequence. The plan balances major movement patterns, your available equipment, recent exercise use, and your ${input.workoutDuration}-minute target.${caution}`,
    createdAt: new Date().toISOString(),
    manuallyEdited: false,
    exercises: planned,
  }
}

export interface WorkoutVariation {
  plan: WorkoutPlan
  changedExercises: Array<{ from: Exercise; to: Exercise }>
}

export function generateWorkoutVariation(
  currentPlan: WorkoutPlan,
  input: WorkoutGenerationInput,
  units: Units = 'lb',
): WorkoutVariation {
  const basePlan = generateWorkout({ ...input, manualSplitDay: currentPlan.splitDay }, units)
  const baseExerciseIds = new Set(basePlan.exercises.map(({ exerciseId }) => exerciseId))
  const currentExerciseIds = new Set(currentPlan.exercises.map(({ exerciseId }) => exerciseId))
  const selectedExerciseIds = new Set(baseExerciseIds)
  const changedExercises: WorkoutVariation['changedExercises'] = []
  const targetChanges = basePlan.exercises.length >= 4 ? 2 : 1
  const replaceableIndices = basePlan.exercises
    .map(({ exerciseId }, index) => ({ exercise: EXERCISES.find(({ id }) => id === exerciseId), index }))
    .filter((item): item is { exercise: Exercise; index: number } => Boolean(item.exercise) && item.index > 0)
    .sort((a, b) => Number(a.exercise.compound) - Number(b.exercise.compound) || b.index - a.index)
  let planned = basePlan.exercises.map((exercise) => ({ ...exercise, sets: exercise.sets.map((set) => ({ ...set })) }))

  for (const { exercise: current, index } of replaceableIndices) {
    if (changedExercises.length >= targetChanges) break
    const alternatives = rankExerciseAlternatives(current, input)
    const alternative = alternatives.find(({ exercise }) => exercise.movementPattern === current.movementPattern
      && !selectedExerciseIds.has(exercise.id) && !currentExerciseIds.has(exercise.id))
      ?? alternatives.find(({ exercise }) => !selectedExerciseIds.has(exercise.id) && !currentExerciseIds.has(exercise.id))
    if (!alternative) continue
    selectedExerciseIds.delete(current.id)
    selectedExerciseIds.add(alternative.exercise.id)
    planned[index] = {
      id: crypto.randomUUID(),
      exerciseId: alternative.exercise.id,
      order: index,
      sets: createSets(alternative.exercise, index, input, units),
      notes: '',
    }
    changedExercises.push({ from: current, to: alternative.exercise })
  }

  if (changedExercises.length === 0) return { plan: currentPlan, changedExercises }
  planned = planned.map(({ supersetGroup: _supersetGroup, ...exercise }) => exercise)
  if (input.supersetsAllowed) {
    const selected = planned.flatMap(({ exerciseId }) => {
      const exercise = EXERCISES.find(({ id }) => id === exerciseId)
      return exercise ? [exercise] : []
    })
    planned = addSupersets(planned, selected)
  }
  const countText = changedExercises.length === 1 ? 'one exercise' : `${changedExercises.length} exercises`
  return {
    plan: {
      ...basePlan,
      explanation: `${basePlan.explanation} This variation changes ${countText} while preserving today's focus and movement structure.`,
      exercises: planned,
    },
    changedExercises,
  }
}

export { rankExerciseAlternatives } from '../exerciseSubstitutions'
