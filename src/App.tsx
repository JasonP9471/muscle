import { lazy, Suspense, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoadingState } from './components/States'
import { ToastRegion } from './components/ToastRegion'
import { db } from './db/database'
import { initializeDatabase } from './db/initialize'
import { AppLayout } from './layouts/AppLayout'
import { authProvider, isLocalOnlyMode } from './services/auth/provider'
import { cloudSyncAvailable, queueLocalSnapshot, syncLocalSnapshot } from './services/sync/provider'
import { setNativeChrome } from './services/mobile'
import { useUIStore } from './stores/uiStore'

const ActiveWorkoutPage = lazy(() => import('./pages/ActiveWorkoutPage').then((module) => ({ default: module.ActiveWorkoutPage })))
const ExerciseDetailPage = lazy(() => import('./pages/ExerciseDetailPage').then((module) => ({ default: module.ExerciseDetailPage })))
const ExercisesPage = lazy(() => import('./pages/ExercisesPage').then((module) => ({ default: module.ExercisesPage })))
const HistoryDetailPage = lazy(() => import('./pages/HistoryDetailPage').then((module) => ({ default: module.HistoryDetailPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const NutritionPage = lazy(() => import('./pages/NutritionPage').then((module) => ({ default: module.NutritionPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const ProgressPage = lazy(() => import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })))
const RecoveryDetailPage = lazy(() => import('./pages/RecoveryDetailPage').then((module) => ({ default: module.RecoveryDetailPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const TodayPage = lazy(() => import('./pages/TodayPage').then((module) => ({ default: module.TodayPage })))
const TrainPage = lazy(() => import('./pages/TrainPage').then((module) => ({ default: module.TrainPage })))
const WorkoutCompletePage = lazy(() => import('./pages/WorkoutCompletePage').then((module) => ({ default: module.WorkoutCompletePage })))

function ApplicationRoutes() {
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const [authChecked, setAuthChecked] = useState(false)
  const [accountReady, setAccountReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [localOnly] = useState(() => isLocalOnlyMode())
  const addToast = useUIStore((state) => state.addToast)
  const isPasswordRecovery = new URLSearchParams(window.location.search).get('recovery') === 'true'
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const session = await authProvider.getSession()
        if (!active) return
        setHasSession(!!session)
        setAuthChecked(true)
        if (session && cloudSyncAvailable) {
          try { await syncLocalSnapshot() }
          catch (error) {
            if (navigator.onLine) addToast(error instanceof Error ? error.message : 'Account sync could not finish.', 'error')
          }
        }
      } catch (error) {
        if (active) addToast(error instanceof Error ? error.message : 'TrainOS could not verify your account session.', 'error')
      } finally {
        if (active) { setAuthChecked(true); setAccountReady(true) }
      }
    })()
    return () => { active = false }
  }, [addToast])
  useEffect(() => {
    if (!settings) return
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0d0f' : '#f3f5f2')
    void setNativeChrome(theme)
  }, [settings])
  useEffect(() => {
    if (!hasSession || !settings?.cloudSyncEnabled || !cloudSyncAvailable) return
    const sync = () => { void syncLocalSnapshot().catch(() => undefined) }
    const capture = () => { void queueLocalSnapshot('app-backgrounded').catch(() => undefined) }
    const syncWhenVisible = () => { if (document.visibilityState === 'visible') sync(); else capture() }
    const interval = window.setInterval(sync, 45_000)
    window.addEventListener('online', sync)
    window.addEventListener('offline', capture)
    window.addEventListener('pagehide', capture)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', capture)
      window.removeEventListener('pagehide', capture)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [hasSession, settings?.cloudSyncEnabled])
  if (!settings || !authChecked || !accountReady) return <LoadingState label="Preparing TrainOS…" />
  if (authProvider.mode === 'supabase' && !hasSession && !localOnly) return <Suspense fallback={<LoadingState label="Loading account…" />}><Routes><Route path="/auth" element={<AuthPage />} /><Route path="*" element={<Navigate to="/auth" replace />} /></Routes></Suspense>
  return <Suspense fallback={<LoadingState label="Loading TrainOS…" />}><Routes>
    <Route path="/auth" element={hasSession && !isPasswordRecovery ? <Navigate to={settings.onboardingComplete ? '/today' : '/onboarding'} replace /> : <AuthPage />} />
    <Route path="/onboarding" element={settings.onboardingComplete ? <Navigate to="/today" replace /> : <OnboardingPage />} />
    <Route path="/workout/active" element={settings.onboardingComplete ? <ActiveWorkoutPage /> : <Navigate to="/onboarding" replace />} />
    <Route path="/workout/complete/:workoutId" element={settings.onboardingComplete ? <WorkoutCompletePage /> : <Navigate to="/onboarding" replace />} />
    <Route element={settings.onboardingComplete ? <AppLayout /> : <Navigate to="/onboarding" replace />}>
      <Route path="/today" element={<TodayPage />} />
      <Route path="/train" element={<TrainPage />} />
      <Route path="/nutrition" element={<NutritionPage />} />
      <Route path="/progress" element={<ProgressPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/exercises" element={<ExercisesPage />} />
      <Route path="/exercises/:exerciseId" element={<ExerciseDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:workoutId" element={<HistoryDetailPage />} />
      <Route path="/recovery/:muscle" element={<RecoveryDetailPage />} />
    </Route>
    <Route path="*" element={<Navigate to={settings.onboardingComplete ? '/today' : '/onboarding'} replace />} />
  </Routes></Suspense>
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => { initializeDatabase().then(() => setReady(true)).catch((reason: unknown) => setError(reason instanceof Error ? reason : new Error('Database initialization failed.'))) }, [])
  if (error) throw error
  if (!ready) return <LoadingState label="Preparing your private training database…" />
  return <ErrorBoundary><ApplicationRoutes /><ToastRegion /></ErrorBoundary>
}
