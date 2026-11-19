/**
 * Reglas centralizadas para determinar si una sesión de escucha
 * constituye una reproducción válida (PLAYED) o una omisión (SKIPPED).
 */

export const PLAYBACK_THRESHOLD_SECONDS = 30;
export const SHORT_TRACK_THRESHOLD_RATIO = 0.5;

/**
 * Evalúa si una escucha califica como reproducción válida:
 * - >= 30 segundos de escucha activa real.
 * - Si la duración es < 30 segundos, >= 50% de su duración total.
 */
export function isValidPlayback(
  listenedSeconds: number,
  trackDurationSeconds?: number | null,
): boolean {
  if (listenedSeconds <= 0) return false;

  if (
    typeof trackDurationSeconds === 'number' &&
    trackDurationSeconds > 0 &&
    trackDurationSeconds < PLAYBACK_THRESHOLD_SECONDS
  ) {
    return listenedSeconds >= trackDurationSeconds * SHORT_TRACK_THRESHOLD_RATIO;
  }

  return listenedSeconds >= PLAYBACK_THRESHOLD_SECONDS;
}

/**
 * Determina el tipo de evento (PLAYED o SKIPPED) en base a los segundos escuchados
 * y la duración conocida de la pista.
 */
export function determineEventType(
  listenedSeconds: number,
  trackDurationSeconds?: number | null,
): 'PLAYED' | 'SKIPPED' {
  return isValidPlayback(listenedSeconds, trackDurationSeconds)
    ? 'PLAYED'
    : 'SKIPPED';
}
