export const MUSCLES = [
  'chest', 'upper chest', 'lats', 'upper back', 'traps', 'front delts', 'side delts',
  'rear delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'spinal erectors',
  'glutes', 'quadriceps', 'hamstrings', 'adductors', 'abductors', 'calves',
] as const

export type Muscle = (typeof MUSCLES)[number]
export type Units = 'lb' | 'kg'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type Goal = 'build_muscle' | 'build_strength' | 'general_fitness' | 'muscular_endurance'
export type TrainingSplit = 'Full Body' | 'Upper / Lower' | 'Push / Pull / Legs' | 'Push / Pull / Legs x2' | 'Custom'
export type VarietyPreference = 'low' | 'balanced' | 'high'
export type RecoveryAggressiveness = 'conservative' | 'balanced' | 'aggressive'
export type ThemePreference = 'system' | 'light' | 'dark'
export type PrimaryGoal = 'build_muscle' | 'lose_fat' | 'get_stronger' | 'recomposition' | 'improve_fitness' | 'maintain'
export type GoalRate = 'slow' | 'moderate' | 'aggressive'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active'
export type DietaryPreference = 'balanced' | 'high_protein' | 'vegetarian' | 'vegan' | 'pescatarian' | 'low_carb'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type NutritionLogMethod = 'manual' | 'text' | 'photo' | 'voice' | 'barcode' | 'saved'
export type ExercisePreferenceLevel = 'favorite' | 'more' | 'neutral' | 'less' | 'exclude'
export type MovementPattern =
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'squat' | 'hinge' | 'lunge' | 'carry' | 'core' | 'isolation' | 'cardio'
export type ExerciseType = 'weighted' | 'bodyweight' | 'assisted' | 'duration' | 'distance'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export interface MuscleContribution {
  muscle: Muscle
  contribution: number
}

export interface Exercise {
  id: string
  name: string
  aliases: string[]
  category: string
  movementPattern: MovementPattern
  primaryMuscles: MuscleContribution[]
  secondaryMuscles: MuscleContribution[]
  requiredEquipment: string[]
  optionalEquipment?: string[]
  difficulty: Difficulty
  exerciseType: ExerciseType
  instructions: string[]
  formTips: string[]
  defaultRestSeconds: number
  compound: boolean
  unilateral: boolean
}

export interface Profile {
  id: 'primary'
  name: string
  age: number
  sex?: 'female' | 'male' | 'nonbinary' | 'prefer_not_to_say'
  height: number
  bodyWeight: number
  targetWeight?: number
  units: Units
  experienceLevel: ExperienceLevel
  goal: Goal
  split: TrainingSplit
  workoutsPerWeek: number
  workoutDays: number[]
  sessionDuration: 15 | 30 | 45 | 60 | 75 | 90
  primaryGoal?: PrimaryGoal
  goalRate?: GoalRate
  activityLevel?: ActivityLevel
  dietaryPreference?: DietaryPreference
  allergies?: string
  mealFrequency?: number
  limitations?: string
  createdAt: string
  updatedAt: string
}

export interface NutritionTargets {
  id: 'primary'
  calories: number
  protein: number
  carbs: number
  fat: number
  maintenanceCalories: number
  source: 'calculated' | 'manual'
  effectiveFrom: string
  updatedAt: string
}

export interface Food {
  id: string
  name: string
  brand?: string
  servingLabel: string
  servingGrams?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  barcode?: string
  source: 'built_in' | 'custom' | 'barcode' | 'ai'
  createdAt: string
}

export interface MealItem {
  id: string
  mealId: string
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

export interface Meal {
  id: string
  name: string
  type: MealType
  loggedAt: string
  method: NutritionLogMethod
  notes?: string
  photoPath?: string
  estimated: boolean
  createdAt: string
}

export interface SavedMeal {
  id: string
  name: string
  defaultType: MealType
  createdAt: string
  updatedAt: string
}

export interface SavedMealItem {
  id: string
  savedMealId: string
  foodId?: string
  name: string
  servingLabel: string
  quantity: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FavoriteFood {
  id: string
  foodId: string
  createdAt: string
}

export interface WeeklyCheckin {
  id: string
  loggedAt: string
  weight: number
  energy: number
  hunger: number
  performance: number
  recovery: number
  notes?: string
  photoPath?: string
}

export interface ProgressPhoto {
  id: string
  loggedAt: string
  localUrl?: string
  storagePath?: string
  caption?: string
  syncState: 'local' | 'pending' | 'synced' | 'failed'
}

export type AdaptiveRecommendationType = 'training' | 'nutrition' | 'recovery' | 'progress'

export interface AdaptiveRecommendation {
  id: string
  type: AdaptiveRecommendationType
  title: string
  message: string
  priority: 'low' | 'medium' | 'high'
  actionLabel?: string
  actionPath?: string
  proposedCalories?: number
  createdAt: string
}

export interface NutritionAnalysisItem {
  name: string
  estimatedServing: string
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
}

export interface NutritionAnalysis {
  mealName: string
  items: NutritionAnalysisItem[]
  total: Pick<NutritionAnalysisItem, 'calories' | 'protein' | 'carbs' | 'fat'>
  confidence: number
  disclaimer: string
}

export interface GymProfile {
  id: string
  name: string
  equipment: string[]
  updatedAt: string
}

export interface AppSettings {
  id: 'primary'
  warmupEnabled: boolean
  cooldownEnabled: boolean
  supersetsAllowed: boolean
  cardioFinishersAllowed: boolean
  varietyPreference: VarietyPreference
  recoveryAggressiveness: RecoveryAggressiveness
  restTimerEnabled: boolean
  restTimerNotificationsEnabled?: boolean
  soundsEnabled: boolean
  vibrationEnabled: boolean
  theme: ThemePreference
  onboardingComplete: boolean
  demoMode?: boolean
  cloudSyncEnabled?: boolean
  lastCloudSyncAt?: string
  activeGymProfileId?: string
}

export interface ExercisePreference {
  exerciseId: string
  level: ExercisePreferenceLevel
  updatedAt: string
}

export interface FatigueSource {
  workoutId: string
  exerciseId: string
  exerciseName: string
  sets: number
  fatigue: number
  trainedAt: string
}

export interface MuscleState {
  muscle: Muscle
  recovery: number
  lastUpdatedAt: string
  lastTrainedAt?: string
  recoveryWindowHours: number
  sources: FatigueSource[]
  manualAdjustment: number
}

export interface SetPrescription {
  id: string
  setNumber: number
  targetRepMin: number
  targetRepMax: number
  recommendedWeight?: number
  restSeconds: number
  completed: boolean
  weight?: number
  reps?: number
  rir?: number
  isWarmup?: boolean
}

export interface PlannedExercise {
  id: string
  exerciseId: string
  order: number
  sets: SetPrescription[]
  notes: string
  supersetGroup?: string
}

export interface WorkoutPlan {
  id: string
  title: string
  splitDay: string
  focusMuscles: Muscle[]
  estimatedDuration: number
  readiness: number
  explanation: string
  createdAt: string
  manuallyEdited: boolean
  exercises: PlannedExercise[]
}

export interface RestTimerState {
  durationSeconds: number
  remainingSeconds: number
  endAt?: string
  running: boolean
}

export interface ActiveWorkout extends WorkoutPlan {
  id: 'active'
  planId: string
  startedAt: string
  elapsedBeforeStart: number
  pausedAt?: string
  autosavedAt: string
  restTimer: RestTimerState
}

export interface WorkoutRecord {
  id: string
  title: string
  splitDay: string
  startedAt: string
  completedAt: string
  durationSeconds: number
  totalVolume: number
  totalReps: number
  workingSets: number
  focusMuscles: Muscle[]
  prCount: number
  feeling?: 'easy' | 'good' | 'hard' | 'too_hard'
  sessionRpe?: number
}

export interface WorkoutExerciseRecord {
  id: string
  workoutId: string
  exerciseId: string
  order: number
  notes: string
  supersetGroup?: string
}

export interface SetLog {
  id: string
  workoutId: string
  workoutExerciseId: string
  exerciseId: string
  setNumber: number
  weight: number
  reps: number
  rir: number
  completedAt: string
}

export type RecordType = 'weight' | 'reps' | 'estimated_1rm' | 'exercise_volume' | 'workout_volume'

export interface PersonalRecord {
  id: string
  exerciseId?: string
  workoutId: string
  type: RecordType
  value: number
  achievedAt: string
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: PlannedExercise[]
  createdAt: string
  updatedAt: string
}

export interface BodyMetric {
  id: string
  loggedAt: string
  weight?: number
  bodyFatPercentage?: number
  notes: string
}

export interface ExercisePerformance {
  exerciseId: string
  performedAt: string
  sets: Array<{ weight: number; reps: number; rir: number }>
}

export interface WorkoutGenerationInput {
  goal: Goal
  experienceLevel: ExperienceLevel
  split: TrainingSplit
  workoutDuration: 15 | 30 | 45 | 60 | 75 | 90
  equipment: string[]
  muscleRecovery: Partial<Record<Muscle, number>>
  exerciseHistory: ExercisePerformance[]
  exercisePreferences: Record<string, ExercisePreferenceLevel>
  excludedExercises: string[]
  limitations?: string
  previousWorkouts: Array<{ splitDay: string; exerciseIds: string[]; completedAt: string }>
  trainingFrequency: number
  varietyPreference: VarietyPreference
  supersetsAllowed?: boolean
  warmupEnabled?: boolean
  cardioFinishersAllowed?: boolean
  manualSplitDay?: string
}

export interface ExerciseScoreContext {
  goal: Goal
  experienceLevel: ExperienceLevel
  equipment: string[]
  targetMuscles: Muscle[]
  muscleRecovery: Partial<Record<Muscle, number>>
  preference: ExercisePreferenceLevel
  excluded: boolean
  recentExerciseIds: string[]
  neededPatterns: MovementPattern[]
  varietyPreference: VarietyPreference
}
