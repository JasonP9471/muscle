import { z } from 'zod'
import { EQUIPMENT } from '../../constants/equipment'
import type { ActivityLevel, DietaryPreference, ExperienceLevel, GoalRate, GymProfile, PrimaryGoal, Profile, TrainingSplit } from '../../types'

const payloadSchema = z.object({
  v: z.literal(1),
  p: z.object({
    n: z.string().trim().min(1).max(80),
    a: z.number().int().min(13).max(100),
    s: z.enum(['female', 'male', 'nonbinary', 'prefer_not_to_say']).optional(),
    h: z.number().min(100).max(250),
    w: z.number().positive().max(700),
    tw: z.number().positive().max(700).optional(),
    u: z.enum(['lb', 'kg']),
    x: z.enum(['beginner', 'intermediate', 'advanced']),
    pg: z.enum(['build_muscle', 'lose_fat', 'get_stronger', 'recomposition', 'improve_fitness', 'maintain']),
    gr: z.enum(['slow', 'moderate', 'aggressive']),
    al: z.enum(['sedentary', 'light', 'moderate', 'very_active']),
    dp: z.enum(['balanced', 'high_protein', 'vegetarian', 'vegan', 'pescatarian', 'low_carb']),
    sp: z.enum(['Full Body', 'Upper / Lower', 'Push / Pull / Legs', 'Push / Pull / Legs x2', 'Custom']),
    d: z.number().int().min(1).max(7),
    m: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(75), z.literal(90)]),
    l: z.string().max(500).default(''),
  }),
  g: z.array(z.enum(['commercial_gym', 'bodyweight_only'])).min(1).max(4),
  r: z.number().positive().max(5_000).optional(),
})

export interface MuscleOSImport {
  profile: {
    name: string
    age: number
    sex?: Profile['sex']
    height: number
    bodyWeight: number
    targetWeight?: number
    units: Profile['units']
    experienceLevel: ExperienceLevel
    primaryGoal: PrimaryGoal
    goalRate: GoalRate
    activityLevel: ActivityLevel
    dietaryPreference: DietaryPreference
    split: TrainingSplit
    workoutsPerWeek: number
    sessionDuration: Profile['sessionDuration']
    limitations: string
  }
  gyms: Array<Pick<GymProfile, 'id' | 'name' | 'equipment'>>
  reportedRestingCalories?: number
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function decodeMuscleOSImport(value: string): MuscleOSImport {
  const payload = payloadSchema.parse(JSON.parse(decodeBase64Url(value)))
  const gyms = payload.g.map((preset, index) => ({
    id: index === 0 ? 'primary' : `muscle-os-${preset}-${index}`,
    name: preset === 'commercial_gym' ? 'Local gym' : 'Apartment',
    equipment: preset === 'commercial_gym' ? [...EQUIPMENT] : ['bodyweight'],
  }))

  return {
    profile: {
      name: payload.p.n,
      age: payload.p.a,
      sex: payload.p.s,
      height: payload.p.h,
      bodyWeight: payload.p.w,
      targetWeight: payload.p.tw,
      units: payload.p.u,
      experienceLevel: payload.p.x,
      primaryGoal: payload.p.pg,
      goalRate: payload.p.gr,
      activityLevel: payload.p.al,
      dietaryPreference: payload.p.dp,
      split: payload.p.sp,
      workoutsPerWeek: payload.p.d,
      sessionDuration: payload.p.m,
      limitations: payload.p.l,
    },
    gyms,
    reportedRestingCalories: payload.r,
  }
}
