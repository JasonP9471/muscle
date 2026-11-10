import Dexie, { type EntityTable } from 'dexie'
import type {
  ActiveWorkout, AdaptiveRecommendation, AppSettings, BodyMetric, Exercise, ExercisePreference,
  FavoriteFood, Food, GymProfile, Meal, MealItem, MuscleState, NutritionTargets,
  PersonalRecord, Profile, ProgressPhoto, SavedMeal, SavedMealItem, SetLog, WeeklyCheckin,
  WorkoutExerciseRecord, WorkoutPlan, WorkoutRecord, WorkoutTemplate,
} from '../types'

export interface SyncQueueEntry {
  id: 'account-snapshot'
  payload: unknown
  fingerprint: string
  reason: string
  createdAt: string
  updatedAt: string
  attemptCount: number
  lastError?: string
}

export interface SyncMetadata {
  id: string
  userId: string
  baseline: unknown
  remoteUpdatedAt?: string
  updatedAt: string
}

export interface SyncConflictRecord {
  id: string
  userId: string
  table: string
  recordId: string
  fields: string[]
  resolution: 'merged_fields' | 'kept_local' | 'kept_remote' | 'kept_existing'
  resolvedAt: string
}

export class TrainOSDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  gymProfiles!: EntityTable<GymProfile, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  exercisePreferences!: EntityTable<ExercisePreference, 'exerciseId'>
  workoutTemplates!: EntityTable<WorkoutTemplate, 'id'>
  workouts!: EntityTable<WorkoutRecord, 'id'>
  workoutExercises!: EntityTable<WorkoutExerciseRecord, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  muscleStates!: EntityTable<MuscleState, 'muscle'>
  bodyMetrics!: EntityTable<BodyMetric, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>
  activeWorkout!: EntityTable<ActiveWorkout, 'id'>
  draftWorkouts!: EntityTable<WorkoutPlan, 'id'>
  appSettings!: EntityTable<AppSettings, 'id'>
  nutritionTargets!: EntityTable<NutritionTargets, 'id'>
  foods!: EntityTable<Food, 'id'>
  meals!: EntityTable<Meal, 'id'>
  mealItems!: EntityTable<MealItem, 'id'>
  favoriteFoods!: EntityTable<FavoriteFood, 'id'>
  savedMeals!: EntityTable<SavedMeal, 'id'>
  savedMealItems!: EntityTable<SavedMealItem, 'id'>
  weeklyCheckins!: EntityTable<WeeklyCheckin, 'id'>
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>
  adaptiveRecommendations!: EntityTable<AdaptiveRecommendation, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>
  syncMetadata!: EntityTable<SyncMetadata, 'id'>
  syncConflicts!: EntityTable<SyncConflictRecord, 'id'>

  constructor() {
    super('trainos')
    this.version(1).stores({
      profiles: 'id',
      gymProfiles: 'id',
      exercises: 'id, name, category, movementPattern, difficulty, compound',
      exercisePreferences: 'exerciseId, level',
      workoutTemplates: 'id, name, updatedAt',
      workouts: 'id, completedAt, splitDay',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      setLogs: 'id, workoutId, workoutExerciseId, exerciseId, completedAt',
      muscleStates: 'muscle, recovery, lastTrainedAt',
      bodyMetrics: 'id, loggedAt',
      personalRecords: 'id, workoutId, exerciseId, type, achievedAt',
      activeWorkout: 'id, startedAt',
      appSettings: 'id',
    })
    this.version(2).stores({
      profiles: 'id',
      gymProfiles: 'id',
      exercises: 'id, name, category, movementPattern, difficulty, compound',
      exercisePreferences: 'exerciseId, level',
      workoutTemplates: 'id, name, updatedAt',
      workouts: 'id, completedAt, splitDay',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      setLogs: 'id, workoutId, workoutExerciseId, exerciseId, completedAt',
      muscleStates: 'muscle, recovery, lastTrainedAt',
      bodyMetrics: 'id, loggedAt',
      personalRecords: 'id, workoutId, exerciseId, type, achievedAt',
      activeWorkout: 'id, startedAt',
      draftWorkouts: 'id, createdAt',
      appSettings: 'id',
    })
    this.version(3).stores({
      profiles: 'id',
      gymProfiles: 'id',
      exercises: 'id, name, category, movementPattern, difficulty, compound',
      exercisePreferences: 'exerciseId, level',
      workoutTemplates: 'id, name, updatedAt',
      workouts: 'id, completedAt, splitDay',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      setLogs: 'id, workoutId, workoutExerciseId, exerciseId, completedAt',
      muscleStates: 'muscle, recovery, lastTrainedAt',
      bodyMetrics: 'id, loggedAt',
      personalRecords: 'id, workoutId, exerciseId, type, achievedAt',
      activeWorkout: 'id, startedAt',
      draftWorkouts: 'id, createdAt',
      appSettings: 'id',
      nutritionTargets: 'id, updatedAt',
      foods: 'id, name, barcode, source',
      meals: 'id, loggedAt, type, method',
      mealItems: 'id, mealId, foodId',
      favoriteFoods: 'id, foodId, createdAt',
      savedMeals: 'id, name, updatedAt',
      savedMealItems: 'id, savedMealId, foodId',
      weeklyCheckins: 'id, loggedAt',
      progressPhotos: 'id, loggedAt, syncState',
      adaptiveRecommendations: 'id, createdAt, type, priority',
    })
    this.version(4).stores({
      profiles: 'id',
      gymProfiles: 'id',
      exercises: 'id, name, category, movementPattern, difficulty, compound',
      exercisePreferences: 'exerciseId, level',
      workoutTemplates: 'id, name, updatedAt',
      workouts: 'id, completedAt, splitDay',
      workoutExercises: 'id, workoutId, exerciseId, [workoutId+order]',
      setLogs: 'id, workoutId, workoutExerciseId, exerciseId, completedAt',
      muscleStates: 'muscle, recovery, lastTrainedAt',
      bodyMetrics: 'id, loggedAt',
      personalRecords: 'id, workoutId, exerciseId, type, achievedAt',
      activeWorkout: 'id, startedAt',
      draftWorkouts: 'id, createdAt',
      appSettings: 'id',
      nutritionTargets: 'id, updatedAt',
      foods: 'id, name, barcode, source',
      meals: 'id, loggedAt, type, method',
      mealItems: 'id, mealId, foodId',
      favoriteFoods: 'id, foodId, createdAt',
      savedMeals: 'id, name, updatedAt',
      savedMealItems: 'id, savedMealId, foodId',
      weeklyCheckins: 'id, loggedAt',
      progressPhotos: 'id, loggedAt, syncState',
      adaptiveRecommendations: 'id, createdAt, type, priority',
      syncQueue: 'id, updatedAt, attemptCount',
      syncMetadata: 'id, userId, updatedAt',
      syncConflicts: 'id, userId, resolvedAt, [table+recordId]',
    })
  }
}

export const db = new TrainOSDatabase()
