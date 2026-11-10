import { describe, expect, it } from 'vitest'
import { decodeMuscleOSImport } from '.'

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

describe('Muscle OS profile import', () => {
  it('maps a compact private profile payload into TrainOS fields and gym profiles', () => {
    const imported = decodeMuscleOSImport(encode({
      v: 1,
      p: { n: 'Jason Perry', a: 32, s: 'male', h: 188, w: 190, tw: 215, u: 'lb', x: 'intermediate', pg: 'build_muscle', gr: 'moderate', al: 'very_active', dp: 'high_protein', sp: 'Push / Pull / Legs', d: 6, m: 60, l: '' },
      g: ['commercial_gym', 'bodyweight_only'],
      r: 1800,
    }))

    expect(imported.profile).toMatchObject({ name: 'Jason Perry', age: 32, bodyWeight: 190, targetWeight: 215, workoutsPerWeek: 6 })
    expect(imported.gyms[0]).toMatchObject({ id: 'primary', name: 'Local gym' })
    expect(imported.gyms[0].equipment).toContain('squat rack')
    expect(imported.gyms[1]).toEqual({ id: 'muscle-os-bodyweight_only-1', name: 'Apartment', equipment: ['bodyweight'] })
    expect(imported.reportedRestingCalories).toBe(1800)
  })

  it('rejects malformed or unsupported payloads', () => {
    expect(() => decodeMuscleOSImport(encode({ v: 2, p: {}, g: [] }))).toThrow()
    expect(() => decodeMuscleOSImport('not-valid-base64')).toThrow()
  })
})
