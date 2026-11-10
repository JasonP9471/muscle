import { describe, expect, it, vi } from 'vitest'
import { createNutritionApi } from './nutrition-api.js'

const identityHeaders = { 'oai-authenticated-user-id': 'test-user' }
const validAnalysis = {
  canAnalyze: true,
  reason: '',
  mealName: 'Test bowl',
  items: [{ name: 'Chicken', estimatedServing: '6 oz', calories: 280, protein: 52, carbs: 0, fat: 6, confidence: 0.8 }],
  total: { calories: 1, protein: 1, carbs: 1, fat: 1 },
  confidence: 0.78,
  disclaimer: 'Review this estimate before saving.',
}

function request(method = 'POST', body = { kind: 'photo', imageDataUrl: 'data:image/jpeg;base64,/9j/' }) {
  return new Request('https://trainos.test/api/analyze-nutrition', {
    method,
    headers: { ...identityHeaders, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

function providerFetch(output = validAnalysis) {
  return vi.fn(async () => new Response(JSON.stringify({
    output: [{ content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }))
}

function durableRateLimitDb() {
  const buckets = new Map()
  return {
    prepare() {
      return {
        bind(identityHash, timestamp, resetAt, blockedSentinel) {
          return {
            async first() {
              const existing = buckets.get(identityHash)
              const next = !existing || existing.resetAt <= timestamp
                ? { requestCount: 1, resetAt }
                : { requestCount: Math.min(blockedSentinel, existing.requestCount + 1), resetAt: existing.resetAt }
              buckets.set(identityHash, next)
              return { request_count: next.requestCount, reset_at: next.resetAt }
            },
          }
        },
      }
    },
  }
}

function environment(overrides = {}) {
  return { OPENAI_API_KEY: 'test-only-key', DB: durableRateLimitDb(), ...overrides }
}

describe('Sites nutrition analysis worker route', () => {
  it('requires an authenticated Sites or Supabase user', async () => {
    const fetchImpl = vi.fn()
    const handle = createNutritionApi({ fetchImpl })
    const response = await handle(new Request('https://trainos.test/api/analyze-nutrition'), { OPENAI_API_KEY: 'test-only-key' })

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'authentication_required' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports an honest unavailable state when the provider secret is absent', async () => {
    const handle = createNutritionApi({ fetchImpl: vi.fn() })

    const status = await handle(request('GET'), {})
    const analysis = await handle(request(), {})

    expect(await status.json()).toEqual({
      available: false,
      code: 'provider_unavailable',
      message: 'Meal photo analysis is unavailable right now. Log food manually instead.',
    })
    expect(analysis.status).toBe(503)
    expect(await analysis.json()).toMatchObject({ code: 'provider_unavailable' })
  })

  it('accepts the project-specific hosted secret name without exposing it', async () => {
    const fetchImpl = providerFetch()
    const handle = createNutritionApi({ fetchImpl })
    const status = await handle(request('GET'), { FoodKey: 'hosted-test-key' })
    const response = await handle(request(), { FoodKey: 'hosted-test-key', DB: durableRateLimitDb() })

    expect(await status.json()).toMatchObject({ available: true, code: 'ready' })
    expect(response.status).toBe(200)
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer hosted-test-key')
  })

  it('rejects malformed images before calling the provider', async () => {
    const fetchImpl = providerFetch()
    const handle = createNutritionApi({ fetchImpl })
    const response = await handle(request('POST', { kind: 'photo', imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }), environment())

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'invalid_request' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('validates provider output and recalculates totals server-side', async () => {
    const fetchImpl = providerFetch()
    const handle = createNutritionApi({ fetchImpl })
    const response = await handle(request(), environment())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ mealName: 'Test bowl', total: { calories: 280, protein: 52, carbs: 0, fat: 6 } })
    expect(payload).not.toHaveProperty('canAnalyze')
    const providerRequest = fetchImpl.mock.calls[0][1]
    expect(providerRequest.headers.Authorization).toBe('Bearer test-only-key')
    expect(providerRequest.body).toContain('json_schema')
  })

  it('rejects invalid structured output instead of returning invented food data', async () => {
    const handle = createNutritionApi({ fetchImpl: providerFetch({ ...validAnalysis, items: [{ name: 'Mystery' }] }) })
    const response = await handle(request(), environment())

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ code: 'invalid_provider_response' })
  })

  it('returns an explicit un-analyzable state for non-meal or unclear images', async () => {
    const handle = createNutritionApi({ fetchImpl: providerFetch({
      canAnalyze: false, reason: 'No food is visible.', mealName: '', items: [],
      total: { calories: 0, protein: 0, carbs: 0, fat: 0 }, confidence: 0, disclaimer: 'No estimate available.',
    }) })
    const response = await handle(request(), environment())

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ code: 'image_not_analyzable', message: 'No food is visible.' })
  })

  it('rate limits each authenticated identity across fresh Worker handlers', async () => {
    const fetchImpl = providerFetch()
    const database = durableRateLimitDb()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const restartedHandler = createNutritionApi({ fetchImpl, now: () => 1_000 })
      expect((await restartedHandler(request(), { OPENAI_API_KEY: 'test-only-key', DB: database })).status).toBe(200)
    }

    const restartedHandler = createNutritionApi({ fetchImpl, now: () => 1_000 })
    const limited = await restartedHandler(request(), { OPENAI_API_KEY: 'test-only-key', DB: database })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('600')
    expect(await limited.json()).toMatchObject({ code: 'rate_limited' })
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('fails closed when durable rate-limit storage is unavailable', async () => {
    const fetchImpl = providerFetch()
    const handle = createNutritionApi({ fetchImpl })
    const response = await handle(request(), { OPENAI_API_KEY: 'test-only-key' })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: 'rate_limit_unavailable' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
