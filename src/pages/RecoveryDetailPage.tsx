import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Clock3, Dumbbell, History, SlidersHorizontal } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMuscleRecovery, recoveryLabel } from '../algorithms/recovery'
import { LoadingState } from '../components/States'
import { db } from '../db/database'
import type { Muscle } from '../types'
import { formatMuscle, formatRelativeDate } from '../utils/format'
import { useUIStore } from '../stores/uiStore'

export function RecoveryDetailPage() {
  const { muscle: encoded } = useParams()
  const muscle = decodeURIComponent(encoded ?? '') as Muscle
  const state = useLiveQuery(() => db.muscleStates.get(muscle), [muscle])
  const settings = useLiveQuery(() => db.appSettings.get('primary'), [])
  const [adjustment, setAdjustment] = useState(0)
  const navigate = useNavigate()
  const addToast = useUIStore((store) => store.addToast)
  if (!state || !settings) return <LoadingState />
  const recovery = getMuscleRecovery(state, new Date(), settings.recoveryAggressiveness)
  const remaining = Math.max(0, Math.round(state.recoveryWindowHours * (1 - recovery / 100)))
  const saveAdjustment = async () => {
    await db.muscleStates.update(muscle, { recovery, manualAdjustment: adjustment, lastUpdatedAt: new Date().toISOString() })
    addToast('Recovery estimate adjusted.', 'success')
  }
  return <main className="page detail-page">
    <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft /> Back</button>
    <section className="recovery-detail-hero" style={{ '--recovery': recovery } as React.CSSProperties}>
      <div className="recovery-big"><span>{recovery}</span><small>%</small></div><div><p className="eyebrow">{recoveryLabel(recovery)}</p><h1>{formatMuscle(muscle)}</h1><p>Heuristic recovery estimate based on completed sets, effort, training history, and elapsed time.</p></div>
    </section>
    <div className="detail-stat-grid"><div className="stat-card"><History /><span>Last trained</span><strong>{formatRelativeDate(state.lastTrainedAt)}</strong></div><div className="stat-card"><Dumbbell /><span>Recent sets</span><strong>{state.sources.reduce((sum, source) => sum + source.sets, 0)}</strong></div><div className="stat-card"><Clock3 /><span>Highly recovered in</span><strong>{remaining === 0 ? 'Now' : `~${remaining}h`}</strong></div></div>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Recent contributors</p><h2>What created fatigue</h2></div></div>{state.sources.length > 0 ? <div className="source-list">{state.sources.map((source, index) => <div key={`${source.workoutId}-${source.exerciseId}-${index}`}><span><strong>{source.exerciseName}</strong><small>{source.sets} working sets · {formatRelativeDate(source.trainedAt)}</small></span><b>-{Math.round(source.fatigue)}%</b></div>)}</div> : <p className="muted-copy">No completed training has affected this muscle yet.</p>}</section>
    <section className="card adjustment-card"><div><SlidersHorizontal /><span><h2>Manual adjustment</h2><p>Use this if your own readiness feels different from the estimate.</p></span></div><label className="range-field"><span>{adjustment > 0 ? '+' : ''}{adjustment}%</span><input type="range" min="-30" max="30" step="5" value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} /></label><button className="button secondary" onClick={saveAdjustment}>Save adjustment</button></section>
  </main>
}

