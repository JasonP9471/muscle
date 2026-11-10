import type { MovementPattern } from '../types'

export const SUBSTITUTION_SCORE_WEIGHTS = {
  sameMovementPattern: 48,
  primaryMuscleOverlap: 34,
  secondaryMuscleOverlap: 12,
  sameDifficulty: 14,
  adjacentDifficulty: 7,
  sameCompoundType: 5,
  sameLaterality: 3,
  favorite: 14,
  recommendMore: 7,
  recommendLess: -9,
} as const

export interface LimitationRule {
  label: string
  aliases: string[]
  blockedPatterns: MovementPattern[]
  blockedNameTerms: string[]
}

// These are conservative, explainable filters for clear profile conflicts. They are
// intentionally not presented as medical clearance or a substitute for professional advice.
export const LIMITATION_RULES: LimitationRule[] = [
  {
    label: 'shoulder',
    aliases: ['shoulder', 'rotator cuff'],
    blockedPatterns: ['vertical_push'],
    blockedNameTerms: ['behind-the-neck', 'upright row', 'dip', 'front raise', 'lateral raise'],
  },
  {
    label: 'knee',
    aliases: ['knee', 'patella', 'acl', 'mcl', 'meniscus'],
    blockedPatterns: ['squat', 'lunge'],
    blockedNameTerms: ['leg extension', 'leg press', 'hack squat', 'sissy squat', 'step-up', 'jump', 'running'],
  },
  {
    label: 'lower back',
    aliases: ['lower back', 'low back', 'lumbar', 'sciatica', 'spinal disc'],
    blockedPatterns: ['hinge'],
    blockedNameTerms: ['bent-over', 'back squat', 'good morning', 'back extension'],
  },
  {
    label: 'wrist',
    aliases: ['wrist', 'carpal tunnel'],
    blockedPatterns: [],
    blockedNameTerms: ['barbell', 'push-up', 'plank', 'front squat'],
  },
  {
    label: 'elbow',
    aliases: ['elbow', 'tennis elbow', 'golfer elbow'],
    blockedPatterns: [],
    blockedNameTerms: ['skull crusher', 'triceps extension', 'pushdown', 'curl'],
  },
  {
    label: 'ankle',
    aliases: ['ankle', 'achilles'],
    blockedPatterns: ['lunge'],
    blockedNameTerms: ['calf raise', 'jump', 'running', 'step-up'],
  },
  {
    label: 'overhead movement',
    aliases: ['avoid overhead', 'no overhead', 'overhead restriction'],
    blockedPatterns: ['vertical_push'],
    blockedNameTerms: ['overhead', 'military press', 'arnold press'],
  },
  {
    label: 'impact',
    aliases: ['no impact', 'low impact only', 'avoid jumping', 'no jumping'],
    blockedPatterns: [],
    blockedNameTerms: ['jump', 'running', 'burpee', 'box jump'],
  },
]
