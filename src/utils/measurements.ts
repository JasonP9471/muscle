import type { Units } from '../types'

const INCHES_PER_CM = 1 / 2.54
const POUNDS_PER_KILOGRAM = 2.2046226218

export interface ImperialHeight {
  feet: number
  inches: number
}

export function cmToFeetInches(heightCm: number): ImperialHeight {
  const totalInches = Math.max(0, Math.round(heightCm * INCHES_PER_CM))
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 }
}

export function feetInchesToCm(feet: number, inches: number): number {
  return Math.round((Math.max(0, feet) * 12 + Math.max(0, inches)) * 2.54)
}

export function convertWeight(value: number, from: Units, to: Units): number {
  if (from === to) return value
  const converted = from === 'lb' ? value / POUNDS_PER_KILOGRAM : value * POUNDS_PER_KILOGRAM
  return Math.round(converted * 10) / 10
}
