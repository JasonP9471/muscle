import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { copyMealsBetweenDays, deleteSavedMeal, logSavedMeal, saveMeal, saveMealAsTemplate } from './nutrition'

describe('nutrition shortcuts', () => {
  beforeEach(async () => {
    await db.mealItems.clear()
    await db.meals.clear()
    await db.savedMealItems.clear()
    await db.savedMeals.clear()
  })

  it('logs a saved meal with a portion multiplier', async () => {
    const source = await saveMeal({
      name: 'Chicken bowl', type: 'lunch', method: 'manual',
      items: [{ name: 'Chicken', servingLabel: '6 oz', quantity: 1, calories: 280, protein: 52, carbs: 0, fat: 6 }],
    })
    const saved = await saveMealAsTemplate(source.id, source.name)
    const logged = await logSavedMeal(saved.id, 1.5)
    const [item] = await db.mealItems.where('mealId').equals(logged.id).toArray()

    expect(logged.method).toBe('saved')
    expect(item.quantity).toBe(1.5)
  })

  it('copies every meal and item from one local day to another', async () => {
    const yesterday = new Date(2026, 9, 18, 8, 30)
    const today = new Date(2026, 9, 19, 12, 0)
    await saveMeal({
      name: 'Breakfast', type: 'breakfast', method: 'manual', loggedAt: yesterday,
      items: [{ name: 'Eggs', servingLabel: '1 egg', quantity: 3, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 }],
    })
    await saveMeal({
      name: 'Lunch', type: 'lunch', method: 'manual', loggedAt: new Date(2026, 9, 18, 12, 15),
      items: [{ name: 'Rice', servingLabel: '1 cup', quantity: 1, calories: 205, protein: 4.3, carbs: 45, fat: 0.4 }],
    })

    expect(await copyMealsBetweenDays(yesterday, today)).toBe(2)
    const copied = (await db.meals.toArray()).filter((meal) => new Date(meal.loggedAt).getDate() === 19)
    expect(copied.map((meal) => meal.name).sort()).toEqual(['Breakfast', 'Lunch'])
    expect(await db.mealItems.where('mealId').anyOf(copied.map((meal) => meal.id)).count()).toBe(2)
  })

  it('deletes a reusable meal and its items together', async () => {
    const source = await saveMeal({
      name: 'Shake', type: 'snack', method: 'manual',
      items: [{ name: 'Whey', servingLabel: '1 scoop', quantity: 1, calories: 120, protein: 24, carbs: 3, fat: 2 }],
    })
    const saved = await saveMealAsTemplate(source.id, source.name)
    await deleteSavedMeal(saved.id)

    expect(await db.savedMeals.get(saved.id)).toBeUndefined()
    expect(await db.savedMealItems.where('savedMealId').equals(saved.id).count()).toBe(0)
  })
})
