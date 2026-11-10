import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { recalculateDerivedData } from './workouts'
import { BUILT_IN_FOODS, FOOD_BY_ID } from '../data/foods'
import { calculateNutritionTargets } from '../algorithms/nutrition'
import type { BodyMetric, Meal, MealItem, SavedMeal, SavedMealItem, SetLog, WorkoutExerciseRecord, WorkoutRecord } from '../types'

const sessions = [
  ['Push', ['barbell-bench-press', 'dumbbell-shoulder-press', 'cable-fly', 'rope-triceps-pushdown']],
  ['Pull', ['lat-pulldown', 'one-arm-dumbbell-row', 'face-pull', 'hammer-curl']],
  ['Legs', ['barbell-back-squat', 'romanian-deadlift', 'leg-extension', 'standing-calf-raise']],
] as const

export async function loadDemoData(): Promise<void> {
  const workouts: WorkoutRecord[] = []
  const workoutExercises: WorkoutExerciseRecord[] = []
  const setLogs: SetLog[] = []
  for (let index = 0; index < 15; index += 1) {
    const [splitDay, exerciseIds] = sessions[index % sessions.length]
    const completed = new Date()
    completed.setDate(completed.getDate() - (42 - index * 3))
    completed.setHours(18, 0, 0, 0)
    const started = new Date(completed.getTime() - (48 + (index % 3) * 6) * 60_000)
    const workoutId = crypto.randomUUID()
    let workoutVolume = 0
    let totalReps = 0
    exerciseIds.forEach((exerciseId, exerciseIndex) => {
      const workoutExerciseId = crypto.randomUUID()
      workoutExercises.push({ id: workoutExerciseId, workoutId, exerciseId, order: exerciseIndex, notes: '', supersetGroup: exerciseIndex >= 2 ? `demo-${workoutId}` : undefined })
      const baseWeight = exerciseIndex === 0 ? 95 + index * 2.5 : exerciseIndex === 1 ? 40 + index : 25 + index * 0.5
      for (let setIndex = 0; setIndex < 3; setIndex += 1) {
        const reps = Math.max(6, 10 - setIndex)
        setLogs.push({
          id: crypto.randomUUID(), workoutId, workoutExerciseId, exerciseId, setNumber: setIndex + 1,
          weight: baseWeight, reps, rir: Math.min(3, 1 + setIndex), completedAt: completed.toISOString(),
        })
        workoutVolume += baseWeight * reps
        totalReps += reps
      }
    })
    workouts.push({
      id: workoutId, title: `${splitDay} · ${splitDay === 'Legs' ? 'Build' : 'Strength'}`, splitDay,
      startedAt: started.toISOString(), completedAt: completed.toISOString(), durationSeconds: (completed.getTime() - started.getTime()) / 1000,
      totalVolume: workoutVolume, totalReps, workingSets: exerciseIds.length * 3,
      focusMuscles: exerciseIds.flatMap((id) => EXERCISE_BY_ID.get(id)?.primaryMuscles.map((target) => target.muscle) ?? []).slice(0, 3), prCount: 0,
      feeling: index % 4 === 0 ? 'hard' : 'good', sessionRpe: index % 4 === 0 ? 8 : 7,
    })
  }
  await db.transaction('rw', [db.workouts, db.workoutExercises, db.setLogs], async () => {
    await db.workouts.clear()
    await db.workoutExercises.clear()
    await db.setLogs.clear()
    await db.workouts.bulkPut(workouts)
    await db.workoutExercises.bulkPut(workoutExercises)
    await db.setLogs.bulkPut(setLogs)
  })
  await recalculateDerivedData()
  await loadDemoNutritionData()
  await db.appSettings.update('primary', { demoMode: true })
}

async function loadDemoNutritionData(): Promise<void> {
  const profile = await db.profiles.get('primary')
  if (!profile) throw new Error('Complete onboarding before loading demo data.')
  const now = new Date()
  const meals: Meal[] = []
  const mealItems: MealItem[] = []
  const metrics: BodyMetric[] = []
  const dayTemplates = [
    { type: 'breakfast' as const, name: 'Eggs, yogurt & fruit', foods: [['egg-large', 4], ['banana-medium', 1], ['greek-yogurt', 1]] as const },
    { type: 'lunch' as const, name: 'Chicken rice bowl', foods: [['chicken-breast', 1], ['white-rice', 1.5], ['mixed-vegetables', 1]] as const },
    { type: 'snack' as const, name: 'Protein shake', foods: [['protein-powder', 1.5], ['fairlife-milk', 1], ['banana-medium', 1], ['peanut-butter', 0.5]] as const },
    { type: 'dinner' as const, name: 'Salmon & potatoes', foods: [['salmon', 1], ['potatoes', 1.5], ['mixed-vegetables', 1]] as const },
  ]
  for (let dayIndex = 13; dayIndex >= 0; dayIndex -= 1) {
    const date = new Date(now); date.setDate(now.getDate() - dayIndex)
    metrics.push({ id: crypto.randomUUID(), loggedAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7).toISOString(), weight: Number((profile.bodyWeight - 1.3 + (13 - dayIndex) * 0.1).toFixed(1)), notes: dayIndex === 0 ? 'Morning weigh-in' : '' })
    dayTemplates.forEach((template, mealIndex) => {
      const mealId = crypto.randomUUID()
      const loggedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8 + mealIndex * 4).toISOString()
      meals.push({ id: mealId, name: template.name, type: template.type, loggedAt, method: 'manual', estimated: false, createdAt: loggedAt })
      template.foods.forEach(([foodId, quantity]) => {
        const food = FOOD_BY_ID.get(foodId)!
        mealItems.push({ id: crypto.randomUUID(), mealId, foodId, name: food.name, servingLabel: food.servingLabel, quantity, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat })
      })
    })
  }
  const savedMealId = crypto.randomUUID()
  const savedMeal: SavedMeal = { id: savedMealId, name: 'Breakfast Shake', defaultType: 'breakfast', createdAt: now.toISOString(), updatedAt: now.toISOString() }
  const savedMealItems: SavedMealItem[] = ['fairlife-milk', 'banana-medium', 'peanut-butter', 'protein-powder'].map((foodId) => {
    const food = FOOD_BY_ID.get(foodId)!
    return { id: crypto.randomUUID(), savedMealId, foodId, name: food.name, servingLabel: food.servingLabel, quantity: 1, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat }
  })
  const targets = calculateNutritionTargets({
    age: profile.age, sex: profile.sex, heightCm: profile.height, weight: profile.bodyWeight, units: profile.units,
    activityLevel: profile.activityLevel ?? 'very_active', primaryGoal: profile.primaryGoal ?? 'build_muscle', goalRate: profile.goalRate ?? 'moderate',
  })
  await db.transaction('rw', [db.foods, db.meals, db.mealItems, db.bodyMetrics, db.savedMeals, db.savedMealItems, db.nutritionTargets], async () => {
    await db.foods.bulkPut(BUILT_IN_FOODS)
    await db.meals.clear(); await db.mealItems.clear(); await db.bodyMetrics.clear(); await db.savedMeals.clear(); await db.savedMealItems.clear()
    await db.meals.bulkPut(meals); await db.mealItems.bulkPut(mealItems); await db.bodyMetrics.bulkPut(metrics)
    await db.savedMeals.put(savedMeal); await db.savedMealItems.bulkPut(savedMealItems); await db.nutritionTargets.put(targets)
  })
}
