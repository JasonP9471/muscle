import { describe, expect, it } from 'vitest'
import { calculatePlateLoad, generateWarmupSets } from '.'

describe('plate loading', () => {
  it('calculates the plates required on each side for a standard bar', () => {
    expect(calculatePlateLoad(225, 'lb')).toMatchObject({
      loadedWeight: 225,
      remainder: 0,
      perSide: [{ plate: 45, count: 2 }],
    })
  })

  it('reports the nearest load without overstating an unavailable target', () => {
    expect(calculatePlateLoad(137, 'lb')).toMatchObject({ loadedWeight: 135, remainder: 2 })
    expect(calculatePlateLoad(100, 'kg')).toMatchObject({ loadedWeight: 100, remainder: 0 })
  })
})

describe('warm-up generation', () => {
  it('creates ascending, unique loads below the working weight', () => {
    const sets = generateWarmupSets(225, 'lb')
    expect(sets).toHaveLength(4)
    expect(sets.every((set) => set.isWarmup && (set.weight ?? 0) < 225)).toBe(true)
    expect(sets.map((set) => set.weight)).toEqual([...sets.map((set) => set.weight)].sort((a, b) => (a ?? 0) - (b ?? 0)))
  })

  it('deduplicates warm-ups for lighter working weights', () => {
    const sets = generateWarmupSets(30, 'kg')
    expect(new Set(sets.map((set) => set.weight)).size).toBe(sets.length)
    expect(sets.every((set) => (set.weight ?? 0) < 30)).toBe(true)
  })
})
