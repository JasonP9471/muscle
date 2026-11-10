import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Database, Download, Dumbbell, Laptop, Moon, Plus, RotateCcw, Save, Scale, Sun, Upload, UserRound, X } from 'lucide-react'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { HeightField } from '../components/HeightField'
import { PageHeader } from '../components/PageHeader'
import { LoadingState } from '../components/States'
import { EQUIPMENT } from '../constants/equipment'
import { EXERCISE_BY_ID } from '../data/exercises'
import { downloadBackup, exportAllData, importBackup } from '../db/backup'
import { db } from '../db/database'
import { resetDatabase } from '../db/initialize'
import { usePageTitle } from '../hooks/usePageTitle'
import { loadDemoData } from '../services/demo'
import { isNativeApp, requestRestNotificationPermission } from '../services/mobile'
import { useUIStore } from '../stores/uiStore'
import { ACTIVITY_LEVEL_OPTIONS, DIETARY_PREFERENCE_OPTIONS, GOAL_RATE_OPTIONS, PRIMARY_GOAL_OPTIONS, primaryGoalFromTrainingGoal, trainingGoalForPrimaryGoal } from '../config/profile'
import type { AppSettings, BodyMetric, PrimaryGoal, Profile, ThemePreference, Units } from '../types'
import { formatDate } from '../utils/format'
import { convertWeight } from '../utils/measurements'

const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export function SettingsPage() {
  usePageTitle('Settings')
  const storedProfile = useLiveQuery(() => db.profiles.get('primary'), [])
  const gym = useLiveQuery(() => db.gymProfiles.get('primary'), [])
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const exclusions = useLiveQuery(() => db.exercisePreferences.where('level').equals('exclude').toArray(), [])
  const bodyMetrics = useLiveQuery(() => db.bodyMetrics.orderBy('loggedAt').reverse().toArray(), [])
  const [metric, setMetric] = useState({ weight: '', bodyFat: '', notes: '' })
  const [confirm, setConfirm] = useState<'reset' | 'demo' | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const addToast = useUIStore((state) => state.addToast)
  if (!storedProfile || !gym || !settings || exclusions === undefined || bodyMetrics === undefined) return <LoadingState />
  const profile = storedProfile
  const saveProfile = async (updates: Partial<Profile>) => {
    const next = { ...profile, ...updates, updatedAt: new Date().toISOString() }
    await db.profiles.put(next)
  }
  const updatePrimaryGoal = async (primaryGoal: PrimaryGoal) => saveProfile({ primaryGoal, goal: trainingGoalForPrimaryGoal(primaryGoal) })
  const updateUnits = async (units: Units) => {
    if (profile.units === units) return
    await saveProfile({
      units,
      bodyWeight: convertWeight(profile.bodyWeight, profile.units, units),
      targetWeight: profile.targetWeight === undefined ? undefined : convertWeight(profile.targetWeight, profile.units, units),
    })
  }
  const saveSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { await db.appSettings.update('primary', { [key]: value }) }
  const toggleRestNotifications = async (enabled: boolean) => {
    if (!enabled) { await saveSetting('restTimerNotificationsEnabled', false); return }
    try {
      const granted = await requestRestNotificationPermission()
      await saveSetting('restTimerNotificationsEnabled', granted)
      addToast(granted ? 'Rest timer alerts enabled.' : 'Notification access was not granted.', granted ? 'success' : 'error')
    } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to enable notifications.', 'error') }
  }
  const toggleEquipment = async (item: string) => {
    const equipment = gym.equipment.includes(item) ? gym.equipment.filter((value) => value !== item) : [...gym.equipment, item]
    if (equipment.length === 0) { addToast('Keep at least one equipment option selected.', 'error'); return }
    await db.gymProfiles.update('primary', { equipment, updatedAt: new Date().toISOString() })
  }
  const exportData = async () => { downloadBackup(await exportAllData()); addToast('Backup downloaded.', 'success') }
  const handleImport = async (file?: File) => {
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const preImport = await importBackup(parsed)
      downloadBackup(preImport, 'trainos-pre-import')
      addToast('Backup imported. A pre-import safety copy was also downloaded.', 'success')
      window.setTimeout(() => window.location.reload(), 700)
    } catch (error) { addToast(error instanceof Error ? error.message : 'Could not import that file.', 'error') }
    if (fileInput.current) fileInput.current.value = ''
  }
  const addMetric = async () => {
    if (!metric.weight && !metric.bodyFat) { addToast('Enter weight or body fat before saving.', 'error'); return }
    const entry: BodyMetric = { id: crypto.randomUUID(), loggedAt: new Date().toISOString(), weight: metric.weight ? Number(metric.weight) : undefined, bodyFatPercentage: metric.bodyFat ? Number(metric.bodyFat) : undefined, notes: metric.notes }
    await db.bodyMetrics.put(entry); setMetric({ weight:'',bodyFat:'',notes:'' }); addToast('Body metric logged.', 'success')
  }
  return <main className="page settings-page"><PageHeader eyebrow="Make TrainOS yours" title="Settings" description="Tune training, equipment, appearance, and your private local data." />
    <div className="settings-layout"><nav className="settings-jump" aria-label="Settings sections">{[['profile','Profile'],['training','Training'],['equipment','Equipment'],['preferences','Workout preferences'],['appearance','Appearance'],['metrics','Body metrics'],['data','Data']].map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}</nav><div className="settings-sections">
      <section className="settings-card" id="profile"><header><span><UserRound /></span><div><h2>Profile</h2><p>Personal details used for units and programming context.</p></div></header><div className="form-grid two"><label className="field full"><span>Name</span><input value={profile.name} onChange={(event)=>void saveProfile({name:event.target.value})}/></label><label className="field"><span>Age</span><input type="number" min="13" max="100" value={profile.age} onChange={(event)=>void saveProfile({age:Number(event.target.value)})}/></label><label className="field"><span>Experience</span><select value={profile.experienceLevel} onChange={(event)=>void saveProfile({experienceLevel:event.target.value as Profile['experienceLevel']})}><option>beginner</option><option>intermediate</option><option>advanced</option></select></label><HeightField heightCm={profile.height} units={profile.units} onChange={(height)=>void saveProfile({height})}/><label className="field"><span>Body weight ({profile.units})</span><input type="number" step="0.1" value={profile.bodyWeight} onChange={(event)=>void saveProfile({bodyWeight:Number(event.target.value)})}/></label></div><div className="segmented"><button className={profile.units==='lb'?'selected':''} aria-pressed={profile.units==='lb'} onClick={()=>void updateUnits('lb')}>Pounds</button><button className={profile.units==='kg'?'selected':''} aria-pressed={profile.units==='kg'} onClick={()=>void updateUnits('kg')}>Kilograms</button></div></section>
      <section className="settings-card" id="training"><header><span><Dumbbell /></span><div><h2>Training & nutrition direction</h2><p>The same goal and lifestyle choices used during onboarding.</p></div></header><div className="form-grid two"><label className="field"><span>Primary goal</span><select value={profile.primaryGoal ?? primaryGoalFromTrainingGoal(profile.goal)} onChange={(event)=>void updatePrimaryGoal(event.target.value as PrimaryGoal)}>{PRIMARY_GOAL_OPTIONS.map(({value,label})=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Goal rate</span><select value={profile.goalRate ?? 'moderate'} onChange={(event)=>void saveProfile({goalRate:event.target.value as Profile['goalRate']})}>{GOAL_RATE_OPTIONS.map(({value,label})=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Daily activity</span><select value={profile.activityLevel ?? 'moderate'} onChange={(event)=>void saveProfile({activityLevel:event.target.value as Profile['activityLevel']})}>{ACTIVITY_LEVEL_OPTIONS.map(({value,label})=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Diet preference</span><select value={profile.dietaryPreference ?? 'high_protein'} onChange={(event)=>void saveProfile({dietaryPreference:event.target.value as Profile['dietaryPreference']})}>{DIETARY_PREFERENCE_OPTIONS.map(({value,label})=><option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Training split</span><select value={profile.split} onChange={(event)=>void saveProfile({split:event.target.value as Profile['split']})}><option>Full Body</option><option>Upper / Lower</option><option>Push / Pull / Legs</option><option>Push / Pull / Legs x2</option><option>Custom</option></select></label><label className="field"><span>Workouts per week</span><select value={profile.workoutsPerWeek} onChange={(event)=>void saveProfile({workoutsPerWeek:Number(event.target.value)})}>{[1,2,3,4,5,6,7].map((value)=><option key={value}>{value}</option>)}</select></label><label className="field"><span>Session duration</span><select value={profile.sessionDuration} onChange={(event)=>void saveProfile({sessionDuration:Number(event.target.value) as Profile['sessionDuration']})}>{[15,30,45,60,75,90].map((value)=><option key={value} value={value}>{value} minutes</option>)}</select></label></div><fieldset className="day-picker"><legend>Preferred training days</legend>{days.map((day,index)=><button key={day} className={profile.workoutDays.includes(index)?'selected':''} aria-pressed={profile.workoutDays.includes(index)} onClick={()=>void saveProfile({workoutDays:profile.workoutDays.includes(index)?profile.workoutDays.filter((value)=>value!==index):[...profile.workoutDays,index].sort()})}>{day}</button>)}</fieldset><div className="form-grid two"><label className="field"><span>Recovery approach</span><select value={settings.recoveryAggressiveness} onChange={(event)=>void saveSetting('recoveryAggressiveness',event.target.value as AppSettings['recoveryAggressiveness'])}><option>conservative</option><option>balanced</option><option>aggressive</option></select></label><label className="field"><span>Exercise variability</span><select value={settings.varietyPreference} onChange={(event)=>void saveSetting('varietyPreference',event.target.value as AppSettings['varietyPreference'])}><option>low</option><option>balanced</option><option>high</option></select></label></div></section>
      <section className="settings-card" id="equipment"><header><span><Dumbbell /></span><div><h2>Equipment</h2><p>{gym.equipment.length} options selected. Generated workouts always respect this list.</p></div></header><div className="equipment-grid">{EQUIPMENT.map((item)=><button key={item} className={gym.equipment.includes(item)?'selected':''} aria-pressed={gym.equipment.includes(item)} onClick={()=>void toggleEquipment(item)}>{gym.equipment.includes(item)&&<Check/>}{item}</button>)}</div></section>
      <section className="settings-card" id="preferences"><header><span><Save /></span><div><h2>Workout preferences</h2><p>Session features and rest timer behavior.</p></div></header><div className="toggle-list">{([['warmupEnabled','Include warm-up'],['cooldownEnabled','Include cooldown'],['supersetsAllowed','Allow compatible supersets'],['cardioFinishersAllowed','Allow cardio finishers'],['restTimerEnabled','Start rest timer after sets'],['soundsEnabled','Rest timer sound'],['vibrationEnabled','Vibrate when rest ends']] as const).map(([key,label])=><label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={settings[key]} onChange={(event)=>void saveSetting(key,event.target.checked)}/></label>)}{isNativeApp&&<label className="toggle-row"><span>Lock-screen rest alerts <small>Optional; works when the app is backgrounded</small></span><input type="checkbox" checked={Boolean(settings.restTimerNotificationsEnabled)} onChange={(event)=>void toggleRestNotifications(event.target.checked)}/></label>}</div></section>
      <section className="settings-card" id="appearance"><header><span><Moon /></span><div><h2>Appearance</h2><p>Use the system setting or choose a theme.</p></div></header><div className="theme-options">{([['system',Laptop],['light',Sun],['dark',Moon]] as const).map(([theme,Icon])=><button key={theme} className={settings.theme===theme?'selected':''} onClick={()=>void saveSetting('theme',theme as ThemePreference)}><Icon/><span>{theme}</span>{settings.theme===theme&&<Check/>}</button>)}</div></section>
      <section className="settings-card" id="metrics"><header><span><Scale /></span><div><h2>Body metrics</h2><p>Optional private logs for trend context. TrainOS does not diagnose or interpret them medically.</p></div></header><div className="metric-entry"><label className="field"><span>Weight ({profile.units})</span><input type="number" step="0.1" value={metric.weight} onChange={(event)=>setMetric({...metric,weight:event.target.value})}/></label><label className="field"><span>Body fat %</span><input type="number" step="0.1" min="1" max="70" value={metric.bodyFat} onChange={(event)=>setMetric({...metric,bodyFat:event.target.value})}/></label><label className="field wide"><span>Notes</span><input value={metric.notes} onChange={(event)=>setMetric({...metric,notes:event.target.value})} placeholder="Optional context"/></label><button className="button primary" onClick={()=>void addMetric()}><Plus/> Log metric</button></div>{bodyMetrics.length>0&&<div className="metric-history">{bodyMetrics.slice(0,6).map((entry)=><div key={entry.id}><span><strong>{formatDate(entry.loggedAt)}</strong><small>{entry.notes||'No note'}</small></span><b>{entry.weight?`${entry.weight} ${profile.units}`:''}{entry.weight&&entry.bodyFatPercentage?' · ':''}{entry.bodyFatPercentage?`${entry.bodyFatPercentage}%`:''}</b><button className="icon-button" aria-label={`Delete body metric from ${formatDate(entry.loggedAt)}`} onClick={()=>void db.bodyMetrics.delete(entry.id)}><X/></button></div>)}</div>}</section>
      {exclusions.length>0&&<section className="settings-card"><header><span><X /></span><div><h2>Excluded exercises</h2><p>These movements never appear automatically.</p></div></header><div className="excluded-list">{exclusions.map((item)=><div key={item.exerciseId}><span>{EXERCISE_BY_ID.get(item.exerciseId)?.name??item.exerciseId}</span><button onClick={()=>void db.exercisePreferences.put({...item,level:'neutral',updatedAt:new Date().toISOString()})}>Remove exclusion</button></div>)}</div></section>}
      <section className="settings-card" id="data"><header><span><Database /></span><div><h2>Your data</h2><p>Export, import, demonstrate, or reset this device's local TrainOS database.</p></div></header><div className="data-actions"><button className="button secondary" onClick={()=>void exportData()}><Download/> Export all data</button><button className="button secondary" onClick={()=>fileInput.current?.click()}><Upload/> Import backup</button><input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event)=>void handleImport(event.target.files?.[0])}/><button className="button secondary" onClick={()=>setConfirm('demo')}><Database/> Load demo data</button><button className="button danger" onClick={()=>setConfirm('reset')}><RotateCcw/> Reset TrainOS</button></div><p className="privacy-note">TrainOS is local-first and contains no trackers or advertising SDKs. Data leaves this browser only when you explicitly enable the documented Supabase sync, private photo storage, or reviewed AI nutrition features.</p></section>
    </div></div>
    <ConfirmationDialog open={confirm==='demo'} title="Replace history with demo data?" message="This creates 15 realistic sessions to demonstrate charts, recovery, records, and progression. Your profile and settings stay intact." confirmLabel="Load demo data" onCancel={()=>setConfirm(null)} onConfirm={async()=>{await loadDemoData();setConfirm(null);addToast('Demo history loaded.','success')}}/>
    <ConfirmationDialog open={confirm==='reset'} title="Reset all TrainOS data?" message="Your profile, workout history, templates, metrics, settings, and active workout will be permanently removed from this device." confirmLabel="Reset everything" danger onCancel={()=>setConfirm(null)} onConfirm={async()=>{await resetDatabase();window.location.assign(`${import.meta.env.BASE_URL}onboarding`)}}/>
  </main>
}
