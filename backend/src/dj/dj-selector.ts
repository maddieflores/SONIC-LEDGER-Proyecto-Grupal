import { BadRequestException } from '@nestjs/common';
import type { DjConstraints } from './dj.types.js';
import type { ResolvedTrack as CatalogSong } from '../library/library.service.js';
import { genreKey } from './intent.js';
import { TrackSelectorService } from '../recommendations/track-selector.service.js';
export function selectDjTracks(
  pool: CatalogSong[],
  constraints: DjConstraints,
  favorites: CatalogSong[] = [],
) {
  if (
    constraints.mood &&
    constraints.mood !== 'none' &&
    (!constraints.genres || constraints.genres.length === 0)
  )
    throw new BadRequestException(
      'El catálogo no dispone de metadatos confiables de energía o calma. Reformula o quita explícitamente esa restricción.',
    );
  const favoriteGenres = new Set(
    favorites.flatMap((t) => (t.genero ? [genreKey(t.genero.nombre)] : [])),
  );
  const favoriteArtists = new Set(
    favorites.map((t) => t.artista.id).filter(Boolean),
  );
  const seen = new Set<string>();
  const compatible = pool.filter((t) => {
    const key = `${t.source}:${t.id}`;
    if (!t.playable || seen.has(key)) return false;
    seen.add(key);
    const genre = t.genero ? genreKey(t.genero.nombre) : null;
    if (
      (constraints.genres?.length || constraints.excludedGenres?.length) &&
      !genre
    )
      return false;
    if (
      constraints.genres?.length &&
      !constraints.genres.some((g) => genreKey(g) === genre)
    )
      return false;
    if (constraints.excludedGenres?.some((g) => genreKey(g) === genre))
      return false;
    if (
      constraints.favorites &&
      !favoriteGenres.has(genre || '') &&
      !favoriteArtists.has(t.artista.id)
    )
      return false;
    return true;
  });
  const originals = new Map(compatible.map((t) => [t.source + ':' + t.id, t]));
  return new TrackSelectorService()
    .selectTracks(
      compatible.map((t) => ({
        id: t.id,
        source: t.source,
        titulo: t.titulo,
        artistaId: t.artista.id,
        artistaNombre: t.artista.nombre,
        generoNombre: t.genero?.nombre,
        playable: t.playable,
        duracionSegundos: t.duracionSegundos,
      })),
      { soloPlayable: true, maxPorArtista: 0, limite: 0 },
    )
    .map((t) => originals.get(t.source + ':' + t.id)!);
}
