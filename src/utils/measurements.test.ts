import { describe, expect, it } from 'vitest'
import { cmToFeetInches, convertWeight, feetInchesToCm } from './measurements'

describe('measurement conversions', () => {
  it('presents canonical centimetres as feet and inches', () => {
    expect(cmToFeetInches(175)).toEqual({ feet: 5, inches: 9 })
    expect(feetInchesToCm(5, 9)).toBe(175)
  })

  it('converts weight when the preferred unit changes', () => {
    expect(convertWeight(165, 'lb', 'kg')).toBe(74.8)
    expect(convertWeight(74.8, 'kg', 'lb')).toBe(164.9)
  })
})
