import type { EmailOtpType, Session } from '@supabase/supabase-js'
import { cloudConfig } from '../../config/cloud'
import { supabaseClient } from '../supabase/client'

export interface AuthUser { id: string; email: string; displayName?: string }
export interface AuthSession { accessToken: string; refreshToken?: string; expiresAt?: number; user: AuthUser; demo: boolean }
export interface AuthProvider {
  mode: 'demo' | 'supabase'
  getSession(): Promise<AuthSession | null>
  signUp(email: string, password: string, displayName: string): Promise<AuthSession | null>
  signIn(email: string, password: string): Promise<AuthSession>
  forgotPassword(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  completeEmailRedirect(): Promise<AuthSession | null>
  signOut(): Promise<void>
}

export type SupabaseAuthClient = Pick<typeof supabaseClient.auth,
  'getSession' | 'signUp' | 'signInWithPassword' | 'resetPasswordForEmail' |
  'updateUser' | 'verifyOtp' | 'exchangeCodeForSession' | 'signOut'>
export type AuthLocation = Pick<Location, 'hostname' | 'origin' | 'search' | 'hash'>

const DEMO_SESSION_KEY = 'trainos-demo-auth-session-v1'
const LOCAL_ONLY_KEY = 'trainos-local-only-v1'

export function isLocalOnlyMode(): boolean {
  return localStorage.getItem(LOCAL_ONLY_KEY) === 'true'
}

export function enableLocalOnlyMode(): void {
  localStorage.setItem(LOCAL_ONLY_KEY, 'true')
}

export function disableLocalOnlyMode(): void {
  localStorage.removeItem(LOCAL_ONLY_KEY)
}

export const authProvider: AuthProvider = cloudConfig.enabled ? createSupabaseProvider() : createDemoProvider()

function createDemoProvider(): AuthProvider {
  return {
    mode: 'demo',
    async getSession() { return readDemoSession() },
    async signUp(email, _password, displayName) { const session = demoSession(email, displayName); writeDemoSession(session); return session },
    async signIn(email) { const session = demoSession(email, email.split('@')[0]); writeDemoSession(session); return session },
    async forgotPassword() { return Promise.resolve() },
    async updatePassword() { return Promise.resolve() },
    async completeEmailRedirect() { return readDemoSession() },
    async signOut() { localStorage.removeItem(DEMO_SESSION_KEY) },
  }
}

export function createSupabaseProvider(
  client: SupabaseAuthClient = supabaseClient.auth,
  location: AuthLocation = window.location,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
): AuthProvider {
  return {
    mode: 'supabase',
    async getSession() {
      const { data, error } = await client.getSession()
      if (error) throw error
      return toAuthSession(data.session)
    },
    async signUp(email, password, displayName) {
      const { data, error } = await client.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: buildAuthRedirectUrl('verified', location),
        },
      })
      if (error) throw error
      disableLocalOnlyMode()
      return toAuthSession(data.session)
    },
    async signIn(email, password) {
      const { data, error } = await client.signInWithPassword({ email, password })
      if (error) throw error
      disableLocalOnlyMode()
      const session = toAuthSession(data.session)
      if (!session) throw new Error('Sign-in succeeded but no session was returned.')
      return session
    },
    async forgotPassword(email) {
      const { error } = await client.resetPasswordForEmail(email, { redirectTo: buildAuthRedirectUrl('recovery', location) })
      if (error) throw error
    },
    async updatePassword(password) {
      const { error } = await client.updateUser({ password })
      if (error) throw error
    },
    async completeEmailRedirect() {
      const callbackError = readCallbackError(location)
      if (callbackError) throw new Error(callbackError)

      const existing = await client.getSession()
      if (existing.error) throw existing.error
      if (existing.data.session) {
        disableLocalOnlyMode()
        return toAuthSession(existing.data.session)
      }

      const params = new URLSearchParams(location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      if (tokenHash && isEmailOtpType(type)) {
        const { data, error } = await client.verifyOtp({ token_hash: tokenHash, type })
        if (error) throw error
        disableLocalOnlyMode()
        return toAuthSession(data.session)
      }

      const code = params.get('code')
      if (code) {
        const { data, error } = await client.exchangeCodeForSession(code)
        if (error) throw error
        disableLocalOnlyMode()
        return toAuthSession(data.session)
      }

      const session = await waitForDetectedSession(client, sleep)
      if (session) disableLocalOnlyMode()
      return session
    },
    async signOut() {
      const { error } = await client.signOut()
      if (error) throw error
    },
  }
}

export function buildAuthRedirectUrl(purpose: 'verified' | 'recovery', location: Pick<Location, 'hostname' | 'origin'> = window.location): string {
  const isLocalDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  const origin = isLocalDevelopment ? location.origin : cloudConfig.appUrl
  const url = new URL('/auth', origin)
  url.searchParams.set(purpose, 'true')
  return url.toString()
}

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value === 'email' || value === 'signup' || value === 'invite' || value === 'magiclink' || value === 'recovery' || value === 'email_change' || value === 'reauthentication'
}

function readCallbackError(location: Pick<AuthLocation, 'hash' | 'search'>): string | null {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(location.search)
  return hash.get('error_description') ?? query.get('error_description')
}

async function waitForDetectedSession(client: SupabaseAuthClient, sleep: (milliseconds: number) => Promise<void>): Promise<AuthSession | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(200)
    const { data, error } = await client.getSession()
    if (error) throw error
    if (data.session) return toAuthSession(data.session)
  }
  return null
}

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session?.user.email) return null
  const displayName = session.user.user_metadata.display_name
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: typeof displayName === 'string' ? displayName : undefined,
    },
    demo: false,
  }
}

function demoSession(email: string, displayName: string): AuthSession {
  return { accessToken: 'demo-session', user: { id: 'demo-user', email, displayName }, demo: true }
}

function readDemoSession(): AuthSession | null {
  try { const raw = localStorage.getItem(DEMO_SESSION_KEY); return raw ? JSON.parse(raw) as AuthSession : null } catch { return null }
}

function writeDemoSession(session: AuthSession): void {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session))
}
