import { describe, expect, it } from 'vitest'
import { calculateBmr, calculateCalorieAdherence, calculateNutritionTargets, calculateTdee, movingAverage, recommendCalorieAdjustment, sumNutrition } from '.'
import type { BodyMetric } from '../../types'

const input = { age: 30, sex: 'male' as const, heightCm: 188, weight: 190, units: 'lb' as const, activityLevel: 'moderate' as const, primaryGoal: 'build_muscle' as const, goalRate: 'moderate' as const }

describe('nutrition calculations', () => {
  it('uses Mifflin-St Jeor and an activity multiplier', () => {
    expect(calculateBmr(input)).toBe(1892)
    expect(calculateTdee(input)).toBe(2933)
  })

  it('allocates a safe calorie and protein-prioritized macro target', () => {
    const targets = calculateNutritionTargets(input, new Date('2026-08-25T12:00:00Z'))
    expect(targets.calories).toBe(3150)
    expect(targets.protein).toBeGreaterThanOrEqual(170)
    expect(targets.fat).toBeGreaterThanOrEqual(45)
    expect(targets.carbs).toBeGreaterThan(200)
  })

  it('calculates totals, moving averages, and adherence', () => {
    expect(sumNutrition([{ calories: 100, protein: 10, carbs: 15, fat: 2, quantity: 2 }])).toEqual({ calories: 200, protein: 20, carbs: 30, fat: 4 })
    expect(movingAverage([1,2,3,4], 3)).toEqual([null,null,2,3])
    expect(calculateCalorieAdherence([2000,2050,1950], 2000)).toBe(98)
  })

  it('only recommends a weekly adjustment with sufficient data and adherence', () => {
    const weightLogs: BodyMetric[] = Array.from({ length: 14 }, (_, index) => ({ id:String(index),loggedAt:new Date(2026,7,index+1).toISOString(),weight:190 + (index % 2) * .05,notes:'' }))
    expect(recommendCalorieAdjustment({ weightLogs, adherence: 92, goal: 'build_muscle', currentCalories: 3100, units: 'lb' })).toMatchObject({ change: 125, proposedCalories: 3225 })
    expect(recommendCalorieAdjustment({ weightLogs, adherence: 55, goal: 'build_muscle', currentCalories: 3100, units: 'lb' })).toBeNull()
  })
})
