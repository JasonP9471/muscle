import { useEffect, useId, useRef, useState, type TouchEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ArrowLeft, Calculator, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Flame, Home, Menu, Minus, MoveRight, Pause, Play, Plus, Replace, Save, Shuffle, Timer, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildExerciseSubstitutions, type ExerciseSubstitutionSet } from '../algorithms/exerciseSubstitutions'
import { getExerciseGuidance } from '../algorithms/exerciseGuidance'
import { calculatePlateLoad, generateWarmupSets } from '../algorithms/workoutAssist'
import { Brand } from '../components/Brand'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { ExerciseGlyph } from '../components/ExerciseGlyph'
import { ExercisePicker } from '../components/ExercisePicker'
import { EmptyState, LoadingState } from '../components/States'
import { REP_RANGES, REST_RANGES } from '../config/training'
import { DEFAULT_BAR_WEIGHT, QUICK_WEIGHT_STEP } from '../config/workoutAssist'
import { EXERCISE_BY_ID } from '../data/exercises'
import { db } from '../db/database'
import { buildGenerationInput } from '../services/generation'
import { calculateRemainingRest, discardActiveWorkout, finishWorkout, saveActiveWorkout, startRestTimer, validateSetForExercise } from '../services/workouts'
import { cancelRestNotification, restCompletedHaptic, scheduleRestNotification, setCompletedHaptic } from '../services/mobile'
import type { ActiveWorkout, Exercise } from '../types'
import { formatDuration, formatMuscle } from '../utils/format'
import { getExerciseIllustrationUrl } from '../utils/exerciseIllustration'
import { useUIStore } from '../stores/uiStore'
import { useModalDialog } from '../hooks/useModalDialog'

export function ActiveWorkoutPage() {
  const activeRows = useLiveQuery(() => db.activeWorkout.toArray(), [])
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const allLogs = useLiveQuery(() => db.setLogs.orderBy('completedAt').reverse().limit(500).toArray(), []) ?? []
  const active = activeRows?.[0]
  const [now, setNow] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [discardAction, setDiscardAction] = useState<'end' | 'switch' | null>(null)
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)
  const [substitutions, setSubstitutions] = useState<ExerciseSubstitutionSet | null>(null)
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(0)
  const [plateTarget, setPlateTarget] = useState<{ exerciseIndex: number; setIndex: number } | null>(null)
  const [barWeight, setBarWeight] = useState(45)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const timerAlerted = useRef(false)
  const initializedPlanRef = useRef<string | null>(null)
  const sessionMenuCloseRef = useRef<HTMLButtonElement>(null)
  const sessionTriggerRef = useRef<HTMLButtonElement>(null)
  const plateCloseRef = useRef<HTMLButtonElement>(null)
  const sessionMenuTitleId = useId()
  const plateCalculatorTitleId = useId()
  const sessionMenuDialogRef = useModalDialog<HTMLElement>({ open: sessionMenuOpen, onClose: () => setSessionMenuOpen(false), initialFocusRef: sessionMenuCloseRef })
  const plateDialogRef = useModalDialog<HTMLElement>({ open: plateTarget !== null, onClose: () => setPlateTarget(null), initialFocusRef: plateCloseRef })
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (!active?.pausedAt) return
    void saveActiveWorkout({ ...active, startedAt: new Date().toISOString(), pausedAt: undefined })
  }, [active])
  useEffect(() => {
    if (!active || initializedPlanRef.current === active.planId) return
    initializedPlanRef.current = active.planId
    const firstIncomplete = active.exercises.findIndex((exercise) => exercise.sets.some((set) => !set.completed))
    setSelectedExerciseIndex(Math.max(0, firstIncomplete))
  }, [active])
  const remaining = active ? (active.restTimer.running && now ? calculateRemainingRest(active.restTimer, now) : active.restTimer.remainingSeconds) : 0
  useEffect(() => {
    if (!active || !active.restTimer.running || remaining !== 0 || timerAlerted.current) return
    timerAlerted.current = true
    const next = { ...active, restTimer: { ...active.restTimer, running: false, remainingSeconds: 0, endAt: undefined } }
    void saveActiveWorkout(next)
    void cancelRestNotification()
    if (settings?.vibrationEnabled) {
      void restCompletedHaptic()
      if (navigator.vibrate) navigator.vibrate([180, 80, 180])
    }
    if (settings?.soundsEnabled) {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      oscillator.connect(context.destination); oscillator.frequency.value = 720; oscillator.start(); oscillator.stop(context.currentTime + 0.16)
    }
  }, [active, remaining, settings?.soundsEnabled, settings?.vibrationEnabled])
  if (!activeRows || !settings || !profile) return <LoadingState />
  if (!active) return <main className="active-workout-page"><EmptyState title="No active workout" message="Start a workout from the Train tab and it will be autosaved here." action={<button className="button primary" onClick={() => navigate('/train')}>Go to Train</button>} /></main>
  const totalSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const completedSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0)
  const totalWorkingSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => !set.isWarmup).length, 0)
  const completedWorkingSets = active.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed && !set.isWarmup).length, 0)
  const focusedExerciseIndex = Math.min(selectedExerciseIndex, Math.max(0, active.exercises.length - 1))
  const elapsed = active.pausedAt
    ? active.elapsedBeforeStart
    : now ? Math.floor((now - new Date(active.startedAt).getTime()) / 1000) + active.elapsedBeforeStart : active.elapsedBeforeStart
  const persist = (next: ActiveWorkout) => { void saveActiveWorkout(next, active) }
  const updateSet = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps' | 'rir', value: number) => {
    const exercises = active.exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, sets: exercise.sets.map((set, item) => item === setIndex ? { ...set, [field]: Math.max(0, value) } : set) } : exercise)
    persist({ ...active, exercises })
  }
  const focusSet = (exerciseIndex: number, setIndex: number) => {
    setSelectedExerciseIndex(exerciseIndex)
    window.setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-set-position="${exerciseIndex}-${setIndex}"]`)
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      row?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      row?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }
  const moveExerciseFocus = (direction: -1 | 1) => {
    const nextExerciseIndex = Math.max(0, Math.min(active.exercises.length - 1, focusedExerciseIndex + direction))
    if (nextExerciseIndex === focusedExerciseIndex) return
    const nextSetIndex = active.exercises[nextExerciseIndex].sets.findIndex((set) => !set.completed)
    focusSet(nextExerciseIndex, Math.max(0, nextSetIndex))
  }
  const beginSwipe = (event: TouchEvent<HTMLElement>) => {
    if ((event.target as Element).closest('input, select, textarea, button, a')) { swipeStart.current = null; return }
    const touch = event.changedTouches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const endSwipe = (event: TouchEvent<HTMLElement>) => {
    if (!swipeStart.current) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - swipeStart.current.x
    const deltaY = touch.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) return
    moveExerciseFocus(deltaX < 0 ? 1 : -1)
  }
  const addWarmups = (exerciseIndex: number) => {
    const planned = active.exercises[exerciseIndex]
    const workingSets = planned.sets.filter((set) => !set.isWarmup)
    const workingSet = workingSets.find((set) => !set.completed) ?? workingSets[0]
    const workingWeight = workingSet?.weight ?? workingSet?.recommendedWeight ?? 0
    if (workingWeight <= 0) { addToast('Enter your working weight first, then generate warm-up sets.', 'error'); return }
    const warmups = generateWarmupSets(workingWeight, profile.units)
    if (warmups.length === 0) { addToast('This working weight does not need a lighter generated warm-up.', 'error'); return }
    const exercises = active.exercises.map((item, index) => index === exerciseIndex
      ? { ...item, sets: [...warmups, ...workingSets].map((set, setIndex) => ({ ...set, setNumber: setIndex + 1 })) }
      : item)
    persist({ ...active, exercises })
    focusSet(exerciseIndex, 0)
    addToast(`${warmups.length} warm-up sets added. They won’t count toward volume or records.`, 'success')
  }
  const openPlateCalculator = (exerciseIndex: number, setIndex: number) => {
    setBarWeight(DEFAULT_BAR_WEIGHT[profile.units])
    setPlateTarget({ exerciseIndex, setIndex })
  }
  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    const current = active.exercises[exerciseIndex].sets[setIndex]
    const completing = !current.completed
    if (completing) {
      const validationError = validateSetForExercise(active.exercises[exerciseIndex].exerciseId, current)
      if (validationError) { addToast(validationError, 'error'); return }
    }
    const exercises = active.exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, sets: exercise.sets.map((set, item) => item === setIndex ? { ...set, completed: completing } : set) } : exercise)
    const next = completing && settings.restTimerEnabled ? startRestTimer({ ...active, exercises }, current.restSeconds) : { ...active, exercises }
    timerAlerted.current = false
    persist(next)
    if (completing) {
      const pending = exercises.flatMap((exercise, nextExerciseIndex) => exercise.sets.flatMap((set, nextSetIndex) => !set.completed ? [{ exerciseIndex: nextExerciseIndex, setIndex: nextSetIndex }] : []))
      const nextInExercise = pending.find((position) => position.exerciseIndex === exerciseIndex && position.setIndex > setIndex)
      const nextExercise = pending.find((position) => position.exerciseIndex > exerciseIndex)
      const nextPosition = nextInExercise ?? nextExercise ?? pending[0]
      if (nextPosition) focusSet(nextPosition.exerciseIndex, nextPosition.setIndex)
    } else {
      focusSet(exerciseIndex, setIndex)
    }
    if (completing && settings.vibrationEnabled) void setCompletedHaptic()
    if (completing && settings.restTimerEnabled && settings.restTimerNotificationsEnabled) void scheduleRestNotification(current.restSeconds)
  }
  const changeTimer = (seconds: number) => {
    const current = calculateRemainingRest(active.restTimer)
    const updated = Math.max(0, current + seconds)
    timerAlerted.current = false
    persist({ ...active, restTimer: { ...active.restTimer, remainingSeconds: updated, endAt: active.restTimer.running ? new Date(Date.now() + updated * 1000).toISOString() : undefined } })
    if (settings.restTimerNotificationsEnabled) {
      if (active.restTimer.running && updated > 0) void scheduleRestNotification(updated)
      else void cancelRestNotification()
    }
  }
  const pauseResume = () => {
    if (active.restTimer.running) {
      persist({ ...active, restTimer: { ...active.restTimer, running: false, remainingSeconds: remaining, endAt: undefined } })
      void cancelRestNotification()
    } else {
      timerAlerted.current = false
      persist({ ...active, restTimer: { ...active.restTimer, running: true, endAt: new Date(Date.now() + active.restTimer.remainingSeconds * 1000).toISOString() } })
      if (settings.restTimerNotificationsEnabled) void scheduleRestNotification(active.restTimer.remainingSeconds)
    }
  }
  const openReplace = async (index: number) => {
    const current = EXERCISE_BY_ID.get(active.exercises[index].exerciseId)
    if (!current) return
    const input = await buildGenerationInput()
    setSubstitutions(buildExerciseSubstitutions(current, input))
    setReplaceIndex(index); setPickerOpen(true)
  }
  const selectExercise = (exercise: Exercise) => {
    if (replaceIndex !== null) {
      const exercises = active.exercises.map((planned, index) => index === replaceIndex ? { ...planned, exerciseId: exercise.id } : planned)
      persist({ ...active, exercises })
      addToast(`Replaced with ${exercise.name}.`, 'success')
    } else {
      const range = exercise.compound ? REP_RANGES[profile.goal].compound : REP_RANGES[profile.goal].isolation
      const restSeconds = exercise.compound ? REST_RANGES[profile.goal].compound : REST_RANGES[profile.goal].isolation
      const planned = {
        id: crypto.randomUUID(), exerciseId: exercise.id, order: active.exercises.length, notes: '',
        sets: Array.from({ length: profile.experienceLevel === 'beginner' ? 2 : 3 }, (_, index) => ({
          id: crypto.randomUUID(), setNumber: index + 1, targetRepMin: range[0], targetRepMax: range[1],
          restSeconds, completed: false, reps: range[0], rir: 2,
        })),
      }
      persist({ ...active, exercises: [...active.exercises, planned] })
      addToast(`${exercise.name} added.`, 'success')
    }
    setPickerOpen(false)
  }
  const completeWorkout = async () => {
    setFinishing(true)
    try { await cancelRestNotification(); const record = await finishWorkout(active); navigate(`/workout/complete/${record.id}`, { replace: true }) }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to finish the workout.', 'error') }
    finally { setFinishing(false) }
  }
  const saveForLater = async () => {
    const pausedAt = new Date().toISOString()
    const paused: ActiveWorkout = {
      ...active,
      startedAt: pausedAt,
      elapsedBeforeStart: elapsed,
      pausedAt,
      restTimer: { ...active.restTimer, running: false, remainingSeconds: remaining, endAt: undefined },
    }
    await cancelRestNotification()
    await saveActiveWorkout(paused)
    setSessionMenuOpen(false)
    addToast('Workout saved. Resume whenever you’re ready.', 'success')
    navigate('/today')
  }
  const discardWorkout = async (destination: 'end' | 'switch') => {
    setFinishing(true)
    try {
      await cancelRestNotification()
      await discardActiveWorkout()
      setDiscardAction(null)
      setSessionMenuOpen(false)
      addToast(destination === 'switch' ? 'Workout ended. Choose another plan.' : 'Workout ended without saving.', 'success')
      navigate(destination === 'switch' ? '/train' : '/today', { replace: true })
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to end the workout.', 'error')
    } finally {
      setFinishing(false)
    }
  }
  return <main className="active-workout-page">
    <header className="active-header"><button className="icon-button" aria-label="Back to Train" onClick={() => navigate('/train')}><ArrowLeft /></button><Brand /><div className="active-title"><span>{active.title}</span><small><Save /> Autosaved {new Date(active.autosavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div><div className="elapsed"><Clock3 /><strong>{formatDuration(elapsed)}</strong></div><button className="button finish" ref={sessionTriggerRef} disabled={finishing} onClick={() => setSessionMenuOpen(true)}><Menu /> Session</button></header>
    <div className="active-progress"><span style={{ width: `${totalSets ? (completedSets / totalSets) * 100 : 0}%` }} /><small>{completedSets} of {totalSets} sets</small></div>
    <section className="active-exercises">
      {active.exercises.map((planned, exerciseIndex) => {
        const exercise = EXERCISE_BY_ID.get(planned.exerciseId)
        if (!exercise) return null
        const guidance = getExerciseGuidance(exercise)
        const exerciseLogs = allLogs.filter((log) => log.exerciseId === exercise.id)
        const previousWorkoutId = exerciseLogs[0]?.workoutId
        const previous = exerciseLogs.filter((log) => log.workoutId === previousWorkoutId).sort((a, b) => a.setNumber - b.setNumber)
        const isCurrent = exerciseIndex === focusedExerciseIndex
        const exerciseComplete = planned.sets.every((set) => set.completed)
        const currentSetIndex = planned.sets.findIndex((set) => !set.completed)
        const editableSetIndex = currentSetIndex >= 0 ? currentSetIndex : planned.sets.length - 1
        const editableSet = planned.sets[editableSetIndex]
        const supportsPlates = exercise.requiredEquipment.some((item) => /barbell|smith machine|ez curl bar/i.test(item))
        return <article className={`active-exercise-card ${isCurrent ? 'current' : 'inactive'} ${exerciseComplete ? 'exercise-complete' : ''}`} aria-current={isCurrent ? 'step' : undefined} key={planned.id} onTouchStart={isCurrent ? beginSwipe : undefined} onTouchEnd={isCurrent ? endSwipe : undefined}>
          <header><ExerciseGlyph pattern={exercise.movementPattern} size="large" /><div><p>{isCurrent ? 'Current exercise' : exerciseComplete ? 'Completed' : `Up next · Exercise ${exerciseIndex + 1}`}</p><h2>{exercise.name}</h2><span>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')} · {planned.sets.filter((set) => set.completed).length}/{planned.sets.length} sets</span></div>{isCurrent ? <button className="button mini secondary" onClick={() => void openReplace(exerciseIndex)}><Replace /> Replace</button> : <button className="active-exercise-jump" onClick={() => { const nextSet = planned.sets.findIndex((set) => !set.completed); focusSet(exerciseIndex, Math.max(0, nextSet)) }}>{exerciseComplete ? 'Review' : 'Go'} <ChevronRight /></button>}</header>
          {isCurrent && <>
          <nav className="exercise-thumb-nav" aria-label="Exercise navigation"><button disabled={exerciseIndex === 0} onClick={() => moveExerciseFocus(-1)}><ChevronLeft /> Previous</button><span><strong>{exerciseIndex + 1} / {active.exercises.length}</strong><small>Swipe to switch</small></span><button disabled={exerciseIndex === active.exercises.length - 1} onClick={() => moveExerciseFocus(1)}>Next <ChevronRight /></button></nav>
          <section className="active-guidance-quick" aria-label={`${exercise.name} form guide`}>
            <div className="guidance-motion has-illustration">
              <img src={getExerciseIllustrationUrl(exercise.id)} alt={`${exercise.name} start and finish positions`} />
              <div className="guidance-frame-labels" aria-hidden="true"><span>Start</span><span>Finish</span></div>
            </div>
            <div className="guidance-quick-steps">
              <article><span><CheckCircle2 /></span><div><strong>Setup</strong><p>{guidance.setup[0]}</p></div></article>
              <article><span><MoveRight /></span><div><strong>Do this</strong><p>{guidance.execution[0]}</p><small>{guidance.tempo}</small></div></article>
              <article className="avoid"><span><AlertTriangle /></span><div><strong>Avoid this</strong><p>{guidance.commonMistakes[0]}</p></div></article>
            </div>
          </section>
          {editableSet && exercise.exerciseType === 'weighted' && <section className="workout-speed-tools" aria-label="Quick set controls">
            <div className="quick-weight-control"><button aria-label={`Decrease weight by ${QUICK_WEIGHT_STEP[profile.units]} ${profile.units}`} onClick={() => updateSet(exerciseIndex, editableSetIndex, 'weight', (editableSet.weight ?? 0) - QUICK_WEIGHT_STEP[profile.units])}><Minus /></button><div><small>{editableSet.isWarmup ? 'Warm-up' : `Set ${editableSet.setNumber}`} weight</small><strong>{editableSet.weight ?? 0} <span>{profile.units}</span></strong></div><button aria-label={`Increase weight by ${QUICK_WEIGHT_STEP[profile.units]} ${profile.units}`} onClick={() => updateSet(exerciseIndex, editableSetIndex, 'weight', (editableSet.weight ?? 0) + QUICK_WEIGHT_STEP[profile.units])}><Plus /></button></div>
            <div className="quick-tool-actions"><button onClick={() => addWarmups(exerciseIndex)}><Flame /> {planned.sets.some((set) => set.isWarmup) ? 'Regenerate warm-ups' : 'Generate warm-ups'}</button>{supportsPlates && <button onClick={() => openPlateCalculator(exerciseIndex, editableSetIndex)}><Calculator /> Plate calculator</button>}</div>
          </section>}
          <div className="active-set-table"><div className="active-table-head"><span>Set</span><span>Last</span><span>Weight</span><span>Reps</span><span>RIR</span><span><Check /></span></div>
            {planned.sets.map((set, setIndex) => { const previousIndex = planned.sets.slice(0, setIndex + 1).filter((item) => !item.isWarmup).length - 1; const visibleSetNumber = set.isWarmup ? planned.sets.slice(0, setIndex + 1).filter((item) => item.isWarmup).length : previousIndex + 1; return <div data-set-position={`${exerciseIndex}-${setIndex}`} className={`active-set-row ${set.completed ? 'completed' : ''} ${setIndex === currentSetIndex ? 'current-set' : ''} ${set.isWarmup ? 'warmup-set' : ''}`} key={set.id}><strong>{set.isWarmup ? `W${visibleSetNumber}` : visibleSetNumber}</strong><small>{set.isWarmup ? 'Warm-up' : previous[previousIndex] ? `${previous[previousIndex].weight} × ${previous[previousIndex].reps}` : 'New'}</small><input aria-label={`${exercise.name} ${set.isWarmup ? 'warm-up' : 'set'} ${visibleSetNumber} weight in ${profile.units}`} type="number" inputMode="decimal" min="0" step={profile.units === 'kg' ? .5 : 1} value={set.weight ?? ''} placeholder="0" onChange={(event) => updateSet(exerciseIndex, setIndex, 'weight', Number(event.target.value))} /><input aria-label={`${exercise.name} ${set.isWarmup ? 'warm-up' : 'set'} ${visibleSetNumber} reps`} type="number" inputMode="numeric" min="0" value={set.reps ?? ''} placeholder={`${set.targetRepMin}-${set.targetRepMax}`} onChange={(event) => updateSet(exerciseIndex, setIndex, 'reps', Number(event.target.value))} /><select aria-label={`${exercise.name} ${set.isWarmup ? 'warm-up' : 'set'} ${visibleSetNumber} reps in reserve`} value={set.rir ?? 2} onChange={(event) => updateSet(exerciseIndex, setIndex, 'rir', Number(event.target.value))}>{[0,1,2,3,4,5].map((rir) => <option key={rir} value={rir}>{rir}{rir === 5 ? '+' : ''}</option>)}</select><button className="set-check" aria-label={`${set.completed ? 'Uncomplete' : 'Complete'} ${exercise.name} ${set.isWarmup ? 'warm-up' : 'set'} ${visibleSetNumber}`} aria-pressed={set.completed} onClick={() => toggleSet(exerciseIndex, setIndex)}><Check /></button></div> })}
          </div>
          <div className="active-card-actions"><button onClick={() => {
            const previousSet = planned.sets.at(-1)!
            const exercises = active.exercises.map((item, index) => index === exerciseIndex ? { ...item, sets: [...item.sets, { ...previousSet, id: crypto.randomUUID(), setNumber: item.sets.length + 1, completed: false }] } : item)
            persist({ ...active, exercises })
          }}><Plus /> Add set</button><button disabled={planned.sets.length <= 1} onClick={() => {
            const exercises = active.exercises.map((item, index) => index === exerciseIndex ? { ...item, sets: item.sets.slice(0, -1) } : item)
            persist({ ...active, exercises })
          }}><Trash2 /> Delete set</button></div>
          <label className="notes-field"><span>Exercise notes</span><textarea value={planned.notes} placeholder="Setup, cues, or how this felt…" onChange={(event) => {
            const exercises = active.exercises.map((item, index) => index === exerciseIndex ? { ...item, notes: event.target.value } : item)
            persist({ ...active, exercises })
          }} /></label>
          </>}
        </article>
      })}
    </section>
    <div className="active-session-actions"><button className="button secondary active-add-exercise" onClick={() => { setReplaceIndex(null); setSubstitutions(null); setPickerOpen(true) }}><Plus /> Add exercise</button></div>
    {active.restTimer.durationSeconds > 0 && <section className={`rest-timer ${remaining === 0 ? 'done' : ''}`}><div className="timer-ring"><Timer /><strong>{formatDuration(remaining)}</strong><span>{remaining === 0 ? 'REST COMPLETE' : 'REST TIMER'}</span></div><div className="timer-controls"><button onClick={() => changeTimer(-15)} aria-label="Subtract 15 seconds"><Minus />15</button><button className="timer-play" onClick={pauseResume} disabled={remaining === 0} aria-label={active.restTimer.running ? 'Pause rest timer' : 'Resume rest timer'}>{active.restTimer.running ? <Pause /> : <Play />}</button><button onClick={() => changeTimer(15)} aria-label="Add 15 seconds"><Plus />15</button><button onClick={() => { void cancelRestNotification(); persist({ ...active, restTimer: { ...active.restTimer, running: false, remainingSeconds: 0, endAt: undefined } }) }}><X /> Skip</button></div></section>}
    <div className={`session-control-dock ${active.restTimer.durationSeconds > 0 ? 'timer-visible' : ''}`} aria-label="Workout controls">
      <div><strong>{completedSets} of {totalSets} sets</strong><small>Every change is autosaved</small></div>
      <button className="button primary" disabled={finishing || completedWorkingSets === 0} onClick={() => setConfirmFinish(true)}><CheckCircle2 /> Finish & save</button>
      <button className="button secondary" disabled={finishing} onClick={() => setSessionMenuOpen(true)}><Menu /> Options</button>
    </div>
    {sessionMenuOpen && <div className="sheet-backdrop session-menu-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSessionMenuOpen(false)}>
      <section className="session-menu" ref={sessionMenuDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={sessionMenuTitleId}>
        <header><div><p className="eyebrow">Workout controls</p><h2 id={sessionMenuTitleId}>What would you like to do?</h2></div><button className="icon-button" ref={sessionMenuCloseRef} aria-label="Close workout controls" onClick={() => setSessionMenuOpen(false)}><X /></button></header>
        <button disabled={completedWorkingSets === 0} onClick={() => { setSessionMenuOpen(false); setConfirmFinish(true) }}><CheckCircle2 /><span><strong>Finish and save</strong><small>{completedWorkingSets > 0 ? `Save ${completedWorkingSets} of ${totalWorkingSets} working sets and update your progress.` : 'Complete at least one working set before saving.'}</small></span></button>
        <button onClick={() => void saveForLater()}><Save /><span><strong>Save and continue later</strong><small>Pause this session and return to Today. Your entries stay saved.</small></span></button>
        <button className="danger-option" onClick={() => { setSessionMenuOpen(false); setDiscardAction('end') }}><X /><span><strong>End without saving</strong><small>Discard this session and return to Today.</small></span></button>
        <button onClick={() => { setSessionMenuOpen(false); setDiscardAction('switch') }}><Shuffle /><span><strong>Switch workout</strong><small>Discard this session and choose a different workout.</small></span></button>
        <button className="menu-cancel" onClick={() => setSessionMenuOpen(false)}><Home /> Keep working out</button>
      </section>
    </div>}
    {plateTarget && (() => { const targetSet = active.exercises[plateTarget.exerciseIndex]?.sets[plateTarget.setIndex]; if (!targetSet) return null; const load = calculatePlateLoad(targetSet.weight ?? 0, profile.units, barWeight); return <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPlateTarget(null)}><section className="plate-calculator" ref={plateDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={plateCalculatorTitleId}><header><div><p className="eyebrow">Load the bar</p><h2 id={plateCalculatorTitleId}>Plate calculator</h2></div><button className="icon-button" ref={plateCloseRef} aria-label="Close plate calculator" onClick={() => setPlateTarget(null)}><X /></button></header><div className="plate-total"><span>Target</span><strong>{targetSet.weight ?? 0} {profile.units}</strong></div><label className="field"><span>Bar weight ({profile.units})</span><input type="number" inputMode="decimal" min="0" step={profile.units === 'kg' ? 2.5 : 5} value={barWeight} onChange={(event) => setBarWeight(Math.max(0, Number(event.target.value)))} /></label><div className="plate-result"><span>Put on each side</span>{load.perSide.length > 0 ? <div>{load.perSide.map((item) => <strong key={item.plate}>{item.count} × {item.plate}</strong>)}</div> : <p>The bar is already at or above this target.</p>}<small>Loaded total: {load.loadedWeight} {profile.units}{load.remainder > 0 ? ` · ${load.remainder} ${profile.units} under target` : ' · exact'}</small></div>{load.remainder > 0 && load.loadedWeight > 0 && <button className="button primary" onClick={() => { updateSet(plateTarget.exerciseIndex, plateTarget.setIndex, 'weight', load.loadedWeight); setPlateTarget(null) }}>Use {load.loadedWeight} {profile.units}</button>}</section></div> })()}
    <ConfirmationDialog open={confirmFinish} title="Finish and save this workout?" message={`${completedWorkingSets} completed working sets will be saved. Warm-ups stay out of volume, records, and fatigue.`} confirmLabel={finishing ? 'Saving…' : 'Finish & save'} returnFocusRef={sessionTriggerRef} onCancel={() => setConfirmFinish(false)} onConfirm={() => void completeWorkout()} />
    <ConfirmationDialog open={discardAction !== null} title={discardAction === 'switch' ? 'Switch workouts?' : 'End without saving?'} message={discardAction === 'switch' ? `${completedSets > 0 ? `${completedSets} completed sets and ` : ''}changes from this session will be discarded. Your planned workout remains available to replace or edit.` : `${completedSets > 0 ? `${completedSets} completed sets and ` : ''}changes from this session will be discarded. You’ll return to Today.`} confirmLabel={finishing ? 'Ending…' : discardAction === 'switch' ? 'End & switch' : 'End without saving'} danger returnFocusRef={sessionTriggerRef} onCancel={() => setDiscardAction(null)} onConfirm={() => discardAction && void discardWorkout(discardAction)} />
    <ExercisePicker open={pickerOpen} title={replaceIndex === null ? 'Add an exercise' : 'Choose the best substitute'} excludeIds={active.exercises.map((exercise) => exercise.exerciseId)} substitutions={substitutions} onSelect={selectExercise} onClose={() => setPickerOpen(false)} />
  </main>
}
