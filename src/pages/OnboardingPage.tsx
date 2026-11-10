import { useEffect, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, Check, Dumbbell, LogIn, ShieldCheck, Timer, WandSparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EQUIPMENT, DEFAULT_EQUIPMENT } from '../constants/equipment'
import { db } from '../db/database'
import { DEFAULT_SETTINGS } from '../db/initialize'
import { authProvider, disableLocalOnlyMode } from '../services/auth/provider'
import { generateAndSaveWorkout } from '../services/generation'
import { decodeMuscleOSImport, type MuscleOSImport } from '../services/muscleOsImport'
import { calculateNutritionTargets } from '../algorithms/nutrition'
import { ACTIVITY_LEVEL_OPTIONS, DIETARY_PREFERENCE_OPTIONS, GOAL_RATE_OPTIONS, PRIMARY_GOAL_OPTIONS, trainingGoalForPrimaryGoal } from '../config/profile'
import type { ActivityLevel, AppSettings, DietaryPreference, ExperienceLevel, Goal, GoalRate, PrimaryGoal, Profile, RecoveryAggressiveness, TrainingSplit, Units, VarietyPreference } from '../types'
import { Brand } from '../components/Brand'
import { HeightField } from '../components/HeightField'
import { useUIStore } from '../stores/uiStore'
import { convertWeight } from '../utils/measurements'

interface FormState {
  name: string
  age: number
  sex?: Profile['sex']
  height: number
  bodyWeight: number
  targetWeight?: number
  units: Units
  experienceLevel: ExperienceLevel
  goal: Goal
  split: TrainingSplit
  workoutsPerWeek: number
  sessionDuration: Profile['sessionDuration']
  equipment: string[]
  warmupEnabled: boolean
  cooldownEnabled: boolean
  supersetsAllowed: boolean
  cardioFinishersAllowed: boolean
  varietyPreference: VarietyPreference
  recoveryAggressiveness: RecoveryAggressiveness
  primaryGoal: PrimaryGoal
  goalRate: GoalRate
  activityLevel: ActivityLevel
  dietaryPreference: DietaryPreference
  allergies: string
  mealFrequency: number
  limitations: string
}

const INITIAL: FormState = {
  name: '', age: 30, height: 175, bodyWeight: 165, units: 'lb', experienceLevel: 'beginner',
  goal: 'build_muscle', split: 'Full Body', workoutsPerWeek: 3, sessionDuration: 45,
  equipment: [...DEFAULT_EQUIPMENT], warmupEnabled: true, cooldownEnabled: false,
  supersetsAllowed: true, cardioFinishersAllowed: false, varietyPreference: 'balanced',
  recoveryAggressiveness: 'balanced', primaryGoal: 'build_muscle', goalRate: 'moderate',
  activityLevel: 'moderate', dietaryPreference: 'high_protein', allergies: '', mealFrequency: 4, limitations: '',
}

const optionLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())

type InitialMuscleOSImport = { status: 'loaded'; value: MuscleOSImport } | { status: 'invalid' } | null

function readInitialMuscleOSImport(): InitialMuscleOSImport {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get('muscleos')
  if (!encoded) return null
  try { return { status: 'loaded', value: decodeMuscleOSImport(encoded) } }
  catch { return { status: 'invalid' } }
}

function ChoiceGroup<T extends string | number>({
  label, value, options, onChange, compact = false,
}: {
  label: string
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  compact?: boolean
}) {
  return (
    <fieldset className={`choice-field ${compact ? 'compact' : ''}`}>
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map((option) => <button key={option} type="button" className={value === option ? 'selected' : ''} aria-pressed={value === option} onClick={() => onChange(option)}>{typeof option === 'string' ? optionLabel(option) : option}</button>)}
      </div>
    </fieldset>
  )
}

export function OnboardingPage() {
  const [initialImport] = useState(readInitialMuscleOSImport)
  const muscleOSImport = initialImport?.status === 'loaded' ? initialImport.value : null
  const [step, setStep] = useState(muscleOSImport ? 1 : 0)
  const [form, setForm] = useState<FormState>(() => muscleOSImport ? {
    ...INITIAL,
    ...muscleOSImport.profile,
    goal: trainingGoalForPrimaryGoal(muscleOSImport.profile.primaryGoal),
    equipment: muscleOSImport.gyms[0]?.equipment ?? [...INITIAL.equipment],
  } : INITIAL)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const importedGyms = muscleOSImport?.gyms ?? null
  const reportedRestingCalories = muscleOSImport?.reportedRestingCalories
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))
  const updateName = (name: string) => {
    update('name', name)
    if (name.trim()) setNameError('')
  }
  const updateUnits = (units: Units) => setForm((current) => {
    if (current.units === units) return current
    return {
      ...current,
      units,
      bodyWeight: convertWeight(current.bodyWeight, current.units, units),
      targetWeight: current.targetWeight === undefined ? undefined : convertWeight(current.targetWeight, current.units, units),
    }
  })
  const toggleEquipment = (equipment: string) => update('equipment', form.equipment.includes(equipment)
    ? form.equipment.filter((item) => item !== equipment)
    : [...form.equipment, equipment])

  useEffect(() => {
    if (!initialImport) return
    addToast(initialImport.status === 'loaded'
      ? 'Muscle OS profile loaded. Review the details, then create your plan.'
      : 'That Muscle OS import link is invalid or incomplete.', initialImport.status === 'loaded' ? 'success' : 'error')
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }, [addToast, initialImport])

  const continueNext = () => {
    if (step === 1 && !form.name.trim()) {
      setNameError('Enter your name to continue.')
      document.getElementById('onboarding-name')?.focus()
      return
    }
    if (step === 4 && form.equipment.length === 0) { addToast('Select at least one equipment option.', 'error'); return }
    setStep((current) => Math.min(7, current + 1))
  }

  const savePlan = async (plan: FormState, successMessage: string) => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const accountSession = await authProvider.getSession()
      const profile: Profile = {
        id: 'primary', name: plan.name.trim(), age: plan.age, sex: plan.sex, height: plan.height,
        bodyWeight: plan.bodyWeight, targetWeight: plan.targetWeight, units: plan.units, experienceLevel: plan.experienceLevel,
        goal: trainingGoalForPrimaryGoal(plan.primaryGoal), primaryGoal: plan.primaryGoal, goalRate: plan.goalRate,
        activityLevel: plan.activityLevel, dietaryPreference: plan.dietaryPreference, allergies: plan.allergies,
        mealFrequency: plan.mealFrequency, limitations: plan.limitations, split: plan.split, workoutsPerWeek: plan.workoutsPerWeek,
        workoutDays: Array.from({ length: plan.workoutsPerWeek }, (_, index) => (index * 2 + 1) % 7),
        sessionDuration: plan.sessionDuration, createdAt: now, updatedAt: now,
      }
      const settings: AppSettings = {
        ...DEFAULT_SETTINGS,
        warmupEnabled: plan.warmupEnabled,
        cooldownEnabled: plan.cooldownEnabled,
        supersetsAllowed: plan.supersetsAllowed,
        cardioFinishersAllowed: plan.cardioFinishersAllowed,
        varietyPreference: plan.varietyPreference,
        recoveryAggressiveness: plan.recoveryAggressiveness,
        onboardingComplete: true,
        cloudSyncEnabled: Boolean(accountSession && !accountSession.demo),
      }
      const nutritionTargets = calculateNutritionTargets({ age: plan.age, sex: plan.sex, heightCm: plan.height, weight: plan.bodyWeight, units: plan.units, activityLevel: plan.activityLevel, primaryGoal: plan.primaryGoal, goalRate: plan.goalRate })
      const gyms = importedGyms?.length
        ? importedGyms.map((gym, index) => ({ ...gym, equipment: index === 0 ? plan.equipment : gym.equipment, updatedAt: now }))
        : [{ id: 'primary', name: 'My equipment', equipment: plan.equipment, updatedAt: now }]
      await db.transaction('rw', [db.profiles, db.gymProfiles, db.appSettings, db.nutritionTargets], async () => {
        await db.profiles.put(profile)
        await db.gymProfiles.bulkPut(gyms)
        await db.appSettings.put(settings)
        await db.nutritionTargets.put(nutritionTargets)
      })
      await generateAndSaveWorkout()
      navigate('/today', { replace: true })
      addToast(successMessage, 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to finish onboarding.', 'error')
    } finally { setSaving(false) }
  }

  const finish = () => savePlan(form, 'Your unified training and nutrition plan is ready.')
  const skipOnboarding = () => savePlan({ ...INITIAL, name: 'Athlete', bodyWeight: 165 }, 'Starter plan created. Personalize it anytime from Profile.')
  const openAccountLogin = () => {
    disableLocalOnlyMode()
    window.location.assign('/auth')
  }

  if (step === 0) return (
    <main className="onboarding-welcome">
      <section className="welcome-copy">
        <Brand />
        <div className="eyebrow">Your training, intelligently planned</div>
        <h1>Train smarter.<br /><span>Progress automatically.</span></h1>
        <p>Adaptive strength training that responds to your equipment, recovery, performance, and schedule—entirely on your device.</p>
        <div className="welcome-benefits"><span><Dumbbell /> 231 movements</span><span><ShieldCheck /> Private & offline</span></div>
        <div className="welcome-actions">
          <button className="button primary large" disabled={saving} onClick={() => setStep(1)}>Build my training plan <ArrowRight /></button>
          <button className="button secondary large" disabled={saving} onClick={() => void skipOnboarding()}>{saving ? 'Creating starter plan…' : 'Skip for now'}</button>
        </div>
        <button className="text-button welcome-login" disabled={saving} onClick={openAccountLogin}><LogIn /> Already have an account? Log in</button>
        <small>No subscription. Setup takes about 2 minutes, or start with defaults.</small>
      </section>
      <aside className="welcome-art" aria-hidden="true">
        <div className="readiness-ring"><span>READINESS</span><strong>92</strong><small>PRIMED TO TRAIN</small></div>
        <div className="art-card one"><small>TODAY'S FOCUS</small><strong>Push · Strength</strong><span>6 exercises · 54 min</span></div>
        <div className="art-card two"><small>CHEST RECOVERY</small><strong>96%</strong><span>Ready</span></div>
      </aside>
    </main>
  )

  return (
    <main className="onboarding-flow">
      <header className="onboarding-header"><Brand /><div className="step-count">Step {step} of 7</div></header>
      <div className="progress-track"><span style={{ width: `${step / 7 * 100}%` }} /></div>
      <section className="onboarding-card">
        {importedGyms && <div className="import-notice"><Check /><span><strong>Muscle OS profile loaded</strong><small>Your local gym and apartment profiles are ready. Review each step before saving.{reportedRestingCalories ? ` Reported resting burn: about ${reportedRestingCalories.toLocaleString()} calories/day.` : ''}</small></span></div>}
        {step === 1 && <>
          <div className="step-icon"><Activity /></div><p className="eyebrow">The basics</p><h1>Let's personalize TrainOS.</h1><p className="step-copy">This keeps load suggestions and progress trends relevant to you. Everything stays on this device.</p>
          <div className="form-grid two">
            <label className="field full"><span>Name <small>required</small></span><input id="onboarding-name" autoFocus required aria-invalid={Boolean(nameError)} aria-describedby={nameError ? 'onboarding-name-error' : undefined} value={form.name} onChange={(event) => updateName(event.target.value)} placeholder="Your name" autoComplete="name" />{nameError && <small className="field-error" id="onboarding-name-error" role="alert">{nameError}</small>}</label>
            <label className="field"><span>Age</span><input type="number" min="13" max="100" value={form.age} onChange={(event) => update('age', Number(event.target.value))} /></label>
            <label className="field"><span>Sex <small>optional</small></span><select value={form.sex ?? ''} onChange={(event) => update('sex', (event.target.value || undefined) as Profile['sex'])}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Nonbinary</option></select></label>
            <HeightField heightCm={form.height} units={form.units} onChange={(height) => update('height', height)} />
            <label className="field"><span>Body weight <small>{form.units}</small></span><input type="number" min={form.units === 'lb' ? 66 : 30} max={form.units === 'lb' ? 700 : 318} step="0.1" value={form.bodyWeight} placeholder={form.units === 'lb' ? '165' : '75'} onChange={(event) => update('bodyWeight', Number(event.target.value))} /></label>
          </div>
          <ChoiceGroup compact label="Preferred units" value={form.units} options={['lb', 'kg'] as const} onChange={updateUnits} />
        </>}
        {step === 2 && <>
          <div className="step-icon"><WandSparkles /></div><p className="eyebrow">Your direction</p><h1>What are we training for?</h1><p className="step-copy">TrainOS uses these choices to tune rep ranges, rest periods, and exercise selection.</p>
          <ChoiceGroup label="Training experience" value={form.experienceLevel} options={['beginner', 'intermediate', 'advanced'] as const} onChange={(value) => update('experienceLevel', value)} />
          <ChoiceGroup label="Primary goal" value={form.primaryGoal} options={PRIMARY_GOAL_OPTIONS.map(({ value }) => value)} onChange={(value) => update('primaryGoal', value)} />
          <ChoiceGroup compact label="Goal rate" value={form.goalRate} options={GOAL_RATE_OPTIONS.map(({ value }) => value)} onChange={(value) => update('goalRate', value)} />
        </>}
        {step === 3 && <>
          <div className="step-icon"><Timer /></div><p className="eyebrow">Your week</p><h1>Make the plan fit real life.</h1><p className="step-copy">The split advances when you complete workouts—not because the calendar says so.</p>
          <ChoiceGroup label="Preferred training split" value={form.split} options={['Full Body', 'Upper / Lower', 'Push / Pull / Legs', 'Push / Pull / Legs x2', 'Custom'] as const} onChange={(value) => update('split', value)} />
          <ChoiceGroup compact label="Workouts per week" value={form.workoutsPerWeek} options={[1,2,3,4,5,6,7] as const} onChange={(value) => update('workoutsPerWeek', value)} />
          <ChoiceGroup compact label="Session duration (minutes)" value={form.sessionDuration} options={[15,30,45,60,75,90] as const} onChange={(value) => update('sessionDuration', value)} />
        </>}
        {step === 4 && <>
          <div className="step-icon"><Dumbbell /></div><p className="eyebrow">Your setup</p><h1>What can you train with?</h1><p className="step-copy">Only compatible exercises will appear. You can update this whenever your setup changes.</p>
          <div className="equipment-grid">{EQUIPMENT.map((equipment) => <button type="button" key={equipment} className={form.equipment.includes(equipment) ? 'selected' : ''} aria-pressed={form.equipment.includes(equipment)} onClick={() => toggleEquipment(equipment)}>{form.equipment.includes(equipment) && <Check size={15} />}{equipment}</button>)}</div>
        </>}
        {step === 5 && <>
          <div className="step-icon"><Check /></div><p className="eyebrow">Finishing touches</p><h1>How should training feel?</h1><p className="step-copy">These preferences shape the session without overriding sensible programming.</p>
          <div className="toggle-list">
            {[['warmupEnabled','Include a guided warm-up'],['cooldownEnabled','Include a cooldown'],['supersetsAllowed','Allow compatible supersets'],['cardioFinishersAllowed','Allow cardio finishers']].map(([key, label]) => <label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={form[key as keyof FormState] as boolean} onChange={(event) => update(key as keyof FormState, event.target.checked as never)} /></label>)}
          </div>
          <ChoiceGroup compact label="Exercise variety" value={form.varietyPreference} options={['low','balanced','high'] as const} onChange={(value) => update('varietyPreference', value)} />
          <ChoiceGroup compact label="Recovery approach" value={form.recoveryAggressiveness} options={['conservative','balanced','aggressive'] as const} onChange={(value) => update('recoveryAggressiveness', value)} />
          <label className="field"><span>Injuries or movement limitations <small>optional</small></span><textarea value={form.limitations} onChange={(event) => update('limitations', event.target.value)} placeholder="Describe anything TrainOS should avoid or modify"/></label>
        </>}
        {step === 6 && <>
          <div className="step-icon"><Activity /></div><p className="eyebrow">Nutrition setup</p><h1>Fuel the same goal.</h1><p className="step-copy">These inputs estimate a starting calorie and macro plan. You can override every target later.</p>
          <ChoiceGroup label="Daily activity" value={form.activityLevel} options={ACTIVITY_LEVEL_OPTIONS.map(({ value }) => value)} onChange={(value) => update('activityLevel', value)} />
          <ChoiceGroup label="Diet preference" value={form.dietaryPreference} options={DIETARY_PREFERENCE_OPTIONS.map(({ value }) => value)} onChange={(value) => update('dietaryPreference', value)} />
          <div className="form-grid two"><label className="field"><span>Meals per day</span><input type="number" min="2" max="8" value={form.mealFrequency} onChange={(event) => update('mealFrequency', Number(event.target.value))}/></label><label className="field"><span>Target weight <small>{form.units}, optional</small></span><input type="number" min="30" max="700" step="0.1" value={form.targetWeight ?? ''} onChange={(event) => update('targetWeight', event.target.value ? Number(event.target.value) : undefined)}/></label><label className="field full"><span>Allergies or food preferences <small>optional</small></span><input value={form.allergies} onChange={(event) => update('allergies', event.target.value)} placeholder="Peanuts, lactose, no shellfish…"/></label></div>
        </>}
        {step === 7 && <PlanSummary form={form} />}
        <footer className="onboarding-actions">
          <button className="button ghost" onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft /> Back</button>
          {step < 7
            ? <button className="button primary" onClick={continueNext}>Continue <ArrowRight /></button>
            : <button className="button primary" disabled={saving} onClick={() => void finish()}>{saving ? 'Building your plan…' : 'Create my TrainOS plan'} <ArrowRight /></button>}
        </footer>
      </section>
    </main>
  )
}

function PlanSummary({ form }: { form: FormState }) {
  const targets = calculateNutritionTargets({ age: form.age, sex: form.sex, heightCm: form.height, weight: form.bodyWeight, units: form.units, activityLevel: form.activityLevel, primaryGoal: form.primaryGoal, goalRate: form.goalRate })
  return <><div className="step-icon"><Check /></div><p className="eyebrow">Your starting plan</p><h1>Training and nutrition, aligned.</h1><p className="step-copy">These are transparent starting estimates—not medical advice. Logging weight, meals, performance, and recovery will refine future suggestions.</p><div className="plan-summary-grid"><div><span>Calories</span><strong>{targets.calories.toLocaleString()}</strong><small>Maintenance estimate {targets.maintenanceCalories.toLocaleString()}</small></div><div><span>Protein</span><strong>{targets.protein}g</strong><small>Priority for {optionLabel(form.primaryGoal).toLowerCase()}</small></div><div><span>Carbs</span><strong>{targets.carbs}g</strong><small>Supports training output</small></div><div><span>Fat</span><strong>{targets.fat}g</strong><small>Sensible minimum allocation</small></div><div><span>Schedule</span><strong>{form.workoutsPerWeek}× / week</strong><small>{form.split} · {form.sessionDuration} min</small></div><div><span>Equipment</span><strong>{form.equipment.length}</strong><small>Selected options</small></div></div></>
}
