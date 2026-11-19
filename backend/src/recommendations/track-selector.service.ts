import { Injectable } from '@nestjs/common';
import type {
  CandidateTrack,
  ITrackSelector,
  TrackSelectorConstraints,
} from './recommendations.types.js';

/**
 * Selector determinista de canciones que implementa el contrato reutilizable ITrackSelector.
 * Preparado para ser utilizado por los módulos de DJ (CU13 y CU14).
 *
 * Garantías:
 * - Devuelve ÚNICAMENTE canciones existentes en el conjunto de candidatas.
 * - Nunca inventa canciones, artistas ni metadatos.
 * - Aplica filtros de reproducción (solo canciones reproducibles).
 * - Controla diversidad artística (max canciones por artista).
 */
@Injectable()
export class TrackSelectorService implements ITrackSelector {
  selectTracks(
    candidates: CandidateTrack[],
    constraints: TrackSelectorConstraints = {},
  ): CandidateTrack[] {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    const {
      generos,
      artistasExcluidos = [],
      cancionesExcluidas = [],
      duracionMinimaSegundos,
      duracionMaximaSegundos,
      soloPlayable = true,
      maxPorArtista = 2,
      limite = 10,
    } = constraints;

    // Conjuntos para búsqueda rápida en O(1)
    const excludedSongsSet = new Set(cancionesExcluidas.map((id) => id.toLowerCase()));
    const excludedArtistsSet = new Set(
      artistasExcluidos.map((a) => a.toLowerCase().trim()),
    );
    const targetGenresSet = generos
      ? new Set(generos.map((g) => g.toLowerCase().trim()))
      : null;

    // 1. Filtrado estricto
    const filtered = candidates.filter((track) => {
      // Excluir canciones no reproducibles
      if (soloPlayable && !track.playable) {
        return false;
      }

      // Excluir canciones marcadas
      if (excludedSongsSet.has(track.id.toLowerCase())) {
        return false;
      }

      // Excluir artistas marcados (por ID o por nombre)
      if (
        (track.artistaId && excludedArtistsSet.has(track.artistaId.toLowerCase())) ||
        excludedArtistsSet.has(track.artistaNombre.toLowerCase().trim())
      ) {
        return false;
      }

      // Restricciones de duración
      if (
        track.duracionSegundos != null &&
        duracionMinimaSegundos != null &&
        track.duracionSegundos < duracionMinimaSegundos
      ) {
        return false;
      }
      if (
        track.duracionSegundos != null &&
        duracionMaximaSegundos != null &&
        track.duracionSegundos > duracionMaximaSegundos
      ) {
        return false;
      }

      // Filtro de géneros si se especificaron
      if (targetGenresSet && targetGenresSet.size > 0) {
        const matchesGenreId = track.generoId && targetGenresSet.has(track.generoId.toLowerCase());
        const matchesGenreName =
          track.generoNombre && targetGenresSet.has(track.generoNombre.toLowerCase().trim());
        if (!matchesGenreId && !matchesGenreName) {
          return false;
        }
      }

      return true;
    });

    // 2. Control de diversidad artística (evitar repetir excesivamente un mismo artista)
    const selected: CandidateTrack[] = [];
    const artistCounts = new Map<string, number>();

    for (const track of filtered) {
      const artistKey = track.artistaId || track.artistaNombre.toLowerCase().trim();
      const currentCount = artistCounts.get(artistKey) || 0;

      if (maxPorArtista > 0 && currentCount >= maxPorArtista) {
        continue;
      }

      artistCounts.set(artistKey, currentCount + 1);
      selected.push(track);

      if (limite > 0 && selected.length >= limite) {
        break;
      }
    }

    return selected;
  }
}
