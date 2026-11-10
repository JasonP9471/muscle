import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('../auth/provider', () => ({ authProvider: { getSession: mocks.getSession } }))

import { analyzeNutritionPhoto, getNutritionAnalysisAvailability } from '.'

const session = {
  accessToken: 'test-access-token', user: { id: 'test-user', email: 'test@trainos.invalid' }, demo: false,
}

describe('nutrition analysis client', () => {
  beforeEach(() => mocks.getSession.mockResolvedValue(session))
  afterEach(() => vi.unstubAllGlobals())

  it('does not convert a failed photo request into deterministic chicken data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 'provider_unavailable', message: 'Meal photo analysis is unavailable right now. Log food manually instead.',
    }), { status: 503, headers: { 'content-type': 'application/json' } })))

    await expect(analyzeNutritionPhoto(new File(['photo'], 'meal.jpg', { type: 'image/jpeg' })))
      .rejects.toThrow('Meal photo analysis is unavailable right now')
  })

  it('reports provider availability without exposing configuration details', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      available: true, code: 'ready', message: 'Nutrition analysis is available.',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNutritionAnalysisAvailability()).resolves.toEqual({ available: true, message: 'Nutrition analysis is available.' })
    expect(fetchMock).toHaveBeenCalledWith('/api/analyze-nutrition', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-access-token' }),
    }))
  })

  it('disables analysis when no authenticated account session exists', async () => {
    mocks.getSession.mockResolvedValue(null)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNutritionAnalysisAvailability()).resolves.toEqual({ available: false, message: 'Sign in to use meal photo analysis.' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
