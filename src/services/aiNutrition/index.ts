import { z } from 'zod'
import { BUILT_IN_FOODS } from '../../data/foods'
import type { NutritionAnalysis, NutritionAnalysisItem } from '../../types'
import { authProvider } from '../auth/provider'

const AnalysisItemSchema = z.object({
  name: z.string().min(1), estimatedServing: z.string().min(1),
  calories: z.number().min(0).max(5_000), protein: z.number().min(0).max(500),
  carbs: z.number().min(0).max(1_000), fat: z.number().min(0).max(500), confidence: z.number().min(0).max(1),
})

export const NutritionAnalysisSchema = z.object({
  mealName: z.string().min(1), items: z.array(AnalysisItemSchema).min(1).max(20),
  total: z.object({ calories: z.number().min(0), protein: z.number().min(0), carbs: z.number().min(0), fat: z.number().min(0) }),
  confidence: z.number().min(0).max(1),
  disclaimer: z.string().min(1),
})

const PHRASE_RULES = [
  { phrases: ['egg'], foodId: 'egg-large', quantity: (text: string) => quantityBefore(text, 'egg') || 2 },
  { phrases: ['toast', 'bread'], foodId: 'toast-wheat', quantity: (text: string) => quantityBefore(text, 'slice') || 2 },
  { phrases: ['banana'], foodId: 'banana-medium', quantity: () => 1 },
  { phrases: ['greek yogurt', 'yogurt'], foodId: 'greek-yogurt', quantity: () => 1 },
  { phrases: ['chicken'], foodId: 'chicken-breast', quantity: () => 1 },
  { phrases: ['rice'], foodId: 'white-rice', quantity: () => 1 },
  { phrases: ['vegetable', 'veggies'], foodId: 'mixed-vegetables', quantity: () => 1 },
  { phrases: ['salmon'], foodId: 'salmon', quantity: () => 1 },
  { phrases: ['potato', 'fries'], foodId: 'potatoes', quantity: () => 1 },
  { phrases: ['protein shake', 'protein powder', 'whey'], foodId: 'protein-powder', quantity: () => 1 },
  { phrases: ['milk'], foodId: 'fairlife-milk', quantity: () => 1 },
  { phrases: ['peanut butter'], foodId: 'peanut-butter', quantity: () => 1 },
  { phrases: ['black beans', 'beans'], foodId: 'black-beans', quantity: () => 1 },
  { phrases: ['cheese'], foodId: 'cheddar', quantity: () => 1 },
] as const

export async function analyzeNutritionText(description: string): Promise<NutritionAnalysis> {
  const clean = description.trim()
  if (clean.length < 3) throw new Error('Describe what you ate before analyzing it.')
  if (import.meta.env.VITE_DEMO_MODE === 'true') return demoAnalysis(clean)
  return callServer({ kind: 'text', description: clean })
}

export async function analyzeNutritionPhoto(file: File, description = ''): Promise<NutritionAnalysis> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file to scan a meal.')
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.')
  return callServer({ kind: 'photo', description, imageDataUrl: await fileToDataUrl(file) })
}

export interface NutritionAnalysisAvailability {
  available: boolean
  message: string
}

export async function getNutritionAnalysisAvailability(): Promise<NutritionAnalysisAvailability> {
  const session = await authProvider.getSession()
  if (!session || session.demo) return { available: false, message: 'Sign in to use meal photo analysis.' }
  try {
    const response = await fetch('/api/analyze-nutrition', {
      method: 'GET', headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
    })
    const payload = await readApiMessage(response)
    if (!response.ok) return { available: false, message: payload.message }
    const status = z.object({ available: z.boolean(), message: z.string().min(1) }).safeParse(payload)
    return status.success ? status.data : { available: false, message: 'Meal photo analysis is unavailable right now. Log food manually instead.' }
  } catch {
    return { available: false, message: 'Meal photo analysis is unavailable right now. Log food manually instead.' }
  }
}

async function callServer(payload: Record<string, string>): Promise<NutritionAnalysis> {
  const session = await authProvider.getSession()
  if (!session || session.demo) throw new Error('Sign in to use nutrition analysis.')
  const response = await fetch('/api/analyze-nutrition', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error((await readApiMessage(response)).message)
  return NutritionAnalysisSchema.parse(await response.json())
}

async function readApiMessage(response: Response): Promise<{ message: string; [key: string]: unknown }> {
  try {
    const value = await response.clone().json() as unknown
    if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
      return value as { message: string; [key: string]: unknown }
    }
  } catch { /* Return the safe generic state below. */ }
  return { message: 'Meal photo analysis is unavailable right now. Log food manually instead.' }
}

function demoAnalysis(description: string): NutritionAnalysis {
  const normalized = description.toLowerCase()
  const matched = PHRASE_RULES.filter((rule) => rule.phrases.some((phrase) => normalized.includes(phrase)))
  const foods = matched.length > 0 ? matched : [{ foodId: 'chicken-breast', quantity: () => 1 }]
  const items: NutritionAnalysisItem[] = foods.map((rule) => {
    const food = BUILT_IN_FOODS.find((candidate) => candidate.id === rule.foodId)!
    const quantity = Math.min(12, Math.max(0.25, rule.quantity(normalized)))
    return {
      name: food.name, estimatedServing: quantity === 1 ? food.servingLabel : `${quantity} × ${food.servingLabel}`,
      calories: Math.round(food.calories * quantity), protein: round(food.protein * quantity),
      carbs: round(food.carbs * quantity), fat: round(food.fat * quantity), confidence: matched.length > 0 ? 0.76 : 0.42,
    }
  })
  const total = items.reduce((sum, item) => ({
    calories: sum.calories + item.calories, protein: round(sum.protein + item.protein),
    carbs: round(sum.carbs + item.carbs), fat: round(sum.fat + item.fat),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  return {
    mealName: titleCase(description.length > 55 ? `${description.slice(0, 52)}…` : description), items, total,
    confidence: matched.length > 0 ? 0.74 : 0.4,
    disclaimer: 'Nutrition values are estimates. Review foods, serving sizes, and macros before saving.',
  }
}

function quantityBefore(text: string, token: string): number | null {
  const match = text.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s+(?:\\w+\\s+){0,2}${token}`))
  return match ? Number(match[1]) : null
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function round(value: number): number { return Math.round(value * 10) / 10 }

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read that image.'))
    reader.onerror = () => reject(new Error('Unable to read that image.'))
    reader.readAsDataURL(file)
  })
}
