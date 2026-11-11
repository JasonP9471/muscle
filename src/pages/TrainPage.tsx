import { useId, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Copy, Dumbbell, History, Menu, Pencil, Play, Plus, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, LoadingState } from '../components/States'
import { WorkoutEditor } from '../components/WorkoutEditor'
import { ConfirmationDialog } from '../components/ConfirmationDialog'
import { db } from '../db/database'
import { generateAndSaveWorkout, generateAndSaveWorkoutVariation } from '../services/generation'
import { discardActiveWorkout, startWorkout } from '../services/workouts'
import { cancelRestNotification } from '../services/mobile'
import { usePageTitle } from '../hooks/usePageTitle'
import { useUIStore } from '../stores/uiStore'
import type { WorkoutPlan, WorkoutTemplate } from '../types'
import { useModalDialog } from '../hooks/useModalDialog'

export function TrainPage() {
  usePageTitle('Train')
  const profile = useLiveQuery(() => db.profiles.get('primary'), [])
  const active = useLiveQuery(() => db.activeWorkout.get('active'), [])
  const draft = useLiveQuery(() => db.draftWorkouts.orderBy('createdAt').last(), [])
  const templates = useLiveQuery(() => db.workoutTemplates.orderBy('updatedAt').reverse().toArray(), [])
  const [generating, setGenerating] = useState(false)
  const [starting, setStarting] = useState(false)
  const startInFlight = useRef(false)
  const [deleteTemplate, setDeleteTemplate] = useState<WorkoutTemplate | null>(null)
  const [confirmDiscardActive, setConfirmDiscardActive] = useState(false)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const [endingActive, setEndingActive] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const optionsTriggerRef = useRef<HTMLButtonElement>(null)
  const optionsCloseRef = useRef<HTMLButtonElement>(null)
  const optionsTitleId = useId()
  const optionsDialogRef = useModalDialog<HTMLElement>({ open: optionsOpen, onClose: () => { setOptionsOpen(false); setTemplatesOpen(false) }, initialFocusRef: optionsCloseRef })
  const navigate = useNavigate()
  const addToast = useUIStore((state) => state.addToast)
  if (!profile || templates === undefined) return <LoadingState />
  const regenerate = async () => {
    setGenerating(true)
    try {
      if (!draft) {
        await generateAndSaveWorkout()
        addToast('Workout generated.', 'success')
      } else {
        const { changedCount } = await generateAndSaveWorkoutVariation(draft)
        if (changedCount === 0) addToast('This is already the best match for your equipment and today’s focus.', 'info')
        else addToast(`${changedCount} ${changedCount === 1 ? 'exercise' : 'exercises'} updated. Focus and structure stayed the same.`, 'success')
      }
    }
    catch (error) { addToast(error instanceof Error ? error.message : 'Unable to generate a workout.', 'error') }
    finally { setGenerating(false) }
  }
  const savePlan = async (plan: WorkoutPlan) => { await db.draftWorkouts.put(plan) }
  const changeFocus = async (splitDay: string) => { setGenerating(true); try { await generateAndSaveWorkout(splitDay); addToast(`Focus changed to ${splitDay}.`, 'success') } finally { setGenerating(false) } }
  const begin = async (plan: WorkoutPlan) => {
    if (startInFlight.current) return
    startInFlight.current = true
    setStarting(true)
    try {
      await startWorkout(plan)
      navigate('/workout/active')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to start this workout. Your plan is still safe.', 'error')
    } finally {
      startInFlight.current = false
      setStarting(false)
    }
  }
  const templateToDraft = async (template: WorkoutTemplate) => {
    const plan: WorkoutPlan = {
      id: crypto.randomUUID(), title: template.name, splitDay: 'Custom', focusMuscles: [], estimatedDuration: profile.sessionDuration,
      readiness: 100, explanation: 'Built from your saved template and ready to adjust for today.', createdAt: new Date().toISOString(), manuallyEdited: true,
      exercises: template.exercises.map((exercise, order) => ({ ...exercise, id: crypto.randomUUID(), order, sets: exercise.sets.map((set, index) => ({ ...set, id: crypto.randomUUID(), setNumber: index + 1, completed: false })) })),
    }
    await db.draftWorkouts.clear(); await db.draftWorkouts.put(plan)
  }
  const createCustom = async () => {
    const plan: WorkoutPlan = { id: crypto.randomUUID(), title: 'Custom Workout', splitDay: 'Custom', focusMuscles: [], estimatedDuration: 0, readiness: 100, explanation: 'Your custom session. Add exercises and tune the prescription before starting.', createdAt: new Date().toISOString(), manuallyEdited: true, exercises: [] }
    await db.draftWorkouts.clear(); await db.draftWorkouts.put(plan)
    setOptionsOpen(false)
  }
  const saveCurrentTemplate = async () => {
    if (!draft) return
    const now = new Date().toISOString()
    await db.workoutTemplates.put({ id: crypto.randomUUID(), name: `${draft.title} template`, exercises: draft.exercises, createdAt: now, updatedAt: now })
    addToast('Workout saved as a template.', 'success')
    setOptionsOpen(false)
  }
  const requestVariation = () => {
    setOptionsOpen(false)
    setTemplatesOpen(false)
    if (draft?.manuallyEdited) setConfirmRegenerate(true)
    else void regenerate()
  }
  const useTemplate = async (template: WorkoutTemplate) => {
    await templateToDraft(template)
    setOptionsOpen(false)
    setTemplatesOpen(false)
    addToast(`${template.name} is ready for today.`, 'success')
  }
  const discardAndChooseAnother = async () => {
    setEndingActive(true)
    try {
      await cancelRestNotification()
      await discardActiveWorkout()
      setConfirmDiscardActive(false)
      addToast('Workout ended. Choose or build another plan.', 'success')
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Unable to end the workout.', 'error')
    } finally {
      setEndingActive(false)
    }
  }
  if (active) return <main className="page train-page"><EmptyState icon={Play} title="Workout in progress" message={`${active.title} is safely autosaved. Resume it, or end it to choose another plan.`} action={<div className="state-actions"><button className="button primary" onClick={() => navigate('/workout/active')}>Resume workout <ArrowRight /></button><button className="button danger" onClick={() => setConfirmDiscardActive(true)}><X /> End & choose another</button></div>} /><ConfirmationDialog open={confirmDiscardActive} title="End this workout?" message="This active session and any completed sets in it will not be saved. Your planned workout will remain available to edit or replace." confirmLabel={endingActive ? 'Ending…' : 'End workout'} danger onCancel={() => setConfirmDiscardActive(false)} onConfirm={() => void discardAndChooseAnother()} /></main>
  return <main className="page train-page">
    <div className="train-page-actions"><button className="button secondary" aria-haspopup="dialog" ref={optionsTriggerRef} onClick={() => setOptionsOpen(true)}><Menu /> Workout options</button></div>
    {draft ? <WorkoutEditor key={draft.id} initialPlan={draft} profile={profile} onPlanChange={savePlan} onChangeFocus={changeFocus} onStart={begin} starting={starting} /> :
      <section className="generate-hero"><span className="generate-icon"><Sparkles /></span><p className="eyebrow">Today’s scheduled workout</p><h1>Build today’s session.</h1><p>TrainOS will use your split sequence, recovery, equipment, exercise history, and session target to build the plan that fits today.</p><button className="button primary large" disabled={generating} onClick={regenerate}>{generating ? 'Building your workout…' : 'Generate today’s workout'} <ArrowRight /></button></section>}
    {optionsOpen && <div className="sheet-backdrop train-options-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOptionsOpen(false); setTemplatesOpen(false) } }}>
      <section className="train-options-sheet" ref={optionsDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={optionsTitleId}>
        <header>
          <div>{templatesOpen && <button className="icon-button" aria-label="Back to workout options" onClick={() => setTemplatesOpen(false)}><ArrowLeft /></button>}<div><p className="eyebrow">Secondary actions</p><h2 id={optionsTitleId}>{templatesOpen ? 'Saved templates' : 'Workout options'}</h2></div></div>
          <button className="icon-button" ref={optionsCloseRef} aria-label="Close workout options" onClick={() => { setOptionsOpen(false); setTemplatesOpen(false) }}><X /></button>
        </header>
        {templatesOpen ? (templates.length > 0 ? <TemplateList templates={templates} onUse={useTemplate} onDelete={setDeleteTemplate} compact /> : <div className="train-options-empty"><Dumbbell /><h3>No saved templates yet</h3><p>Save today’s workout and it will appear here for quick reuse.</p></div>) : <div className="train-option-list">
          <button disabled={!draft || generating} onClick={requestVariation}><RefreshCw /><span><strong>{generating ? 'Creating variation…' : 'Regenerate workout'}</strong><small>Keep today’s focus and refresh the exercise mix</small></span><ArrowRight /></button>
          <button onClick={() => void createCustom()}><Plus /><span><strong>Create custom workout</strong><small>Start with an empty session and choose every exercise</small></span><ArrowRight /></button>
          <button onClick={() => setTemplatesOpen(true)}><Dumbbell /><span><strong>Saved templates</strong><small>{templates.length === 0 ? 'No saved routines yet' : `${templates.length} saved ${templates.length === 1 ? 'routine' : 'routines'}`}</small></span><ArrowRight /></button>
          {draft && <button onClick={() => void saveCurrentTemplate()}><Save /><span><strong>Save today as a template</strong><small>Reuse this workout on another day</small></span><ArrowRight /></button>}
          <button onClick={() => navigate('/exercises')}><BookOpen /><span><strong>Exercise library</strong><small>Browse movements and technique guidance</small></span><ArrowRight /></button>
          <button onClick={() => navigate('/history')}><History /><span><strong>Workout history</strong><small>Review or repeat previous sessions</small></span><ArrowRight /></button>
          <button onClick={() => navigate('/progress')}><BarChart3 /><span><strong>Recovery & volume</strong><small>See what is guiding your next plan</small></span><ArrowRight /></button>
        </div>}
      </section>
    </div>}
    <ConfirmationDialog open={!!deleteTemplate} title="Delete this template?" message="The saved template will be removed. Completed workouts are not affected." confirmLabel="Delete template" danger returnFocusRef={optionsTriggerRef} onCancel={() => setDeleteTemplate(null)} onConfirm={async () => { if (deleteTemplate) await db.workoutTemplates.delete(deleteTemplate.id); setDeleteTemplate(null); addToast('Template deleted.', 'success') }} />
    <ConfirmationDialog open={confirmRegenerate} title="Create a new variation?" message="We’ll keep today’s focus and movement structure, replace up to two exercises, and reset your manual set and load changes." confirmLabel="Create variation" returnFocusRef={optionsTriggerRef} onCancel={() => setConfirmRegenerate(false)} onConfirm={() => { setConfirmRegenerate(false); void regenerate() }} />
  </main>
}

function TemplateList({ templates, onUse, onDelete, compact = false }: { templates: WorkoutTemplate[]; onUse: (template: WorkoutTemplate) => Promise<void>; onDelete: (template: WorkoutTemplate) => void; compact?: boolean }) {
  const duplicate = async (template: WorkoutTemplate) => {
    const now = new Date().toISOString()
    await db.workoutTemplates.put({ ...template, id: crypto.randomUUID(), name: `${template.name} copy`, createdAt: now, updatedAt: now })
  }
  return <section className={`template-section${compact ? ' compact' : ''}`}><div className="template-grid">{templates.map((template) => <article className="template-card" key={template.id}><span><Dumbbell /></span><div><h3>{template.name}</h3><p>{template.exercises.length} exercises</p></div><div><button aria-label={`Use ${template.name}`} onClick={() => void onUse(template)}><Play /> Use</button><button aria-label={`Edit ${template.name}`} onClick={() => void onUse(template)}><Pencil /></button><button aria-label={`Duplicate ${template.name}`} onClick={() => void duplicate(template)}><Copy /></button><button aria-label={`Delete ${template.name}`} onClick={() => onDelete(template)}><Trash2 /></button></div></article>)}</div></section>
}
