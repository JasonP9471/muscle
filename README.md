# TrainOS

**Training. Nutrition. Progress.**

TrainOS is a mobile-first fitness operating system that combines deterministic adaptive training, nutrition tracking, recovery, bodyweight trends, and explainable daily coaching in one installable PWA.

The existing React/Vite architecture was intentionally preserved. IndexedDB remains the immediate source of truth so workouts and food logs stay usable with poor reception. Optional Supabase and OpenAI providers add accounts, private photo storage, and live meal analysis without making credentials mandatory.

TrainOS is an independent product and is not affiliated with Fitbod, Kalo, or any other fitness application.

## Feature overview

### Unified home

- Daily calorie and macro progress.
- Adaptive workout summary and start action.
- Major-muscle recovery snapshot.
- Current bodyweight, 7-day average, and weekly change.
- Workout and nutrition streaks.
- Rule-driven TrainOS Coach recommendations joining training, nutrition, recovery, and weight trends.

### Nutrition

- Breakfast, lunch, dinner, and snack logging.
- Manual food search and custom foods.
- Editable natural-language meal analysis.
- Editable meal-photo analysis with confidence and estimation warnings.
- Voice transcription where the browser supports the Web Speech API, with a typed-transcript fallback.
- UPC/EAN lookup with an offline catalog and optional Open Food Facts provider.
- Favorites, recent foods, saved meals, and one-tap repeat logging.
- BMR, TDEE, calorie, and macro estimates separated from UI code.
- Adherence-gated weekly calorie recommendations that require user approval.

### Training

- 231 structured exercises across all major muscle groups and equipment categories.
- Deterministic generation from goal, experience, equipment, split, duration, recovery, preferences, recent exercise use, and performance.
- Editable sessions, replacements, supersets, templates, set prescriptions, RIR, notes, and rest timers.
- Input validation prevents incomplete weighted sets from entering progression or recovery calculations.
- Autosaved active sessions and complete normalized history.
- Per-muscle fatigue/recovery, progressive overload, estimated 1RM, PRs, and weekly volume.

### Progress and profile

- Bodyweight and 7-day-average charts across 1M, 3M, 6M, 1Y, and All ranges.
- Calorie, macro, strength, volume, and consistency charts.
- Weekly energy, hunger, performance, and recovery check-ins.
- Compressed private progress photos stored locally and optionally uploaded to private Supabase buckets.
- Multiple gym/equipment profiles with one active generation environment.
- Manual nutrition target overrides, appearance settings, export/import, and reset controls.

## Architecture

```text
sites/                       Sites Worker and authenticated nutrition endpoint
src/
  algorithms/
    adaptiveCoach/           Rule-driven cross-domain recommendations
    nutrition/               BMR, TDEE, macros, trends, adherence, adjustments
    recovery/                Muscle fatigue and time recovery
    workoutGenerator/        Deterministic exercise/session programming
    progression/             Next-load recommendations
    strength/                Volume and estimated 1RM
  components/
    nutrition/               Logging and macro components
    progress/                Check-in and private-photo UI
  config/                    Brand and tunable programming values
  data/                      Local exercise and food catalogs
  db/                        Versioned Dexie schema and backup handling
  pages/                     Home, Train, Nutrition, Progress, Profile, Auth
  services/
    aiNutrition/             Authenticated provider boundary and response validation
    auth/                    Supabase REST Auth plus demo provider
    foodDatabase/            Barcode provider plus offline fallback
    storage/                 Private Supabase storage plus local mode
    sync/                    Ordered authenticated cloud snapshot upload
supabase/
  migrations/                Normalized schema, indexes, RLS, and private buckets
  seed.sql                   Starter system equipment and foods
  tests/                     RLS smoke assertions
ios/                         Capacitor iPhone/iPad shell
android/                     Capacitor Android shell
```

React components do not own training or nutrition calculations. IndexedDB mutations are normalized and atomic. The OpenAI secret is read only by the Sites Worker at runtime; Vite never exposes it because it has no `VITE_` prefix.

## Install and run

Requirements: Node.js 22 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The app works without external credentials. Complete onboarding, or use **Profile → Advanced settings → Load demo data** to populate realistic training, nutrition, and bodyweight history.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

Browser-safe optional values:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ENABLE_CLOUD_SYNC=false
VITE_ENABLE_FOOD_DATABASE=false
VITE_DEMO_MODE=true
```

Server-only values:

```bash
OPENAI_API_KEY=
OPENAI_NUTRITION_MODEL=gpt-4.1-mini
```

Never expose a Supabase service-role key or `OPENAI_API_KEY` through a `VITE_` variable.

## Supabase setup

The migration creates user-owned profiles, goals, preferences, gym profiles, workouts, sets, recovery, meals, foods, targets, weight logs, measurements, photos, check-ins, PRs, and recommendations. Every exposed user table has RLS, explicit grants, and separate ownership policies for select, insert, update, and delete. System exercises/equipment are read-only. Meal and progress-photo buckets are private.

With a current Supabase CLI and a project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For a local Supabase environment, initialize the CLI configuration if needed, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Set the project URL and publishable key in `.env.local`. The browser must never receive a secret/service-role key.

Set `VITE_ENABLE_CLOUD_SYNC=true` to expose the opt-in cloud snapshot controls. IndexedDB remains the write-first source of truth; completed workouts, nutrition, weight, recovery, records, and private-photo metadata upload in foreign-key-safe order when the user chooses **Back up now** or the enabled app reconnects.

## AI nutrition setup

`src/services/aiNutrition/` owns the client contract. It requires an authenticated account, validates every live response with Zod, and never turns a failed photo request into invented food data.

`sites/nutrition-api.js` is mounted by the Sites Worker at `/api/analyze-nutrition`. It accepts bounded text or JPEG/PNG/WebP image input, authenticates Sites or Supabase users, rate limits by a SHA-256 hash of the stable user identity, calls the OpenAI Responses API server-side, validates structured output, recalculates totals, and returns only editable meal data. Every estimated meal must be reviewed before saving.

Nutrition limits are stored in the Sites D1 `DB` binding through the `nutrition_rate_limits` migration. The atomic upsert survives Worker restarts and concurrent instances. If D1 is unavailable, analysis fails closed with a temporary-unavailable response instead of falling back to an in-memory limiter.

The Worker returns an authenticated availability response to the client. When `OPENAI_API_KEY` is missing or the provider cannot run, photo analysis is disabled and the user is directed to manual logging.

To package the Sites Worker locally:

```bash
npm run build:site
```

Configure `OPENAI_API_KEY` as a secret production runtime variable in Sites. Keep it server-only. `OPENAI_NUTRITION_MODEL` is optional and defaults to `gpt-4.1-mini`.

## Barcode architecture

Barcode capture uses the browser `BarcodeDetector` API against a camera/photo on supported devices and retains manual UPC/EAN entry everywhere. Lookup first checks a small offline development catalog. With `VITE_ENABLE_FOOD_DATABASE=true`, unknown codes query Open Food Facts. Unknown products, incomplete nutrition, and network errors preserve a working manual-food path.

## Demo data

The explicit **Load demo data** action seeds:

- 15 realistic Push/Pull/Legs workouts with progressive loads;
- 14 days of breakfast, lunch, snack, and dinner logs;
- protein shakes, chicken/rice bowls, salmon meals, and breakfast foods;
- 14 days of weight history; and
- a reusable Breakfast Shake.

Demo records are never injected into ordinary production flows.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
npm run build
npm run preview
```

The unit suite covers recovery, workout generation, progression, duration, strength, records, analytics, BMR/TDEE, macro allocation, moving averages, calorie adjustment, adaptive recommendations, AI fallback structure, set validation, and IndexedDB persistence.

## Build and install

```bash
npm run build
npm run preview
```

The deployable PWA is written to `dist/` with a generated service worker, manifest, maskable icon, and offline precache. Deploy over HTTPS and choose **Install app** or **Add to Home Screen** on a supported device.

The same React/Vite application now ships inside Capacitor iOS and Android projects. Native builds add direct camera/photo capture, set-completion haptics, safe-area layout, branded icons and launch screens, and opt-in lock-screen rest alerts. Service-worker registration is disabled inside the native shell because the embedded app bundle is already local.

```bash
npm run mobile:sync
npm run ios:open
# or, with Android Studio and a JDK installed:
npm run android:open
```

See [MOBILE.md](./MOBILE.md) for physical-device, signing, tester-distribution, privacy, and rebranding notes.

## External-service limitations

- Supabase authentication, database policies, and private storage require a configured Supabase project and migration deployment.
- Live OpenAI analysis requires a server-capable host and API access; deterministic text/photo demo analysis remains available without it.
- Nutrition analysis is authenticated, input/output validated, rate limited per user, and fails closed when its provider is unavailable.
- The current Supabase sync is an opt-in upload snapshot; cross-device merge, server-to-device restore, session refresh, and delete tombstones are not yet implemented.
- Browser voice recognition and camera barcode detection vary by device/browser. Native meal/progress photos, haptics, and local rest notifications use Capacitor plugins.
- Food-photo nutrition is inherently estimated and must be reviewed.
- Recovery, calorie, macro, and adaptive outputs are transparent fitness heuristics, not medical advice or guarantees.
