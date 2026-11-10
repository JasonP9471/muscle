# Exercise illustration accuracy audit

Audit date: 2026-10-12

All 231 TrainOS exercise sequences were reviewed in labeled contact sheets. The review
checked whether each visual matched the exercise's equipment, grip, stance, loading,
body position, machine orientation, unilateral or bilateral setup, and start/finish
positions.

## Result

- 231 of 231 library entries reviewed.
- 170 public-domain source sequences retained because they are direct matches or naming
  equivalents.
- 61 approximate source matches replaced with exercise-specific TrainOS sequences.
- 9 existing custom sequences re-reviewed and retained.
- 70 total custom sequences are now produced from versioned source sheets.

## Corrected variants

### Pressing and shoulders

Spoto press, standing barbell overhead press, standing dumbbell shoulder press,
neutral-grip dumbbell shoulder press, Z press, Arnold press, standing kettlebell strict
press, half-kneeling kettlebell press, pike push-up, cable lateral raise, leaning cable
lateral raise, resistance-band face pull, and deficit push-up.

### Pulling and upper back

Standard pull-up, neutral-grip pull-up, wide-grip pull-up, assisted pull-up, assisted
chin-up, resistance-band pulldown, Pendlay row, dumbbell gorilla row, resistance-band
row, and prone Y raise.

### Squat and lunge variants

Dumbbell goblet squat, dumbbell front squat, Smith-machine front squat, reverse hack
squat, single-leg press, narrow-stance leg press, wide-stance leg press, Spanish squat,
dumbbell Bulgarian split squat, bodyweight Bulgarian split squat, front-foot-elevated
split squat, dumbbell lateral lunge, dumbbell curtsy lunge, and lateral step-up.

### Posterior chain and lower leg

Resistance-band leg extension, single-leg dumbbell Romanian deadlift, kettlebell
Romanian deadlift, two-hand kettlebell swing, dumbbell hip thrust, single-leg hip thrust
on a bench, Nordic hamstring curl, resistance-band kickback, standing single-leg dumbbell
calf raise, bodyweight calf raise, and tibialis raise.

### Arms, core, carries, and conditioning

Bayesian cable curl, resistance-band curl, flat-bench dumbbell skull crusher, single-arm
cable pushdown, resistance-band pushdown, front plank, hanging knee raise, ab-wheel
rollout, resistance-band Pallof press, suitcase carry, single-arm dumbbell overhead carry,
incline treadmill walk, and stationary-bike sprint intervals.

## Reproduction

Run `node scripts/build-exercise-illustrations.mjs` to rebuild the optimized WebP
sequences. Run `node scripts/generate-illustration-audit-sheets.mjs <output-directory>`
to regenerate the labeled 231-item review sheets.
