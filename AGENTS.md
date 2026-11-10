# TrainOS Engineering Guide

## Architecture

- React + TypeScript + Vite progressive web application.
- Domain logic lives in `src/algorithms`, tunable values in `src/config`, and local persistence in `src/db`.
- UI components do not contain workout-programming, recovery, progression, records, or analytics calculations.
- IndexedDB is the source of truth for durable user data. Zustand holds transient application UI state only.
- All user data remains local and no runtime analytics, trackers, or external APIs are permitted.

## Coding Standards

- Use strict TypeScript and avoid `any`.
- Prefer small pure functions and typed domain models.
- Keep components accessible, responsive from 320px upward, and touch friendly.
- Use semantic HTML, visible focus states, descriptive accessible labels, and reduced-motion-safe animation.
- Every rendered control must perform its advertised action. Remove unusable controls rather than stubbing them.
- Do not leave TODOs, placeholders, commented-out implementations, or knowingly unfinished routes.

## Testing

- Unit-test recovery, workout generation, scoring, duration, progression, strength, records, streaks, and analytics.
- Add integration coverage for IndexedDB-backed active workout persistence.
- Maintain Playwright coverage for onboarding, workout generation/editing/logging/completion, recovery/history/stat changes, persistence, and export.
- After material changes run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Run the critical Playwright suite and responsive visual checks before release.

## Product Rules

- Programming recommendations are deterministic, explainable heuristics—not medical claims or guarantees.
- Respect equipment, excluded movements, session duration, recovery, split, goal, experience, and preferences.
- Historical workout edits and deletes must trigger derived-stat and muscle-state recomputation.
- Persist active workouts after every meaningful edit so refreshes never discard a session.

