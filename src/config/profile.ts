import type { ActivityLevel, DietaryPreference, Goal, GoalRate, PrimaryGoal } from '../types'

export interface LabeledOption<T extends string> {
  value: T
  label: string
}

export const PRIMARY_GOAL_OPTIONS: ReadonlyArray<LabeledOption<PrimaryGoal>> = [
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'get_stronger', label: 'Get Stronger' },
  { value: 'recomposition', label: 'Recomposition' },
  { value: 'improve_fitness', label: 'Improve Fitness' },
  { value: 'maintain', label: 'Maintain' },
]

export const GOAL_RATE_OPTIONS: ReadonlyArray<LabeledOption<GoalRate>> = [
  { value: 'slow', label: 'Slow' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive, within safe bounds' },
]

export const ACTIVITY_LEVEL_OPTIONS: ReadonlyArray<LabeledOption<ActivityLevel>> = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'very_active', label: 'Very Active' },
]

export const DIETARY_PREFERENCE_OPTIONS: ReadonlyArray<LabeledOption<DietaryPreference>> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'high_protein', label: 'High Protein' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'low_carb', label: 'Low Carb' },
]

export function trainingGoalForPrimaryGoal(goal: PrimaryGoal): Goal {
  if (goal === 'build_muscle' || goal === 'recomposition') return 'build_muscle'
  if (goal === 'get_stronger' || goal === 'lose_fat') return 'build_strength'
  return 'general_fitness'
}

export function primaryGoalFromTrainingGoal(goal: Goal): PrimaryGoal {
  if (goal === 'build_strength') return 'get_stronger'
  if (goal === 'general_fitness' || goal === 'muscular_endurance') return 'improve_fitness'
  return 'build_muscle'
}
