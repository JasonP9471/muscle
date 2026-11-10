import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, Check, CheckCircle2, Cloud, CloudOff, Database, Dumbbell, LogIn, LogOut, Moon, Plus, RefreshCw, Save, ShieldCheck, Sun, UserRound, WifiOff, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { LoadingState } from '../components/States'
import { EQUIPMENT } from '../constants/equipment'
import { db } from '../db/database'
import { authProvider, type AuthSession } from '../services/auth/provider'
import { cloudSyncAvailable, syncLocalSnapshot } from '../services/sync/provider'
import { usePageTitle } from '../hooks/usePageTitle'
import { useUIStore } from '../stores/uiStore'
import { PRIMARY_GOAL_OPTIONS, trainingGoalForPrimaryGoal } from '../config/profile'
import type { AppSettings, GymProfile, NutritionTargets, Profile, ThemePreference } from '../types'

export function ProfilePage() {
  usePageTitle('Profile')
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const targets = useLiveQuery(() => db.nutritionTargets.get('primary'), [])
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const gyms = useLiveQuery(() => db.gymProfiles.toArray(), [])
  const pendingSyncs = useLiveQuery(() => db.syncQueue.count(), [])
  const syncConflicts = useLiveQuery(() => db.syncConflicts.orderBy('resolvedAt').reverse().toArray(), [])
  const [targetEdits, setTargetEdits] = useState<Partial<NutritionTargets>>({})
  const [newGymName, setNewGymName] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [now, setNow] = useState(() => Date.now())
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  useEffect(() => {
    void authProvider.getSession()
      .then((next) => setSession(next))
      .catch(() => setSession(null))
      .finally(() => setSessionChecked(true))
  }, [])
  useEffect(() => {
    const markOnline = () => { setOnline(true); setSyncError(null) }
    const markOffline = () => setOnline(false)
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    window.addEventListener('online', markOnline)
    window.addEventListener('offline', markOffline)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', markOnline)
      window.removeEventListener('offline', markOffline)
    }
  }, [])
  if (!profile || !targets || !settings || !gyms || pendingSyncs === undefined || !syncConflicts) return <LoadingState />
  const targetDraft: NutritionTargets = { ...targets, ...targetEdits }
  const activeGymId = settings.activeGymProfileId ?? 'primary'
  const activeGym = gyms.find((gym) => gym.id === activeGymId) ?? gyms[0]
  const saveProfile = async (updates: Partial<Profile>) => { await db.profiles.update('primary', { ...updates, updatedAt: new Date().toISOString() }); addToast('Profile updated.', 'success') }
  const saveSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { await db.appSettings.update('primary', { [key]: value }) }
  const saveTargets = async () => { await db.nutritionTargets.put({ ...targetDraft, source: 'manual', updatedAt: new Date().toISOString() }); addToast('Nutrition targets updated across TrainOS.', 'success') }
  const createGym = async () => {
    if (!newGymName.trim()) { addToast('Name the equipment environment first.', 'error'); return }
    const gym: GymProfile = { id: crypto.randomUUID(), name: newGymName.trim(), equipment: ['Bodyweight'], updatedAt: new Date().toISOString() }
    await db.gymProfiles.put(gym); await saveSetting('activeGymProfileId', gym.id); setNewGymName(''); addToast(`${gym.name} is now active.`, 'success')
  }
  const toggleEquipment = async (equipment: string) => {
    if (!activeGym) return
    const next = activeGym.equipment.includes(equipment) ? activeGym.equipment.filter((item) => item !== equipment) : [...activeGym.equipment, equipment]
    if (next.length === 0) { addToast('Keep at least one equipment option selected.', 'error'); return }
    await db.gymProfiles.update(activeGym.id, { equipment: next, updatedAt: new Date().toISOString() })
  }
  const syncNow = async () => {
    setSyncError(null)
    setSyncing(true)
    try {
      const summary = await syncLocalSnapshot()
      setNow(Date.now())
      const message = summary.direction === 'uploaded'
        ? `Synced ${summary.rows} local records to your account.`
        : summary.direction === 'downloaded'
          ? `Restored ${summary.rows} records from your account.`
          : summary.direction === 'merged'
            ? `Merged phone and desktop changes${summary.conflicts ? ` and safely resolved ${summary.conflicts} overlapping ${summary.conflicts === 1 ? 'edit' : 'edits'}` : ''}.`
            : 'This device is already up to date.'
      addToast(message, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cloud sync failed.'
      setSyncError(message)
      addToast(message, 'error')
    }
    finally { setSyncing(false) }
  }
  const logOut = async () => {
    await authProvider.signOut()
    setSession(null)
    addToast('You are logged out. Your local TrainOS data remains on this device.', 'success')
    window.location.assign('/auth')
  }
  const syncState = getSyncState({ online, session, sessionChecked, syncing, syncError, lastSyncAt: settings.lastCloudSyncAt })
  const SyncIcon = syncState.icon
  return <main className="page profile-page"><PageHeader eyebrow="Preferences & privacy" title="Profile" description="Your goals, targets, environments, account, and data controls in one place." />
    <section className="profile-summary"><span>{profile.name.slice(0,1).toUpperCase()}</span><div><h2>{profile.name}</h2><p>{PRIMARY_GOAL_OPTIONS.find(({value}) => value === (profile.primaryGoal ?? 'build_muscle'))?.label} · {profile.workoutsPerWeek} sessions/week · {profile.units}</p></div><button className="button secondary" onClick={() => navigate('/settings')}>Advanced settings</button></section>
    <div className="profile-grid">
      <section className={`settings-card profile-wide account-sync-card sync-${syncState.tone}`}><header><span><Cloud/></span><div><h2>Account & device sync</h2><p>Your TrainOS account keeps participating devices on the same data.</p></div></header>
        <div className="sync-overview">
          <div className="sync-identity"><span className="account-avatar"><UserRound/></span><span><small>{session ? 'Signed in as' : 'Account'}</small><strong>{!sessionChecked ? 'Checking your account…' : session?.user.email ?? 'Not signed in'}</strong></span></div>
          <div className={`connection-badge ${online ? 'online' : 'offline'}`}>{online ? <Cloud/> : <WifiOff/>}{online ? 'Online' : 'Offline'}</div>
        </div>
        <div className="sync-state-panel" role="status" aria-live="polite"><span className="sync-state-icon"><SyncIcon className={syncing ? 'spin' : ''}/></span><span><strong>{syncState.title}</strong><small>{syncState.detail}</small></span>{settings.lastCloudSyncAt && session && <time dateTime={settings.lastCloudSyncAt}>{formatSyncRecency(settings.lastCloudSyncAt, now)}</time>}</div>
        {pendingSyncs > 0 && <div className="sync-queue-note" role="status"><Save/><span><strong>1 change batch queued</strong><small>{online ? 'Ready to upload with the next sync.' : 'Stored safely on this device until you reconnect.'}</small></span></div>}
        {syncConflicts.length > 0 && <details className="sync-conflicts"><summary><AlertTriangle/> {syncConflicts.length} overlapping {syncConflicts.length === 1 ? 'edit was' : 'edits were'} resolved</summary><p>TrainOS merged changes to different fields. When the same field changed on both devices, the newer edit won; edited records are kept instead of deleted.</p><ul>{syncConflicts.slice(0, 8).map((conflict) => <li key={conflict.id}><strong>{formatSyncTable(conflict.table)}</strong><span>{formatConflictResolution(conflict.resolution)} · {conflict.fields.slice(0, 3).join(', ')}</span></li>)}</ul><button className="text-button" onClick={() => void db.syncConflicts.clear()}>Dismiss conflict report</button></details>}
        <div className="sync-actions">{session ? <><button className="button primary" disabled={!cloudSyncAvailable || !online || syncing} onClick={() => void syncNow()}><RefreshCw className={syncing ? 'spin' : ''}/> {syncing ? 'Syncing…' : 'Sync now'}</button><button className="button secondary" onClick={() => void logOut()}><LogOut/> Log out</button></> : <><button className="button primary" onClick={() => navigate('/auth')}><LogIn/> Log in</button><button className="button secondary" onClick={() => navigate('/auth?mode=create')}><UserRound/> Create account</button></>}</div>
        <p className="privacy-note">Changes are saved on this device first and copied to your private account when online. Muscle OS is never connected; a one-time import becomes normal TrainOS data. Phone and desktop changes are merged record by record, with overlapping edits reported here.</p>
      </section>
      <section className="settings-card profile-wide"><header><span><Dumbbell/></span><div><h2>Goal & training</h2><p>These choices tune training and nutrition together.</p></div></header><div className="choice-grid profile-goals">{PRIMARY_GOAL_OPTIONS.map(({value,label}) => <button key={value} className={(profile.primaryGoal ?? 'build_muscle') === value ? 'selected' : ''} onClick={() => void saveProfile({ primaryGoal: value, goal: trainingGoalForPrimaryGoal(value) })}>{label}</button>)}</div><div className="form-grid three"><label className="field"><span>Current weight ({profile.units})</span><input type="number" step="0.1" value={profile.bodyWeight} onChange={(event) => void saveProfile({ bodyWeight: Number(event.target.value) })}/></label><label className="field"><span>Target weight ({profile.units})</span><input type="number" step="0.1" value={profile.targetWeight ?? ''} onChange={(event) => void saveProfile({ targetWeight: event.target.value ? Number(event.target.value) : undefined })}/></label><label className="field"><span>Goal rate</span><select value={profile.goalRate ?? 'moderate'} onChange={(event) => void saveProfile({ goalRate: event.target.value as Profile['goalRate'] })}><option value="slow">Slow</option><option value="moderate">Moderate</option><option value="aggressive">Aggressive, within safe bounds</option></select></label></div></section>
      <section className="settings-card profile-wide"><header><span><Database/></span><div><h2>Nutrition targets</h2><p>Calculated numbers are estimates. Manual changes require an explicit save.</p></div></header><div className="target-editor">{(['calories','protein','carbs','fat'] as const).map((key) => <label className="field" key={key}><span>{key === 'calories' ? 'Calories' : `${key[0].toUpperCase()}${key.slice(1)} (g)`}</span><input type="number" min="0" value={targetDraft[key]} onChange={(event) => setTargetEdits({ ...targetEdits, [key]: Number(event.target.value) })}/></label>)}</div><button className="button primary" onClick={() => void saveTargets()}><Save/> Save targets</button></section>
      <section className="settings-card profile-wide"><header><span><Dumbbell/></span><div><h2>Gym profiles</h2><p>The generator strictly uses equipment from the selected environment.</p></div></header><div className="gym-tabs">{gyms.map((gym) => <button key={gym.id} className={gym.id === activeGymId ? 'selected' : ''} onClick={() => void saveSetting('activeGymProfileId', gym.id)}>{gym.name}{gym.id === activeGymId && <Check/>}</button>)}</div><div className="new-gym"><input value={newGymName} onChange={(event) => setNewGymName(event.target.value)} placeholder="Add Home, Hotel gym…" aria-label="New gym profile name"/><button className="button secondary" onClick={() => void createGym()}><Plus/> Add profile</button></div>{activeGym && <div className="equipment-grid compact-equipment">{EQUIPMENT.map((equipment) => <button type="button" key={equipment} className={activeGym.equipment.includes(equipment) ? 'selected' : ''} aria-pressed={activeGym.equipment.includes(equipment)} onClick={() => void toggleEquipment(equipment)}>{activeGym.equipment.includes(equipment) && <Check/>}{equipment}</button>)}</div>}{activeGym && activeGym.id !== 'primary' && <button className="text-button danger-text" onClick={async () => { await db.gymProfiles.delete(activeGym.id); await saveSetting('activeGymProfileId', 'primary') }}><X/> Delete {activeGym.name}</button>}</section>
      <section className="settings-card"><header><span>{settings.theme === 'light' ? <Sun/> : <Moon/>}</span><div><h2>Appearance</h2><p>Dark is polished first; light and system modes remain supported.</p></div></header><div className="segmented">{(['system','light','dark'] as ThemePreference[]).map((theme) => <button key={theme} className={settings.theme === theme ? 'selected' : ''} onClick={() => void saveSetting('theme', theme)}>{theme}</button>)}</div></section>
      <section className="settings-card"><header><span><ShieldCheck/></span><div><h2>Privacy</h2><p>Health and fitness data requires deliberate controls.</p></div></header><p className="privacy-note">Your local database remains usable offline. Optional Supabase rows and storage objects are scoped to the authenticated user by RLS. Meal and progress-photo buckets are private.</p><button className="button secondary" onClick={() => navigate('/settings#data')}>Export or delete data</button></section>
    </div>
  </main>
}

function formatSyncTable(table: string): string {
  const labels: Record<string, string> = {
    profiles: 'Profile', workouts: 'Workout', activeWorkout: 'Active workout', meals: 'Meal',
    weeklyCheckins: 'Recovery check-in', bodyMetrics: 'Progress metric', progressPhotos: 'Progress photo',
    nutritionTargets: 'Nutrition targets', muscleStates: 'Recovery state',
  }
  return labels[table] ?? table.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())
}

function formatConflictResolution(resolution: 'merged_fields' | 'kept_local' | 'kept_remote' | 'kept_existing'): string {
  if (resolution === 'merged_fields') return 'Merged both devices'
  if (resolution === 'kept_existing') return 'Kept the edited copy'
  return resolution === 'kept_local' ? 'Kept this device’s newer edit' : 'Kept the other device’s newer edit'
}

function formatSyncRecency(value: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000))
  if (elapsedSeconds < 60) return 'Synced just now'
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `Synced ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Synced ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  return `Last synced ${new Date(value).toLocaleString()}`
}

function getSyncState({ online, session, sessionChecked, syncing, syncError, lastSyncAt }: {
  online: boolean
  session: AuthSession | null
  sessionChecked: boolean
  syncing: boolean
  syncError: string | null
  lastSyncAt?: string
}): { title: string; detail: string; tone: 'success' | 'offline' | 'warning' | 'neutral'; icon: typeof Cloud } {
  if (!online) return { title: 'Offline — changes are safe', detail: 'TrainOS will sync automatically when this device reconnects.', tone: 'offline', icon: WifiOff }
  if (!sessionChecked) return { title: 'Checking sync status…', detail: 'Confirming this device and account.', tone: 'neutral', icon: Cloud }
  if (!session) return { title: 'Not syncing', detail: 'Log in to sync this profile with your other devices.', tone: 'neutral', icon: CloudOff }
  if (!cloudSyncAvailable) return { title: 'Sync unavailable', detail: 'Cloud sync is not configured for this version of TrainOS.', tone: 'warning', icon: AlertTriangle }
  if (syncing) return { title: 'Syncing now…', detail: 'Comparing this device with your private TrainOS account.', tone: 'neutral', icon: RefreshCw }
  if (syncError) return { title: 'Sync needs attention', detail: syncError, tone: 'warning', icon: AlertTriangle }
  if (lastSyncAt) return { title: 'All devices are synced', detail: 'This device and your TrainOS account matched successfully.', tone: 'success', icon: CheckCircle2 }
  return { title: 'Ready to sync', detail: 'Use Sync now to confirm this device matches your TrainOS account.', tone: 'neutral', icon: Cloud }
}
