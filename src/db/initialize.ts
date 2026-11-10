import { DEFAULT_EQUIPMENT } from '../constants/equipment'
import { EXERCISES } from '../data/exercises'
import { BUILT_IN_FOODS } from '../data/foods'
import { createFreshMuscleStates } from '../algorithms/recovery'
import { calculateNutritionTargets } from '../algorithms/nutrition'
import type { AppSettings, GymProfile } from '../types'
import { db } from './database'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'primary',
  warmupEnabled: true,
  cooldownEnabled: false,
  supersetsAllowed: true,
  cardioFinishersAllowed: false,
  varietyPreference: 'balanced',
  recoveryAggressiveness: 'balanced',
  restTimerEnabled: true,
  restTimerNotificationsEnabled: false,
  soundsEnabled: false,
  vibrationEnabled: true,
  theme: 'system',
  onboardingComplete: false,
  demoMode: import.meta.env.VITE_DEMO_MODE === 'true',
  cloudSyncEnabled: false,
  activeGymProfileId: 'primary',
}

export async function initializeDatabase(): Promise<void> {
  const [exerciseCount, muscleCount, foodCount, settings, gym, profile, nutritionTargets] = await Promise.all([
    db.exercises.count(),
    db.muscleStates.count(),
    db.foods.count(),
    db.appSettings.get('primary'),
    db.gymProfiles.get('primary'),
    db.profiles.get('primary'),
    db.nutritionTargets.get('primary'),
  ])
  await db.transaction('rw', [db.exercises, db.muscleStates, db.appSettings, db.gymProfiles, db.foods, db.nutritionTargets], async () => {
    if (exerciseCount !== EXERCISES.length) await db.exercises.bulkPut(EXERCISES)
    if (muscleCount === 0) await db.muscleStates.bulkPut(createFreshMuscleStates())
    if (foodCount < BUILT_IN_FOODS.length) await db.foods.bulkPut(BUILT_IN_FOODS)
    if (!settings) await db.appSettings.put(DEFAULT_SETTINGS)
    if (!gym) {
      const gymProfile: GymProfile = { id: 'primary', name: 'My equipment', equipment: [...DEFAULT_EQUIPMENT], updatedAt: new Date().toISOString() }
      await db.gymProfiles.put(gymProfile)
    }
    if (profile && !nutritionTargets) {
      await db.nutritionTargets.put(calculateNutritionTargets({
        age: profile.age, sex: profile.sex, heightCm: profile.height, weight: profile.bodyWeight, units: profile.units,
        activityLevel: profile.activityLevel ?? 'moderate', primaryGoal: profile.primaryGoal ?? 'build_muscle', goalRate: profile.goalRate ?? 'moderate',
      }))
    }
  })
}

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
  await initializeDatabase()
}
