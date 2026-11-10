export function getExerciseIllustrationUrl(exerciseId: string, baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl.replace(/\/?$/, '/')}exercise-guides/library/${exerciseId}.webp`
}
