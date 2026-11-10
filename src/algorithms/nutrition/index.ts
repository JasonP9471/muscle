import type {
  ActivityLevel, BodyMetric, MealItem, NutritionTargets, PrimaryGoal, Profile,
} from '../../types'

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
}

const GOAL_ADJUSTMENT: Record<PrimaryGoal, Record<'slow' | 'moderate' | 'aggressive', number>> = {
  build_muscle: { slow: 125, moderate: 225, aggressive: 325 },
  lose_fat: { slow: -250, moderate: -400, aggressive: -500 },
  get_stronger: { slow: 75, moderate: 125, aggressive: 175 },
  recomposition: { slow: 0, moderate: -100, aggressive: -150 },
  improve_fitness: { slow: 0, moderate: 0, aggressive: -100 },
  maintain: { slow: 0, moderate: 0, aggressive: 0 },
}

export interface NutritionProfileInput {
  age: number
  sex?: Profile['sex']
  heightCm: number
  weight: number
  units: Profile['units']
  activityLevel: ActivityLevel
  primaryGoal: PrimaryGoal
  goalRate: 'slow' | 'moderate' | 'aggressive'
}

export function weightToKg(weight: number, units: Profile['units']): number {
  return units === 'lb' ? weight / 2.2046226218 : weight
}

export function calculateBmr(input: Pick<NutritionProfileInput, 'age' | 'sex' | 'heightCm' | 'weight' | 'units'>): number {
  const weightKg = weightToKg(input.weight, input.units)
  const sexConstant = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78
  return Math.round(10 * weightKg + 6.25 * input.heightCm - 5 * input.age + sexConstant)
}

export function calculateTdee(input: NutritionProfileInput): number {
  return Math.round(calculateBmr(input) * ACTIVITY_MULTIPLIER[input.activityLevel])
}

export function calculateNutritionTargets(input: NutritionProfileInput, at = new Date()): NutritionTargets {
  const maintenanceCalories = calculateTdee(input)
  const calories = Math.max(1_300, Math.round((maintenanceCalories + GOAL_ADJUSTMENT[input.primaryGoal][input.goalRate]) / 25) * 25)
  const weightKg = weightToKg(input.weight, input.units)
  const proteinRate = ['build_muscle', 'recomposition', 'lose_fat'].includes(input.primaryGoal) ? 2 : input.primaryGoal === 'get_stronger' ? 1.8 : 1.6
  const protein = Math.round(weightKg * proteinRate)
  const fat = Math.max(45, Math.round(weightKg * 0.8))
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4))
  return {
    id: 'primary', calories, protein, carbs, fat, maintenanceCalories, source: 'calculated',
    effectiveFrom: at.toISOString(), updatedAt: at.toISOString(),
  }
}

export function sumNutrition(items: Array<Pick<MealItem, 'calories' | 'protein' | 'carbs' | 'fat' | 'quantity'>>) {
  return items.reduce((totals, item) => ({
    calories: totals.calories + item.calories * item.quantity,
    protein: totals.protein + item.protein * item.quantity,
    carbs: totals.carbs + item.carbs * item.quantity,
    fat: totals.fat + item.fat * item.quantity,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
}

export function movingAverage(values: number[], windowSize = 7): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < windowSize) return null
    const window = values.slice(index + 1 - windowSize, index + 1)
    return window.reduce((sum, value) => sum + value, 0) / window.length
  })
}

export function calculateCalorieAdherence(dailyCalories: number[], target: number): number {
  if (dailyCalories.length === 0 || target <= 0) return 0
  const meanError = dailyCalories.reduce((sum, calories) => sum + Math.abs(calories - target) / target, 0) / dailyCalories.length
  return Math.round(Math.max(0, 1 - meanError) * 100)
}

export interface CalorieAdjustmentRecommendation {
  change: number
  proposedCalories: number
  reason: string
}

export function recommendCalorieAdjustment({
  weightLogs, adherence, goal, currentCalories, units,
}: {
  weightLogs: BodyMetric[]
  adherence: number
  goal: PrimaryGoal
  currentCalories: number
  units: Profile['units']
}): CalorieAdjustmentRecommendation | null {
  const ordered = weightLogs.filter((entry) => typeof entry.weight === 'number').sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  if (ordered.length < 10 || adherence < 80) return null
  const recent = ordered.slice(-7).map((entry) => entry.weight!)
  const previous = ordered.slice(-14, -7).map((entry) => entry.weight!)
  if (previous.length < 3) return null
  const recentAverage = recent.reduce((sum, value) => sum + value, 0) / recent.length
  const previousAverage = previous.reduce((sum, value) => sum + value, 0) / previous.length
  const change = recentAverage - previousAverage
  const stableThreshold = units === 'lb' ? 0.2 : 0.09
  if (goal === 'build_muscle' && change < stableThreshold) {
    return { change: 125, proposedCalories: currentCalories + 125, reason: 'Your average weight has remained nearly stable while nutrition adherence is high. A small increase may better support muscle gain.' }
  }
  if (goal === 'lose_fat' && change > -stableThreshold) {
    return { change: -125, proposedCalories: Math.max(1_300, currentCalories - 125), reason: 'Your average weight has remained nearly stable while nutrition adherence is high. A small reduction may better support fat loss.' }
  }
  return null
}
