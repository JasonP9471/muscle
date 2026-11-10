import { Activity, Dumbbell, Footprints, MoveHorizontal, MoveVertical, Timer, Weight } from 'lucide-react'
import type { MovementPattern } from '../types'

export function ExerciseGlyph({ pattern, size = 'medium' }: { pattern: MovementPattern; size?: 'small' | 'medium' | 'large' }) {
  const Icon = pattern === 'cardio' ? Timer
    : pattern === 'squat' || pattern === 'lunge' ? Footprints
      : pattern.includes('push') ? MoveVertical
        : pattern.includes('pull') ? MoveHorizontal
          : pattern === 'hinge' || pattern === 'carry' ? Weight
            : pattern === 'core' ? Activity : Dumbbell
  return <span className={`exercise-glyph ${size}`} aria-hidden="true"><Icon /></span>
}

