import { calculateWorkoutFatigue, createFreshMuscleStates, updateRecoveryStates } from '../algorithms/recovery'
import { detectPersonalRecords } from '../algorithms/records'
import { calculateVolume } from '../algorithms/strength'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { mergeActiveWorkout } from './sync/merge'
import type {
  ActiveWorkout, FatigueSource, Muscle, PersonalRecord, PlannedExercise, SetLog, SetPrescription, WorkoutPlan, WorkoutRecord,
} from '../types'

export function validateSetForExercise(exerciseId: string, set: SetPrescription): string | null {
  const exercise = EXERCISE_BY_ID.get(exerciseId)
  if (!exercise) return 'Exercise details are unavailable.'
  if (!Number.isFinite(set.reps) || (set.reps ?? 0) <= 0) return 'Enter at least one repetition before completing this set.'
  if ((exercise.exerciseType === 'weighted' || exercise.exerciseType === 'assisted') && (!Number.isFinite(set.weight) || (set.weight ?? 0) <= 0)) return `Enter a ${exercise.exerciseType === 'assisted' ? 'resistance or assistance' : 'weight'} before completing this set.`
  return null
}

export function prefillPlanFromHistory(plan: WorkoutPlan, history: SetLog[]): WorkoutPlan {
  const newestFirst = [...history].sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  return {
    ...plan,
    exercises: plan.exercises.map((planned) => {
      const latest = newestFirst.find((log) => log.exerciseId === planned.exerciseId)
      if (!latest) return planned
      const previousSets = newestFirst
        .filter((log) => log.exerciseId === planned.exerciseId && log.workoutId === latest.workoutId)
        .sort((a, b) => a.setNumber - b.setNumber)
      return {
        ...planned,
        sets: planned.sets.map((set, index) => {
          const previous = previousSets[index] ?? previousSets.at(-1)
          if (!previous) return set
          return { ...set, weight: set.weight ?? previous.weight, reps: set.reps ?? previous.reps }
        }),
      }
    }),
  }
}

export async function startWorkout(plan: WorkoutPlan): Promise<ActiveWorkout> {
  const now = new Date().toISOString()
  const history = await db.setLogs.toArray()
  const prefilled = prefillPlanFromHistory(plan, history)
  const active: ActiveWorkout = {
    ...prefilled,
    id: 'active',
    planId: plan.id,
    startedAt: now,
    elapsedBeforeStart: 0,
    autosavedAt: now,
    restTimer: { durationSeconds: 0, remainingSeconds: 0, running: false },
  }
  await db.activeWorkout.put(active)
  return active
}

export async function saveActiveWorkout(active: ActiveWorkout, baseline?: ActiveWorkout): Promise<void> {
  await db.transaction('rw', db.activeWorkout, async () => {
    const stored = await db.activeWorkout.get('active')
    const merged = stored && baseline ? mergeActiveWorkout(baseline, active, stored) : active
    await db.activeWorkout.put({ ...merged, autosavedAt: new Date().toISOString() })
  })
}

export async function discardActiveWorkout(): Promise<void> {
  await db.activeWorkout.clear()
}

export function startRestTimer(active: ActiveWorkout, seconds: number): ActiveWorkout {
  return {
    ...active,
    restTimer: {
      durationSeconds: seconds,
      remainingSeconds: seconds,
      endAt: new Date(Date.now() + seconds * 1000).toISOString(),
      running: true,
    },
  }
}

export function calculateRemainingRest(timer: ActiveWorkout['restTimer'], now = Date.now()): number {
  if (!timer.running || !timer.endAt) return timer.remainingSeconds
  return Math.max(0, Math.ceil((new Date(timer.endAt).getTime() - now) / 1000))
}

const sourcesForWorkout = (
  workoutId: string,
  completedAt: string,
  exercises: PlannedExercise[],
  fatigue: Partial<Record<Muscle, number>>,
): Partial<Record<Muscle, FatigueSource[]>> => {
  const result: Partial<Record<Muscle, FatigueSource[]>> = {}
  for (const planned of exercises) {
    const exercise = EXERCISE_BY_ID.get(planned.exerciseId)
    if (!exercise) continue
    const completedSets = planned.sets.filter((set) => set.completed && !set.isWarmup).length
    if (completedSets === 0) continue
    for (const contribution of [...exercise.primaryMuscles, ...exercise.secondaryMuscles]) {
      const source: FatigueSource = {
        workoutId,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        sets: completedSets,
        fatigue: Math.round((fatigue[contribution.muscle] ?? 0) * contribution.contribution * 10) / 10,
        trainedAt: completedAt,
      }
      result[contribution.muscle] = [...(result[contribution.muscle] ?? []), source]
    }
  }
  return result
}

export async function finishWorkout(active: ActiveWorkout): Promise<WorkoutRecord> {
  for (const planned of active.exercises) {
    for (const set of planned.sets.filter((candidate) => candidate.completed)) {
      const validationError = validateSetForExercise(planned.exerciseId, set)
      if (validationError) throw new Error(validationError)
    }
  }
  const completedAt = new Date().toISOString()
  const workoutId = crypto.randomUUID()
  const workoutExercises = active.exercises.filter((planned) => planned.sets.some((set) => set.completed && !set.isWarmup)).map((planned, order) => ({
    id: crypto.randomUUID(), workoutId, exerciseId: planned.exerciseId, order, notes: planned.notes, supersetGroup: planned.supersetGroup,
  }))
  const setLogs: SetLog[] = workoutExercises.flatMap((record) => {
    const planned = active.exercises.find((exercise) => exercise.exerciseId === record.exerciseId && exercise.order === record.order)
      ?? active.exercises.find((exercise) => exercise.exerciseId === record.exerciseId)
    return (planned?.sets ?? []).filter((set) => set.completed && !set.isWarmup).map((set, index) => ({
      id: crypto.randomUUID(),
      workoutId,
      workoutExerciseId: record.id,
      exerciseId: record.exerciseId,
      setNumber: index + 1,
      weight: Math.max(0, set.weight ?? 0),
      reps: Math.max(0, set.reps ?? 0),
      rir: Math.max(0, Math.min(5, set.rir ?? 2)),
      completedAt,
    }))
  })
  if (setLogs.length === 0) throw new Error('Complete at least one working set before finishing the workout.')
  const [profile, priorSets, priorRecords, settings, states] = await Promise.all([
    db.profiles.get('primary'),
    db.setLogs.toArray(),
    db.personalRecords.toArray(),
    db.appSettings.get('primary'),
    db.muscleStates.toArray(),
  ])
  const newRecords = detectPersonalRecords(workoutId, completedAt, setLogs, priorSets, priorRecords)
  const fatigueEntries = workoutExercises.map((record) => ({
    exercise: EXERCISE_BY_ID.get(record.exerciseId)!,
    sets: setLogs.filter((set) => set.workoutExerciseId === record.id).map((set) => ({ weight: set.weight, reps: set.reps, rir: set.rir })),
  })).filter((entry) => !!entry.exercise)
  const fatigue = calculateWorkoutFatigue(fatigueEntries, profile?.experienceLevel)
  const updatedStates = updateRecoveryStates(
    states,
    fatigue,
    sourcesForWorkout(workoutId, completedAt, active.exercises, fatigue),
    new Date(completedAt),
    settings?.recoveryAggressiveness,
  )
  const durationSeconds = Math.max(60, Math.round((new Date(completedAt).getTime() - new Date(active.startedAt).getTime()) / 1000) + active.elapsedBeforeStart)
  const record: WorkoutRecord = {
    id: workoutId,
    title: active.title,
    splitDay: active.splitDay,
    startedAt: active.startedAt,
    completedAt,
    durationSeconds,
    totalVolume: calculateVolume(setLogs),
    totalReps: setLogs.reduce((sum, set) => sum + set.reps, 0),
    workingSets: setLogs.length,
    focusMuscles: active.focusMuscles,
    prCount: newRecords.length,
  }
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.setLogs, db.personalRecords, db.muscleStates, db.activeWorkout, db.draftWorkouts], async () => {
    await db.workouts.put(record)
    await db.workoutExercises.bulkPut(workoutExercises)
    await db.setLogs.bulkPut(setLogs)
    await db.personalRecords.bulkPut(newRecords)
    await db.muscleStates.bulkPut(updatedStates)
    await db.activeWorkout.clear()
    await db.draftWorkouts.clear()
  })
  return record
}

export async function saveWorkoutFeedback(
  workoutId: string,
  feeling: NonNullable<WorkoutRecord['feeling']>,
  sessionRpe?: number,
): Promise<void> {
  await db.workouts.update(workoutId, { feeling, sessionRpe })
}

export async function recalculateDerivedData(): Promise<void> {
  const [workouts, allSets, exerciseRecords, profile, settings] = await Promise.all([
    db.workouts.orderBy('completedAt').toArray(),
    db.setLogs.toArray(),
    db.workoutExercises.toArray(),
    db.profiles.get('primary'),
    db.appSettings.get('primary'),
  ])
  let records: PersonalRecord[] = []
  let priorSets: SetLog[] = []
  let states = createFreshMuscleStates(workouts[0] ? new Date(workouts[0].startedAt) : new Date())
  const updatedWorkouts: WorkoutRecord[] = []
  for (const workout of workouts) {
    const workoutSets = allSets.filter((set) => set.workoutId === workout.id)
    const newRecords = detectPersonalRecords(workout.id, workout.completedAt, workoutSets, priorSets, records)
    records = [...records, ...newRecords]
    priorSets = [...priorSets, ...workoutSets]
    const fatigueEntries = exerciseRecords.filter((entry) => entry.workoutId === workout.id).map((entry) => ({
      exercise: EXERCISE_BY_ID.get(entry.exerciseId)!,
      sets: workoutSets.filter((set) => set.workoutExerciseId === entry.id),
    })).filter((entry) => !!entry.exercise)
    const fatigue = calculateWorkoutFatigue(fatigueEntries, profile?.experienceLevel)
    const plannedForSources: PlannedExercise[] = exerciseRecords.filter((entry) => entry.workoutId === workout.id).map((entry) => ({
      id: entry.id,
      exerciseId: entry.exerciseId,
      order: entry.order,
      notes: entry.notes,
      supersetGroup: entry.supersetGroup,
      sets: workoutSets.filter((set) => set.workoutExerciseId === entry.id).map((set) => ({
        id: set.id, setNumber: set.setNumber, targetRepMin: set.reps, targetRepMax: set.reps,
        restSeconds: 0, completed: true, weight: set.weight, reps: set.reps, rir: set.rir,
      })),
    }))
    states = updateRecoveryStates(states, fatigue, sourcesForWorkout(workout.id, workout.completedAt, plannedForSources, fatigue), new Date(workout.completedAt), settings?.recoveryAggressiveness)
    updatedWorkouts.push({
      ...workout,
      totalVolume: calculateVolume(workoutSets),
      totalReps: workoutSets.reduce((sum, set) => sum + set.reps, 0),
      workingSets: workoutSets.length,
      prCount: newRecords.length,
    })
  }
  states = updateRecoveryStates(states, {}, {}, new Date(), settings?.recoveryAggressiveness)
  await db.transaction('rw', [db.personalRecords, db.muscleStates, db.workouts], async () => {
    await db.personalRecords.clear()
    await db.personalRecords.bulkPut(records)
    await db.muscleStates.clear()
    await db.muscleStates.bulkPut(states)
    await db.workouts.bulkPut(updatedWorkouts)
  })
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.setLogs], async () => {
    await db.workouts.delete(workoutId)
    await db.workoutExercises.where('workoutId').equals(workoutId).delete()
    await db.setLogs.where('workoutId').equals(workoutId).delete()
  })
  await recalculateDerivedData()
}

export async function updateHistoricalSet(set: SetLog): Promise<void> {
  await db.setLogs.put(set)
  await recalculateDerivedData()
}

export async function workoutToDraft(workoutId: string, titleSuffix = ''): Promise<WorkoutPlan> {
  const [workout, exerciseRecords, sets] = await Promise.all([
    db.workouts.get(workoutId),
    db.workoutExercises.where('workoutId').equals(workoutId).sortBy('order'),
    db.setLogs.where('workoutId').equals(workoutId).toArray(),
  ])
  if (!workout) throw new Error('Workout not found.')
  const exercises: PlannedExercise[] = exerciseRecords.map((record) => ({
    id: crypto.randomUUID(),
    exerciseId: record.exerciseId,
    order: record.order,
    notes: record.notes,
    supersetGroup: record.supersetGroup,
    sets: sets.filter((set) => set.workoutExerciseId === record.id).map((set, index) => ({
      id: crypto.randomUUID(), setNumber: index + 1, targetRepMin: set.reps, targetRepMax: set.reps,
      recommendedWeight: set.weight, weight: set.weight, reps: set.reps, rir: 2, restSeconds: 90, completed: false,
    })),
  }))
  const draft: WorkoutPlan = {
    id: crypto.randomUUID(), title: `${workout.title}${titleSuffix}`, splitDay: workout.splitDay,
    focusMuscles: workout.focusMuscles, estimatedDuration: Math.round(workout.durationSeconds / 60), readiness: 100,
    explanation: 'Repeated from your history with the previous loads and repetitions ready to edit.',
    createdAt: new Date().toISOString(), manuallyEdited: true, exercises,
  }
  await db.draftWorkouts.clear()
  await db.draftWorkouts.put(draft)
  return draft
}
