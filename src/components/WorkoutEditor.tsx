import { useState } from 'react'
import { ArrowDown, ArrowUp, Clock3, Dumbbell, GripVertical, Link2, Plus, Replace, Trash2 } from 'lucide-react'
import { calculateWorkoutDuration } from '../algorithms/duration'
import { buildExerciseSubstitutions, type ExerciseSubstitutionSet } from '../algorithms/exerciseSubstitutions'
import { REP_RANGES, REST_RANGES } from '../config/training'
import { EXERCISE_BY_ID } from '../data/exercises'
import { buildGenerationInput } from '../services/generation'
import type { Exercise, PlannedExercise, Profile, WorkoutPlan } from '../types'
import { formatMuscle } from '../utils/format'
import { ExerciseGlyph } from './ExerciseGlyph'
import { ExercisePicker } from './ExercisePicker'

export function WorkoutEditor({
  initialPlan, profile, onPlanChange, onChangeFocus, onStart, starting,
}: {
  initialPlan: WorkoutPlan
  profile: Profile
  onPlanChange: (plan: WorkoutPlan) => Promise<void>
  onChangeFocus: (splitDay: string) => Promise<void>
  onStart: (plan: WorkoutPlan) => Promise<void>
  starting: boolean
}) {
  const [plan, setPlan] = useState(initialPlan)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)
  const [substitutions, setSubstitutions] = useState<ExerciseSubstitutionSet | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const commit = async (next: WorkoutPlan) => {
    const estimatedDuration = calculateWorkoutDuration(next.exercises)
    const updated = { ...next, estimatedDuration, manuallyEdited: true }
    setPlan(updated)
    await onPlanChange(updated)
  }
  const updateExercise = (index: number, updater: (exercise: PlannedExercise) => PlannedExercise) => {
    const exercises = plan.exercises.map((exercise, itemIndex) => itemIndex === index ? updater(exercise) : exercise)
    void commit({ ...plan, exercises })
  }
  const moveExercise = (from: number, to: number) => {
    if (to < 0 || to >= plan.exercises.length || from === to) return
    const exercises = [...plan.exercises]
    const [moved] = exercises.splice(from, 1)
    exercises.splice(to, 0, moved)
    void commit({ ...plan, exercises: exercises.map((exercise, order) => ({ ...exercise, order })) })
  }
  const openReplace = async (index: number) => {
    const current = EXERCISE_BY_ID.get(plan.exercises[index].exerciseId)
    if (!current) return
    const input = await buildGenerationInput()
    setSubstitutions(buildExerciseSubstitutions(current, input))
    setReplaceIndex(index)
    setPickerOpen(true)
  }
  const openAdd = () => { setReplaceIndex(null); setSubstitutions(null); setPickerOpen(true) }
  const selectExercise = (exercise: Exercise) => {
    if (replaceIndex !== null) {
      updateExercise(replaceIndex, (current) => ({ ...current, exerciseId: exercise.id }))
    } else {
      const range = exercise.compound ? REP_RANGES[profile.goal].compound : REP_RANGES[profile.goal].isolation
      const sets = Array.from({ length: profile.experienceLevel === 'beginner' ? 2 : 3 }, (_, index) => ({
        id: crypto.randomUUID(), setNumber: index + 1, targetRepMin: range[0], targetRepMax: range[1],
        restSeconds: exercise.compound ? REST_RANGES[profile.goal].compound : REST_RANGES[profile.goal].isolation,
        completed: false, reps: range[0], rir: 2,
      }))
      const planned: PlannedExercise = { id: crypto.randomUUID(), exerciseId: exercise.id, order: plan.exercises.length, sets, notes: '' }
      void commit({ ...plan, exercises: [...plan.exercises, planned] })
    }
    setPickerOpen(false)
  }
  const toggleSuperset = (index: number) => {
    if (index >= plan.exercises.length - 1) return
    const currentGroup = plan.exercises[index].supersetGroup
    const group = currentGroup ?? crypto.randomUUID()
    const exercises = plan.exercises.map((exercise, itemIndex) => itemIndex === index || itemIndex === index + 1
      ? { ...exercise, supersetGroup: currentGroup ? undefined : group } : exercise)
    void commit({ ...plan, exercises })
  }
  const addSet = (index: number) => updateExercise(index, (exercise) => {
    const previous = exercise.sets.at(-1)!
    return { ...exercise, sets: [...exercise.sets, { ...previous, id: crypto.randomUUID(), setNumber: exercise.sets.length + 1, completed: false }] }
  })
  const deleteSet = (exerciseIndex: number, setIndex: number) => updateExercise(exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((_, index) => index !== setIndex).map((set, index) => ({ ...set, setNumber: index + 1 })),
  }))
  const updateSet = (exerciseIndex: number, setIndex: number, field: 'targetRepMin' | 'targetRepMax' | 'recommendedWeight' | 'restSeconds', value: number) => updateExercise(exerciseIndex, (exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set, index) => index === setIndex ? { ...set, [field]: Math.max(0, value), ...(field === 'recommendedWeight' ? { weight: Math.max(0, value) } : {}) } : set),
  }))

  return <>
    <section className="editor-overview">
      <div><p className="eyebrow">Today’s workout · {plan.splitDay} session</p><h1>{plan.title}</h1><div className="focus-list">{plan.focusMuscles.map((muscle) => <span key={muscle}>{formatMuscle(muscle)}</span>)}</div></div>
      <div className="editor-duration"><Clock3 /><strong>{plan.estimatedDuration}</strong><span>estimated min</span></div>
    </section>
    <p className="plan-explanation">{plan.explanation}</p>
    <div className="editor-toolbar">
      <label className="focus-select"><span>Today's focus</span><select aria-label="Change today's muscle focus" value={plan.splitDay} onChange={(event) => void onChangeFocus(event.target.value)}>{['Push','Pull','Legs','Upper','Lower','Full Body'].map((option) => <option key={option}>{option}</option>)}</select></label>
      <button className="button secondary" onClick={openAdd}><Plus /> Add exercise</button>
    </div>
    <section className="workout-editor-list" aria-label="Workout exercises">
      {plan.exercises.map((planned, exerciseIndex) => {
        const exercise = EXERCISE_BY_ID.get(planned.exerciseId)
        if (!exercise) return null
        const nextSharesSuperset = !!planned.supersetGroup && plan.exercises[exerciseIndex + 1]?.supersetGroup === planned.supersetGroup
        return <div key={planned.id} className="editor-exercise-wrap">
          <article className="editor-exercise" draggable onDragStart={() => setDragIndex(exerciseIndex)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) moveExercise(dragIndex, exerciseIndex); setDragIndex(null) }}>
            <header><GripVertical className="drag-handle" /><ExerciseGlyph pattern={exercise.movementPattern} /><div><span>Exercise {exerciseIndex + 1}</span><h2>{exercise.name}</h2><p>{exercise.primaryMuscles.map((target) => formatMuscle(target.muscle)).join(' · ')}</p></div><div className="exercise-actions"><button className="icon-button" onClick={() => moveExercise(exerciseIndex, exerciseIndex - 1)} disabled={exerciseIndex === 0} aria-label={`Move ${exercise.name} up`}><ArrowUp /></button><button className="icon-button" onClick={() => moveExercise(exerciseIndex, exerciseIndex + 1)} disabled={exerciseIndex === plan.exercises.length - 1} aria-label={`Move ${exercise.name} down`}><ArrowDown /></button></div></header>
            <div className="prescription-table">
              <div className="table-head"><span>Set</span><span>Weight ({profile.units})</span><span>Reps</span><span>Rest</span><span /></div>
              {planned.sets.map((set, setIndex) => <div className="prescription-row" key={set.id}><strong>{set.setNumber}</strong><input aria-label={`Set ${set.setNumber} weight`} type="number" min="0" step={profile.units === 'kg' ? 0.5 : 1} value={set.recommendedWeight ?? ''} placeholder="—" onChange={(event) => updateSet(exerciseIndex, setIndex, 'recommendedWeight', Number(event.target.value))} /><span className="rep-inputs"><input aria-label={`Set ${set.setNumber} minimum reps`} type="number" min="1" value={set.targetRepMin} onChange={(event) => updateSet(exerciseIndex, setIndex, 'targetRepMin', Number(event.target.value))} /><i>–</i><input aria-label={`Set ${set.setNumber} maximum reps`} type="number" min="1" value={set.targetRepMax} onChange={(event) => updateSet(exerciseIndex, setIndex, 'targetRepMax', Number(event.target.value))} /></span><select aria-label={`Set ${set.setNumber} rest`} value={set.restSeconds} onChange={(event) => updateSet(exerciseIndex, setIndex, 'restSeconds', Number(event.target.value))}>{[45,60,75,90,120,150,180,210,240].map((seconds) => <option key={seconds} value={seconds}>{seconds >= 60 ? `${seconds / 60}m` : `${seconds}s`}</option>)}</select><button className="icon-button subtle" aria-label={`Delete set ${set.setNumber}`} onClick={() => planned.sets.length > 1 && deleteSet(exerciseIndex, setIndex)} disabled={planned.sets.length <= 1}><Trash2 /></button></div>)}
            </div>
            <footer><button onClick={() => addSet(exerciseIndex)}><Plus /> Add set</button><button onClick={() => void openReplace(exerciseIndex)}><Replace /> Replace exercise</button>{exerciseIndex < plan.exercises.length - 1 && <button onClick={() => toggleSuperset(exerciseIndex)}><Link2 /> {nextSharesSuperset ? 'Remove superset' : 'Pair with next'}</button>}<button className="delete-action" onClick={() => void commit({ ...plan, exercises: plan.exercises.filter((_, index) => index !== exerciseIndex).map((item, order) => ({ ...item, order })) })}><Trash2 /> Remove</button></footer>
          </article>
          {nextSharesSuperset && <div className="superset-connector"><Link2 /> SUPERSET</div>}
        </div>
      })}
    </section>
    <div className="sticky-start"><div><strong>{plan.exercises.length} exercises</strong><span>Estimated time: {plan.estimatedDuration} minutes</span></div><button className="button primary large" disabled={plan.exercises.length === 0 || starting} onClick={() => void onStart(plan)} aria-busy={starting}>{starting ? 'Starting workout…' : <><Dumbbell /> Start workout</>}</button></div>
    <ExercisePicker open={pickerOpen} title={replaceIndex === null ? 'Add an exercise' : 'Choose the best substitute'} excludeIds={plan.exercises.map((exercise) => exercise.exerciseId)} substitutions={substitutions} onSelect={selectExercise} onClose={() => setPickerOpen(false)} />
  </>
}
