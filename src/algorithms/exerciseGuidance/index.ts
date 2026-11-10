import type { Exercise, MovementPattern } from '../../types'

export interface ExerciseGuidance {
  setup: string[]
  execution: string[]
  breathing: string
  tempo: string
  commonMistakes: string[]
  adjustment: string
  safetyNote: string
}

type PatternGuidance = Omit<ExerciseGuidance, 'adjustment' | 'safetyNote'>

const PATTERN_GUIDANCE: Record<MovementPattern, PatternGuidance> = {
  horizontal_push: {
    setup: ['Create a stable base before unracking or beginning the rep.', 'Set the shoulder blades without forcing them into an uncomfortable position.'],
    execution: ['Lower toward a consistent, comfortable touch point with the forearms stacked.', 'Press smoothly while keeping the wrists over the elbows.'],
    breathing: 'Breathe in and brace before lowering; breathe out after the hardest part of the press.',
    tempo: '2–3 sec down · brief control · smooth press',
    commonMistakes: ['Losing wrist and elbow alignment', 'Bouncing or forcing extra depth', 'Letting the shoulders roll forward'],
  },
  vertical_push: {
    setup: ['Stack the ribs over the pelvis and brace before the first rep.', 'Choose a grip that keeps the forearms close to vertical.'],
    execution: ['Press through a path that stays close to the body.', 'Finish overhead without leaning back to create extra range.'],
    breathing: 'Breathe in and brace at the bottom; breathe out as the weight clears the sticking point.',
    tempo: '2 sec down · controlled turn · steady press',
    commonMistakes: ['Overarching the lower back', 'Shrugging before the weight clears the head', 'Turning the rep into a push press'],
  },
  horizontal_pull: {
    setup: ['Brace the torso and set a repeatable shoulder position.', 'Start with enough reach to load the back without rounding aggressively.'],
    execution: ['Drive the elbow toward the hip or rib cage based on the target muscle.', 'Pause briefly, then return to a controlled stretch.'],
    breathing: 'Breathe out through the pull; breathe in as the arm returns under control.',
    tempo: '2 sec stretch · 1 sec squeeze · 2 sec return',
    commonMistakes: ['Jerking the torso to start the rep', 'Pulling only with the hand', 'Cutting off the controlled stretch'],
  },
  vertical_pull: {
    setup: ['Take a secure grip and begin with the ribs stacked over the pelvis.', 'Let the shoulder blades move naturally without hanging passively on the joints.'],
    execution: ['Pull the elbows toward the ribs while keeping the torso quiet.', 'Return to a controlled overhead position before the next rep.'],
    breathing: 'Breathe out while pulling; breathe in during the controlled return.',
    tempo: '2 sec pull · 1 sec squeeze · 2–3 sec return',
    commonMistakes: ['Swinging to create momentum', 'Pulling behind the neck', 'Stopping before a controlled overhead reach'],
  },
  squat: {
    setup: ['Set the feet where you can keep heel, big toe, and little toe grounded.', 'Brace before descending and keep the load balanced over the mid-foot.'],
    execution: ['Let the knees track with the toes while the hips descend between the legs.', 'Stand with the hips and shoulders rising together.'],
    breathing: 'Take a full breath and brace before each rep; release it after passing the hardest point.',
    tempo: '2–3 sec down · controlled depth · strong stand',
    commonMistakes: ['Losing whole-foot pressure', 'Knees collapsing inward', 'Chest and hips rising at different speeds'],
  },
  hinge: {
    setup: ['Place the load close to the body and brace before moving it.', 'Use soft knees, then send the hips backward to load the hamstrings and glutes.'],
    execution: ['Keep the load close while the hips travel backward and forward.', 'Finish tall with the glutes—do not lean back at lockout.'],
    breathing: 'Breathe in and brace before the hinge; breathe out after the hardest portion or at lockout.',
    tempo: '2–3 sec down · brief control · strong hip drive',
    commonMistakes: ['Turning the hinge into a squat', 'Letting the load drift forward', 'Overextending the lower back at lockout'],
  },
  lunge: {
    setup: ['Use a stance wide enough to balance without walking a tightrope.', 'Square the hips and distribute pressure through the working foot.'],
    execution: ['Lower with control while the knee tracks with the toes.', 'Drive through the working foot without pushing excessively from the trailing leg.'],
    breathing: 'Breathe in during the descent; breathe out as you drive up.',
    tempo: '2–3 sec down · light pause · controlled drive',
    commonMistakes: ['Using a stance that is too narrow', 'Pushing mainly from the back leg', 'Losing foot or knee alignment'],
  },
  carry: {
    setup: ['Secure the implement before standing and create full-body tension.', 'Stand tall with the ribs stacked and shoulders level.'],
    execution: ['Walk with short, quiet steps while resisting unwanted trunk movement.', 'End the set before grip or posture changes significantly.'],
    breathing: 'Use short controlled breaths without losing abdominal tension.',
    tempo: 'Steady steps · stable posture · controlled set-down',
    commonMistakes: ['Rushing the steps', 'Leaning toward or away from the load', 'Continuing after posture breaks down'],
  },
  core: {
    setup: ['Set the ribs and pelvis before beginning the movement.', 'Create tension through the trunk without holding the breath indefinitely.'],
    execution: ['Move only through the range where the trunk position stays controlled.', 'Reset tension before each repetition instead of rushing.'],
    breathing: 'Exhale through the hardest portion while keeping the ribs and pelvis controlled.',
    tempo: 'Slow reach · brief hold · controlled return',
    commonMistakes: ['Substituting lower-back movement', 'Rushing the range', 'Holding the breath for the whole set'],
  },
  isolation: {
    setup: ['Stabilize the joints above and below the target muscle.', 'Choose a load that allows the first and last rep to use the same path.'],
    execution: ['Move smoothly through the comfortable range without swinging.', 'Pause where the target muscle is shortened, then control the return.'],
    breathing: 'Breathe out during the effort; breathe in during the return.',
    tempo: '2 sec lift · 1 sec squeeze · 2–3 sec return',
    commonMistakes: ['Using momentum to finish reps', 'Changing joint position as fatigue builds', 'Selecting load over controlled range'],
  },
  cardio: {
    setup: ['Check the machine setup and safety controls before increasing effort.', 'Begin at an easy pace until movement feels coordinated.'],
    execution: ['Build effort gradually and keep a repeatable rhythm.', 'Reduce pace before technique becomes inconsistent.'],
    breathing: 'Use rhythmic breathing; shorten the interval if breathing cannot recover as planned.',
    tempo: 'Smooth build · prescribed effort · gradual recovery',
    commonMistakes: ['Starting too hard', 'Holding tension in the shoulders', 'Ignoring changes in movement quality'],
  },
}

const SPECIFIC_GUIDANCE: Record<string, Partial<ExerciseGuidance>> = {
  'barbell-bench-press': {
    setup: ['Place eyes just behind the bar, plant both feet, and keep the upper back firmly supported.', 'Use a grip that leaves the forearms vertical near the bottom; use safeties or a spotter for challenging sets.'],
    execution: ['Unrack without losing the upper-back position and lower toward the lower chest.', 'Press slightly back toward the rack while keeping the wrists stacked over the forearms.'],
    commonMistakes: ['Unracking by reaching the shoulders forward', 'Letting the elbows drift far behind the wrists', 'Bouncing the bar or lifting the hips'],
  },
  'barbell-back-squat': {
    setup: ['Set the rack just below shoulder height and center the bar across a secure upper-back shelf.', 'Step back deliberately, set the feet, then brace before unlocking the knees and hips.'],
    execution: ['Descend between the hips while keeping whole-foot pressure.', 'Drive the floor away and keep the bar traveling over the mid-foot.'],
    commonMistakes: ['Taking too many steps out of the rack', 'Relaxing at the bottom', 'Letting the bar drift toward the toes'],
  },
  'conventional-deadlift': {
    setup: ['Stand with the bar over the mid-foot, hinge down, and take slack out before the plates leave the floor.', 'Set the back and lats while keeping the bar close to the shins.'],
    execution: ['Push the floor away as the hips and shoulders rise together.', 'Stand tall, then return the bar by hinging before bending the knees.'],
    commonMistakes: ['Jerking the bar from a loose setup', 'Letting the hips shoot up first', 'Leaning back at lockout'],
  },
  'romanian-deadlift': {
    setup: ['Start tall with the load close and knees softly bent.', 'Brace, then push the hips back without adding more knee bend.'],
    execution: ['Lower until hamstring tension or torso position limits the range.', 'Drive the hips forward while keeping the load close.'],
    commonMistakes: ['Chasing floor depth', 'Letting the load travel away from the legs', 'Turning the movement into a squat'],
  },
  'barbell-overhead-press': {
    setup: ['Set the bar across the upper chest with forearms near vertical and glutes braced.', 'Move the chin back just enough to create a straight path.'],
    execution: ['Press close to the face, then bring the head through as the bar clears it.', 'Finish stacked over the mid-foot without leaning back.'],
  },
  'lat-pulldown': {
    setup: ['Lock the thighs under the pad and choose a grip that lets the elbows travel comfortably.', 'Sit tall with only a small backward lean.'],
    execution: ['Pull the elbows toward the ribs and bring the bar toward the upper chest.', 'Control the return until the lats reach a full comfortable stretch.'],
    commonMistakes: ['Turning the rep into a row', 'Pulling behind the neck', 'Releasing the weight stack between reps'],
  },
  'leg-press': {
    setup: ['Place the feet where the hips and lower back can stay supported throughout the rep.', 'Unlock the sled only after the feet and torso are secure.'],
    execution: ['Lower until the hips are about to roll away from the pad.', 'Press through the whole foot without snapping the knees into lockout.'],
    commonMistakes: ['Using depth that lifts the pelvis', 'Letting the knees collapse inward', 'Hard-locking the knees'],
  },
  'bulgarian-split-squat': {
    setup: ['Set the front foot far enough forward to keep balance through the whole foot.', 'Use the rear foot for support, not as the main driver.'],
    execution: ['Lower the back knee while the front knee tracks with the toes.', 'Drive through the front foot and keep the hips square.'],
  },
  'dumbbell-lateral-raise': {
    setup: ['Use a light load, soft elbows, and arms slightly forward of the torso.', 'Brace so the rib cage and pelvis do not move to start the rep.'],
    execution: ['Raise by leading with the elbows until the side delts are loaded.', 'Lower slowly without dropping into the bottom.'],
    commonMistakes: ['Shrugging the weight up', 'Swinging from the hips', 'Rotating the thumbs sharply downward'],
  },
}

function adjustmentFor(exercise: Exercise): string {
  if (exercise.exerciseType === 'assisted') return 'Increase assistance or shorten the range until every repetition stays controlled.'
  if (exercise.exerciseType === 'bodyweight') return 'Use an easier angle, added support, or a shorter range before sacrificing position.'
  if (exercise.exerciseType === 'duration') return 'Shorten the work interval or lower the pace when rhythm or posture changes.'
  if (exercise.exerciseType === 'distance') return 'Reduce distance or pace so the full effort uses consistent mechanics.'
  if (exercise.unilateral) return 'Use support for balance or reduce load until both sides follow the same path.'
  return 'Reduce the load 5–10% or shorten the range if the final reps no longer match the first reps.'
}

export function getExerciseGuidance(exercise: Exercise): ExerciseGuidance {
  const base = PATTERN_GUIDANCE[exercise.movementPattern]
  const specific = SPECIFIC_GUIDANCE[exercise.id] ?? {}
  return {
    ...base,
    ...specific,
    setup: specific.setup ?? base.setup,
    execution: specific.execution ?? base.execution,
    commonMistakes: specific.commonMistakes ?? base.commonMistakes,
    adjustment: specific.adjustment ?? adjustmentFor(exercise),
    safetyNote: specific.safetyNote ?? 'Stop the set if you feel sharp pain, numbness, dizziness, or cannot keep the movement controlled. Choose a comfortable variation before continuing.',
  }
}
