import type {
  AdaptiveRecommendation, BodyMetric, MealItem, MuscleState, NutritionTargets,
  PrimaryGoal, Profile, WorkoutRecord,
} from '../../types'
import { recommendCalorieAdjustment, sumNutrition } from '../nutrition'

export interface AdaptiveCoachInput {
  profile: Profile
  targets: NutritionTargets
  todayItems: MealItem[]
  recentDailyCalories: number[]
  bodyMetrics: BodyMetric[]
  muscleStates: MuscleState[]
  workouts: WorkoutRecord[]
  now?: Date
}

export function generateAdaptiveRecommendations(input: AdaptiveCoachInput): AdaptiveRecommendation[] {
  const now = input.now ?? new Date()
  const createdAt = now.toISOString()
  const totals = sumNutrition(input.todayItems)
  const recommendations: AdaptiveRecommendation[] = []
  const proteinRemaining = Math.max(0, Math.round(input.targets.protein - totals.protein))
  if (proteinRemaining >= 20) recommendations.push({
    id: 'protein-gap', type: 'nutrition', priority: proteinRemaining >= 60 ? 'high' : 'medium',
    title: `${proteinRemaining}g protein remaining`,
    message: 'Prioritize a protein-rich meal or snack to support today’s training and recovery target.',
    actionLabel: 'Log food', actionPath: '/nutrition', createdAt,
  })

  const lowest = [...input.muscleStates].sort((a, b) => a.recovery - b.recovery)[0]
  const highest = [...input.muscleStates].sort((a, b) => b.recovery - a.recovery).slice(0, 2)
  if (lowest?.recovery < 45) recommendations.push({
    id: 'low-recovery', type: 'recovery', priority: 'high', title: `${formatMuscle(lowest.muscle)} recovery is low`,
    message: `TrainOS will reduce direct ${formatMuscle(lowest.muscle).toLowerCase()} volume and prioritize ${highest.map((state) => formatMuscle(state.muscle)).join(' and ')}.`,
    actionLabel: 'Review workout', actionPath: '/train', createdAt,
  })

  const lastSevenDays = new Date(now); lastSevenDays.setDate(lastSevenDays.getDate() - 7)
  const recentWorkouts = input.workouts.filter((workout) => new Date(workout.completedAt) >= lastSevenDays).length
  if (recentWorkouts < Math.max(1, input.profile.workoutsPerWeek - 1)) recommendations.push({
    id: 'schedule-gap', type: 'training', priority: 'medium', title: 'Your week can still adapt',
    message: `${recentWorkouts} session${recentWorkouts === 1 ? '' : 's'} completed in the last 7 days. The next plan prioritizes recovered muscles instead of skipping progression.`,
    actionLabel: 'Build workout', actionPath: '/train', createdAt,
  })

  const calorieAdherence = input.recentDailyCalories.length
    ? Math.round(input.recentDailyCalories.reduce((sum, calories) => sum + (Math.abs(calories - input.targets.calories) <= input.targets.calories * 0.12 ? 1 : 0), 0) / input.recentDailyCalories.length * 100)
    : 0
  const adjustment = recommendCalorieAdjustment({
    weightLogs: input.bodyMetrics, adherence: calorieAdherence,
    goal: input.profile.primaryGoal ?? goalToPrimary(input.profile.goal), currentCalories: input.targets.calories, units: input.profile.units,
  })
  if (adjustment) recommendations.push({
    id: 'calorie-adjustment', type: 'progress', priority: 'medium', title: `${adjustment.change > 0 ? 'Increase' : 'Reduce'} calories by ${Math.abs(adjustment.change)}`,
    message: adjustment.reason, proposedCalories: adjustment.proposedCalories, actionLabel: 'Review target', actionPath: '/profile', createdAt,
  })

  if (recommendations.length === 0) recommendations.push({
    id: 'on-track', type: 'progress', priority: 'low', title: 'Your plan is on track',
    message: 'Training, recovery, and nutrition signals are aligned. Keep logging consistently so recommendations can become more specific.',
    actionLabel: 'View progress', actionPath: '/progress', createdAt,
  })
  return recommendations.slice(0, 4)
}

function goalToPrimary(goal: Profile['goal']): PrimaryGoal {
  if (goal === 'build_muscle') return 'build_muscle'
  if (goal === 'build_strength') return 'get_stronger'
  if (goal === 'general_fitness') return 'improve_fitness'
  return 'maintain'
}

function formatMuscle(muscle: string): string {
  return muscle.replace(/\b\w/g, (character) => character.toUpperCase())
}
