import { getMuscleRecovery } from '../algorithms/recovery'
import { generateWorkout, generateWorkoutVariation } from '../algorithms/workoutGenerator'
import { db } from '../db/database'
import type { ExercisePerformance, WorkoutGenerationInput, WorkoutPlan } from '../types'

export async function buildGenerationInput(manualSplitDay?: string): Promise<WorkoutGenerationInput> {
  const settings = await db.appSettings.get('primary')
  const [profile, gym, muscleStates, preferences, workouts, setLogs] = await Promise.all([
    db.profiles.get('primary'),
    db.gymProfiles.get(settings?.activeGymProfileId ?? 'primary'),
    db.muscleStates.toArray(),
    db.exercisePreferences.toArray(),
    db.workouts.orderBy('completedAt').reverse().limit(12).toArray(),
    db.setLogs.orderBy('completedAt').reverse().limit(400).toArray(),
  ])
  if (!profile || !gym || !settings) throw new Error('Complete onboarding before generating a workout.')
  const exerciseRecords = await db.workoutExercises.where('workoutId').anyOf(workouts.map((workout) => workout.id)).toArray()
  const performanceMap = new Map<string, ExercisePerformance>()
  for (const set of setLogs) {
    const key = `${set.exerciseId}:${set.workoutId}`
    const existing = performanceMap.get(key)
    if (existing) existing.sets.push({ weight: set.weight, reps: set.reps, rir: set.rir })
    else performanceMap.set(key, { exerciseId: set.exerciseId, performedAt: set.completedAt, sets: [{ weight: set.weight, reps: set.reps, rir: set.rir }] })
  }
  const preferenceMap = Object.fromEntries(preferences.map((preference) => [preference.exerciseId, preference.level]))
  return {
    goal: profile.goal,
    experienceLevel: profile.experienceLevel,
    split: profile.split,
    workoutDuration: profile.sessionDuration,
    equipment: gym.equipment,
    muscleRecovery: Object.fromEntries(muscleStates.map((state) => [state.muscle, getMuscleRecovery(state, new Date(), settings.recoveryAggressiveness)])),
    exerciseHistory: [...performanceMap.values()],
    exercisePreferences: preferenceMap,
    excludedExercises: preferences.filter((preference) => preference.level === 'exclude').map((preference) => preference.exerciseId),
    limitations: profile.limitations,
    previousWorkouts: workouts.map((workout) => ({
      splitDay: workout.splitDay,
      exerciseIds: exerciseRecords.filter((record) => record.workoutId === workout.id).map((record) => record.exerciseId),
      completedAt: workout.completedAt,
    })),
    trainingFrequency: profile.workoutsPerWeek,
    varietyPreference: settings.varietyPreference,
    supersetsAllowed: settings.supersetsAllowed,
    warmupEnabled: settings.warmupEnabled,
    cardioFinishersAllowed: settings.cardioFinishersAllowed,
    manualSplitDay,
  }
}

export async function generateAndSaveWorkout(manualSplitDay?: string): Promise<WorkoutPlan> {
  const profile = await db.profiles.get('primary')
  const plan = generateWorkout(await buildGenerationInput(manualSplitDay), profile?.units ?? 'lb')
  await db.draftWorkouts.clear()
  await db.draftWorkouts.put(plan)
  return plan
}

export async function generateAndSaveWorkoutVariation(currentPlan: WorkoutPlan): Promise<{ plan: WorkoutPlan; changedCount: number }> {
  const profile = await db.profiles.get('primary')
  const result = generateWorkoutVariation(
    currentPlan,
    await buildGenerationInput(currentPlan.splitDay),
    profile?.units ?? 'lb',
  )
  if (result.changedExercises.length > 0) {
    await db.draftWorkouts.clear()
    await db.draftWorkouts.put(result.plan)
  }
  return { plan: result.plan, changedCount: result.changedExercises.length }
}
