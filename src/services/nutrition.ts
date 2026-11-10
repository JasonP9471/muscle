import { db } from '../db/database'
import type { Meal, MealItem, MealType, NutritionAnalysis, NutritionLogMethod, SavedMeal } from '../types'

export interface MealDraftItem {
  foodId?: string
  name: string
  servingLabel: string
  quantity: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence?: number
}

export async function saveMeal({
  name, type, method, items, loggedAt = new Date(), notes, estimated = false,
}: {
  name: string
  type: MealType
  method: NutritionLogMethod
  items: MealDraftItem[]
  loggedAt?: Date
  notes?: string
  estimated?: boolean
}): Promise<Meal> {
  if (items.length === 0) throw new Error('Add at least one food before saving the meal.')
  if (items.some((item) => item.calories < 0 || item.protein < 0 || item.carbs < 0 || item.fat < 0 || item.quantity <= 0)) {
    throw new Error('Nutrition values and quantities must be valid positive numbers.')
  }
  const mealId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const meal: Meal = { id: mealId, name: name.trim() || 'Meal', type, method, loggedAt: loggedAt.toISOString(), notes, estimated, createdAt }
  const mealItems: MealItem[] = items.map((item) => ({ ...item, id: crypto.randomUUID(), mealId }))
  await db.transaction('rw', [db.meals, db.mealItems], async () => {
    await db.meals.put(meal)
    await db.mealItems.bulkPut(mealItems)
  })
  return meal
}

export async function saveAnalysis(analysis: NutritionAnalysis, type: MealType, method: Extract<NutritionLogMethod, 'text' | 'photo' | 'voice'>): Promise<Meal> {
  return saveMeal({
    name: analysis.mealName, type, method, estimated: true,
    notes: `Estimate reviewed before saving · ${Math.round(analysis.confidence * 100)}% analysis confidence`,
    items: analysis.items.map((item) => ({
      name: item.name, servingLabel: item.estimatedServing, quantity: 1,
      calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, confidence: item.confidence,
    })),
  })
}

export async function deleteMeal(mealId: string): Promise<void> {
  await db.transaction('rw', [db.meals, db.mealItems], async () => {
    await db.mealItems.where('mealId').equals(mealId).delete()
    await db.meals.delete(mealId)
  })
}

export async function saveMealAsTemplate(mealId: string, name: string): Promise<SavedMeal> {
  const items = await db.mealItems.where('mealId').equals(mealId).toArray()
  if (items.length === 0) throw new Error('This meal has no foods to save.')
  const meal = await db.meals.get(mealId)
  if (!meal) throw new Error('Meal not found.')
  const now = new Date().toISOString()
  const saved: SavedMeal = { id: crypto.randomUUID(), name: name.trim() || meal.name, defaultType: meal.type, createdAt: now, updatedAt: now }
  await db.transaction('rw', [db.savedMeals, db.savedMealItems], async () => {
    await db.savedMeals.put(saved)
    await db.savedMealItems.bulkPut(items.map(({ id: _id, mealId: _mealId, confidence: _confidence, ...item }) => ({ ...item, id: crypto.randomUUID(), savedMealId: saved.id })))
  })
  return saved
}

export async function logSavedMeal(savedMealId: string, portion = 1, type?: MealType): Promise<Meal> {
  if (!Number.isFinite(portion) || portion <= 0) throw new Error('Choose a valid portion before adding this meal.')
  const [saved, items] = await Promise.all([db.savedMeals.get(savedMealId), db.savedMealItems.where('savedMealId').equals(savedMealId).toArray()])
  if (!saved || items.length === 0) throw new Error('Saved meal is unavailable.')
  return saveMeal({
    name: saved.name,
    type: type ?? saved.defaultType,
    method: 'saved',
    items: items.map((item) => ({ ...item, quantity: item.quantity * portion })),
  })
}

export async function deleteSavedMeal(savedMealId: string): Promise<void> {
  await db.transaction('rw', [db.savedMeals, db.savedMealItems], async () => {
    await db.savedMealItems.where('savedMealId').equals(savedMealId).delete()
    await db.savedMeals.delete(savedMealId)
  })
}

export async function copyMealsBetweenDays(sourceDay: Date, targetDay: Date): Promise<number> {
  const sourceStart = startOfLocalDay(sourceDay)
  const sourceEnd = new Date(sourceStart)
  sourceEnd.setDate(sourceEnd.getDate() + 1)
  const meals = await db.meals.where('loggedAt').between(sourceStart.toISOString(), sourceEnd.toISOString(), true, false).toArray()
  if (meals.length === 0) return 0

  const sourceIds = new Set(meals.map((meal) => meal.id))
  const items = (await db.mealItems.toArray()).filter((item) => sourceIds.has(item.mealId))
  const createdAt = new Date().toISOString()
  const copies = meals.map((meal) => {
    const sourceTime = new Date(meal.loggedAt)
    const loggedAt = new Date(targetDay)
    loggedAt.setHours(sourceTime.getHours(), sourceTime.getMinutes(), sourceTime.getSeconds(), sourceTime.getMilliseconds())
    return { ...meal, id: crypto.randomUUID(), loggedAt: loggedAt.toISOString(), createdAt }
  })
  const copiedIds = new Map(meals.map((meal, index) => [meal.id, copies[index].id]))
  const copiedItems = items.map((item) => ({ ...item, id: crypto.randomUUID(), mealId: copiedIds.get(item.mealId)! }))

  await db.transaction('rw', [db.meals, db.mealItems], async () => {
    await db.meals.bulkPut(copies)
    await db.mealItems.bulkPut(copiedItems)
  })
  return copies.length
}

function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}
