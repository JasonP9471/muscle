import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getMuscleRecovery, recoveryLabel } from '../algorithms/recovery'
import type { MuscleState, RecoveryAggressiveness } from '../types'
import { formatMuscle } from '../utils/format'

export function RecoveryGrid({ states, aggressiveness, compact = false }: { states: MuscleState[]; aggressiveness: RecoveryAggressiveness; compact?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className={`recovery-grid ${compact ? 'compact' : ''}`}>
      {states.map((state) => {
        const recovery = getMuscleRecovery(state, new Date(), aggressiveness)
        return <button key={state.muscle} className="recovery-item" style={{ '--recovery': recovery } as React.CSSProperties} onClick={() => navigate(`/recovery/${encodeURIComponent(state.muscle)}`)}>
          <span className="recovery-dot" />
          <span><strong>{formatMuscle(state.muscle)}</strong><small>{recoveryLabel(recovery)}</small></span>
          <b>{recovery}%</b><ChevronRight size={16} />
        </button>
      })}
    </div>
  )
}

