import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthRedirectUrl, createSupabaseProvider, type AuthLocation, type SupabaseAuthClient,
} from './provider'

const productionLocation: AuthLocation = {
  hostname: 'trainos-pilot.jayp94.chatgpt.site',
  origin: 'https://trainos-pilot.jayp94.chatgpt.site',
  search: '',
  hash: '',
}

function session(token = 'access-1'): Session {
  return {
    access_token: token,
    refresh_token: `refresh-${token}`,
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: 'bearer',
    user: {
      id: 'user-a',
      app_metadata: {},
      user_metadata: { display_name: 'Test Athlete' },
      aud: 'authenticated',
      created_at: '2026-10-27T00:00:00.000Z',
      email: 'athlete-a@trainos.test',
    },
  }
}

function fakeClient(initialSession: Session | null = null) {
  let currentSession = initialSession
  const client = {
    getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    signInWithPassword: vi.fn(async () => {
      currentSession = session()
      return { data: { session: currentSession, user: currentSession.user }, error: null }
    }),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: currentSession?.user ?? null }, error: null })),
    verifyOtp: vi.fn(async () => {
      currentSession = session('confirmed')
      return { data: { session: currentSession, user: currentSession.user }, error: null }
    }),
    exchangeCodeForSession: vi.fn(async () => {
      currentSession = session('pkce')
      return { data: { session: currentSession, user: currentSession.user }, error: null }
    }),
    signOut: vi.fn(async () => {
      currentSession = null
      return { error: null }
    }),
    rotate(next: Session) { currentSession = next },
  }
  return { client: client as unknown as SupabaseAuthClient, spies: client }
}

describe('TrainOS auth redirects', () => {
  beforeEach(() => localStorage.clear())

  it('always uses the canonical TrainOS site for production signups', () => {
    const result = buildAuthRedirectUrl('verified', {
      hostname: 'muscle-os.example.com',
      origin: 'https://muscle-os.example.com',
    })

    expect(result).toBe('https://trainos-pilot.jayp94.chatgpt.site/auth?verified=true')
  })

  it('keeps local development callbacks on localhost', () => {
    const result = buildAuthRedirectUrl('recovery', {
      hostname: 'localhost',
      origin: 'http://localhost:5175',
    })

    expect(result).toBe('http://localhost:5175/auth?recovery=true')
  })

  it('requests email confirmation and completes token-hash signup links', async () => {
    const fake = fakeClient()
    const provider = createSupabaseProvider(fake.client, productionLocation)

    await expect(provider.signUp('athlete-a@trainos.test', 'safe-password', 'Test Athlete')).resolves.toBeNull()
    expect(fake.spies.signUp).toHaveBeenCalledWith(expect.objectContaining({
      options: expect.objectContaining({
        emailRedirectTo: 'https://trainos-pilot.jayp94.chatgpt.site/auth?verified=true',
      }),
    }))

    const callbackProvider = createSupabaseProvider(fake.client, {
      ...productionLocation,
      search: '?token_hash=confirmation-token&type=signup',
    })
    await expect(callbackProvider.completeEmailRedirect()).resolves.toMatchObject({
      accessToken: 'confirmed',
      user: { id: 'user-a', email: 'athlete-a@trainos.test' },
    })
    expect(fake.spies.verifyOtp).toHaveBeenCalledWith({ token_hash: 'confirmation-token', type: 'signup' })
  })

  it('persists login across provider recreation and observes a refreshed session', async () => {
    const fake = fakeClient()
    const firstDeviceLoad = createSupabaseProvider(fake.client, productionLocation)
    await expect(firstDeviceLoad.signIn('athlete-a@trainos.test', 'safe-password')).resolves.toMatchObject({ accessToken: 'access-1' })

    fake.spies.rotate(session('access-2'))
    const refreshedPageLoad = createSupabaseProvider(fake.client, productionLocation)
    await expect(refreshedPageLoad.getSession()).resolves.toMatchObject({ accessToken: 'access-2' })
  })

  it('logs out and removes the persisted session', async () => {
    const fake = fakeClient(session())
    const provider = createSupabaseProvider(fake.client, productionLocation)

    await provider.signOut()

    await expect(provider.getSession()).resolves.toBeNull()
    expect(fake.spies.signOut).toHaveBeenCalledOnce()
  })

  it('sends recovery links back to TrainOS, exchanges the code, and updates the password', async () => {
    const fake = fakeClient()
    const provider = createSupabaseProvider(fake.client, productionLocation)
    await provider.forgotPassword('athlete-a@trainos.test')
    expect(fake.spies.resetPasswordForEmail).toHaveBeenCalledWith('athlete-a@trainos.test', {
      redirectTo: 'https://trainos-pilot.jayp94.chatgpt.site/auth?recovery=true',
    })

    const callbackProvider = createSupabaseProvider(fake.client, {
      ...productionLocation,
      search: '?recovery=true&code=recovery-code',
    })
    await expect(callbackProvider.completeEmailRedirect()).resolves.toMatchObject({ accessToken: 'pkce' })
    await callbackProvider.updatePassword('new-safe-password')
    expect(fake.spies.updateUser).toHaveBeenCalledWith({ password: 'new-safe-password' })
  })
})
