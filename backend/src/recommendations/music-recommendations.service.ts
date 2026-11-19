import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancion, CancionEstado } from '../musica/cancion.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { FavoriteTrack } from '../library/favorite-track.entity.js';
import { ListeningHistory } from '../history/listening-history.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { LibraryService } from '../library/library.service.js';
import { AudiusService } from '../integrations/audius/audius.service.js';
import { TrackSelectorService } from './track-selector.service.js';
import {
  CandidateTrack,
  IMusicRecommender,
  MusicRecommendationsResponse,
  RECOMMENDATION_WEIGHTS,
  RecommendedTrackItem,
} from './recommendations.types.js';

@Injectable()
export class MusicRecommendationsService implements IMusicRecommender {
  private readonly logger = new Logger(MusicRecommendationsService.name);

  constructor(
    @InjectRepository(Cancion)
    private readonly cancionesRepo: Repository<Cancion>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(FavoriteTrack)
    private readonly favoritesRepo: Repository<FavoriteTrack>,
    @InjectRepository(ListeningHistory)
    private readonly historyRepo: Repository<ListeningHistory>,
    @InjectRepository(Genero)
    private readonly generosRepo: Repository<Genero>,
    private readonly libraryService: LibraryService,
    private readonly trackSelector: TrackSelectorService,
    @Optional()
    private readonly audiusService?: AudiusService,
  ) {}

  /**
   * Genera recomendaciones musicales deterministas y explicables basadas en señales reales:
   * 1. Géneros preferidos del perfil (CU03)
   * 2. Canciones y artistas en favoritos (CU10)
   * 3. Historial de reproducciones válidas con tiempo efectivo (CU11 y CU23)
   * 4. Penalización por omisiones recientes SKIPPED (CU11)
   * 5. Similitud de contenido musical
   * 6. Filtro de diversidad artística y de canciones reproducibles
   */
  async getRecommendations(
    userId: string,
    limit: number = RECOMMENDATION_WEIGHTS.LIMITE_DEFAULT,
  ): Promise<MusicRecommendationsResponse> {
    const maxResults = Math.min(30, Math.max(1, limit || RECOMMENDATION_WEIGHTS.LIMITE_DEFAULT));

    // 1. Cargar señales reales del usuario y catálogo disponible en paralelo
    const [user, favorites, historyEntries, allGenres, localSongs] = await Promise.all([
      this.usuariosRepo.findOne({ where: { id: userId } }),
      this.favoritesRepo.find({ where: { usuarioId: userId }, take: 100 }),
      this.historyRepo.find({
        where: { usuarioId: userId },
        order: { createdAt: 'DESC' },
        take: 200,
      }),
      this.generosRepo.find({ where: { activo: true } }),
      this.cancionesRepo.find({
        where: { estado: CancionEstado.PUBLICADO },
        relations: { artista: true, genero: true },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    ]);

    // 2. Construir lista de pistas candidatas LOCALES
    const candidates: CandidateTrack[] = [];

    for (const song of localSongs) {
      // Validar si es reproducible (tiene URL de audio válida)
      const hasAudio = Boolean(song.archivoAudioUrl && song.archivoAudioUrl.trim().length > 0);
      candidates.push({
        id: song.id,
        source: 'LOCAL',
        titulo: song.titulo,
        artistaId: song.artistaId,
        artistaNombre: song.artista?.nombreArtistico || 'Artista Sonic Ledger',
        generoId: song.generoId,
        generoNombre: song.genero?.nombre || null,
        duracionSegundos: song.duracionSegundos,
        coverUrl: song.portadaUrl ? `/api/auth/catalog/${song.id}/cover` : null,
        playable: hasAudio,
      });
    }

    // 3. Obtener candidatos de Audius si el servicio está disponible
    if (this.audiusService) {
      try {
        const audiusTrending = await this.audiusService.getTrending({ limit: 20 });
        if (audiusTrending && audiusTrending.data) {
          for (const track of audiusTrending.data) {
            candidates.push({
              id: track.id,
              source: 'AUDIUS',
              titulo: track.title,
              artistaId: track.artist?.id,
              artistaNombre: track.artist?.name || 'Artista Audius',
              generoId: track.genre ? `audius:${track.genre}` : null,
              generoNombre: track.genre || null,
              duracionSegundos: track.durationSeconds,
              coverUrl: track.artworkUrl,
              playable: track.isPlayable,
            });
          }
        }
      } catch (err) {
        this.logger.debug(
          `Audius no disponible temporalmente para recomendaciones: ${(err as Error).message}`,
        );
      }
    }

    // Si no hay candidatos, devolver lista vacía
    if (candidates.length === 0) {
      return {
        items: [],
        total: 0,
        esPersonalizada: false,
        criterioPrincipal: 'Sin candidatos en el catálogo',
      };
    }

    // 4. Analizar señales del usuario
    const genreMap = new Map<string, string>();
    for (const g of allGenres) {
      genreMap.set(g.id.toLowerCase(), g.nombre.toLowerCase());
      genreMap.set(g.nombre.toLowerCase(), g.nombre.toLowerCase());
    }

    // A) Géneros preferidos del perfil (CU03)
    const rawPreferredGenreIds = user?.musicPreferences?.genreIds || [];
    const preferredGenresSet = new Set<string>();
    for (const gid of rawPreferredGenreIds) {
      preferredGenresSet.add(gid.toLowerCase());
      const name = genreMap.get(gid.toLowerCase());
      if (name) preferredGenresSet.add(name);
    }

    // B) Favoritos (CU10)
    const favoriteTrackIds = new Set<string>(
      favorites.map((f) => f.trackId.toLowerCase()),
    );

    // C) Resolver favoritos para extraer artistas y géneros de pistas favoritas
    const favoriteArtistNames = new Set<string>();
    const favoriteArtistIds = new Set<string>();
    const favoriteGenres = new Set<string>();

    if (favorites.length > 0) {
      try {
        const resolvedFavs = await this.libraryService.resolveTracks(
          favorites.slice(0, 50).map((f) => ({ trackId: f.trackId, source: f.source })),
        );
        for (const fav of resolvedFavs) {
          if (fav.artista?.nombre) {
            favoriteArtistNames.add(fav.artista.nombre.toLowerCase().trim());
          }
          if (fav.artista?.id) {
            favoriteArtistIds.add(fav.artista.id.toLowerCase());
          }
          if (fav.genero?.nombre) {
            favoriteGenres.add(fav.genero.nombre.toLowerCase().trim());
          }
          if (fav.genero?.id) {
            favoriteGenres.add(fav.genero.id.toLowerCase());
          }
        }
      } catch (e) {
        this.logger.debug(`No se pudieron resolver metadatos completos de favoritos: ${e}`);
      }
    }

    // D) Historial de reproducciones válidas y omisiones (CU11 y CU23)
    const validPlays = historyEntries.filter(
      (h) => h.eventType === 'PLAYED' && h.listenedSeconds > 0,
    );
    const skippedPlays = historyEntries.filter((h) => h.eventType === 'SKIPPED');

    const validPlaysCountByTrack = new Map<string, number>();
    const validPlaysCountByArtist = new Map<string, number>();
    const listenedSecondsByArtist = new Map<string, number>();
    const validPlaysCountByGenre = new Map<string, number>();

    const skippedTrackIds = new Set<string>(
      skippedPlays.map((s) => s.trackId.toLowerCase()),
    );

    if (validPlays.length > 0) {
      try {
        const resolvedHistory = await this.libraryService.resolveTracks(
          validPlays.slice(0, 80).map((h) => ({ trackId: h.trackId, source: h.source })),
        );

        for (let i = 0; i < resolvedHistory.length; i++) {
          const track = resolvedHistory[i];
          const hist = validPlays[i];
          const seconds = hist ? hist.listenedSeconds || 0 : 0;

          // Por pista
          const trackKey = track.id.toLowerCase();
          validPlaysCountByTrack.set(
            trackKey,
            (validPlaysCountByTrack.get(trackKey) || 0) + 1,
          );

          // Por artista
          if (track.artista?.nombre) {
            const artistKey = track.artista.nombre.toLowerCase().trim();
            validPlaysCountByArtist.set(
              artistKey,
              (validPlaysCountByArtist.get(artistKey) || 0) + 1,
            );
            listenedSecondsByArtist.set(
              artistKey,
              (listenedSecondsByArtist.get(artistKey) || 0) + seconds,
            );
          }

          // Por género
          if (track.genero?.nombre) {
            const genreKey = track.genero.nombre.toLowerCase().trim();
            validPlaysCountByGenre.set(
              genreKey,
              (validPlaysCountByGenre.get(genreKey) || 0) + 1,
            );
          }
        }
      } catch (e) {
        this.logger.debug(`No se pudieron resolver metadatos completos de historial: ${e}`);
      }
    }

    // 5. Gestión de Cold Start (usuario nuevo o sin historial/preferencias)
    const hasPreferences = preferredGenresSet.size > 0;
    const hasFavorites = favorites.length > 0;
    const hasHistory = validPlays.length > 0;
    const isPersonalized = hasPreferences || hasFavorites || hasHistory;

    if (!isPersonalized) {
      // Seleccionar descubrimiento general con diversidad artística
      const discoveryTracks = this.trackSelector.selectTracks(candidates, {
        soloPlayable: true,
        maxPorArtista: RECOMMENDATION_WEIGHTS.MAX_POR_ARTISTA_DEFAULT,
        limite: maxResults,
      });

      const coldStartItems: RecommendedTrackItem[] = discoveryTracks.map((track) => ({
        id: track.id,
        source: track.source,
        titulo: track.titulo,
        artista: { id: track.artistaId, nombre: track.artistaNombre },
        genero: track.generoNombre
          ? { id: track.generoId || '', nombre: track.generoNombre }
          : null,
        duracionSegundos: track.duracionSegundos ?? null,
        coverUrl: track.coverUrl ?? null,
        score: 50,
        motivosRecomendacion: [
          'Descubrimiento general en Sonic Ledger. ¡Personaliza tu perfil o escucha canciones para recomendaciones a tu medida!',
        ],
        playable: track.playable,
      }));

      return {
        items: coldStartItems,
        total: coldStartItems.length,
        esPersonalizada: false,
        criterioPrincipal: 'Descubrimiento general (sin señales previas del usuario)',
      };
    }

    // 6. Puntuación y Ranking Determinista (Content-Based Affinity)
    interface ScoredCandidate {
      candidate: CandidateTrack;
      score: number;
      reasons: string[];
    }

    const scoredList: ScoredCandidate[] = [];

    for (const candidate of candidates) {
      // Excluir canciones no reproducibles de las recomendaciones
      if (!candidate.playable) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      const candidateTrackKey = candidate.id.toLowerCase();
      const candidateArtistKey = candidate.artistaNombre.toLowerCase().trim();
      const candidateArtistId = candidate.artistaId?.toLowerCase();
      const candidateGenreId = candidate.generoId?.toLowerCase();
      const candidateGenreName = candidate.generoNombre?.toLowerCase().trim();

      // Señal 1: Coincidencia con géneros preferidos (CU03)
      let matchesPreferredGenre = false;
      if (candidateGenreId && preferredGenresSet.has(candidateGenreId)) {
        matchesPreferredGenre = true;
      } else if (candidateGenreName && preferredGenresSet.has(candidateGenreName)) {
        matchesPreferredGenre = true;
      }

      if (matchesPreferredGenre) {
        score += RECOMMENDATION_WEIGHTS.GENERO_PREFERIDO;
        reasons.push(
          `Porque te gusta el género ${candidate.generoNombre || 'seleccionado'}`,
        );
      }

      // Señal 2: Canción favorita (CU10)
      if (favoriteTrackIds.has(candidateTrackKey)) {
        score += RECOMMENDATION_WEIGHTS.CANCION_FAVORITA;
        reasons.push('Está en tu lista de canciones favoritas');
      }

      // Señal 3: Artista favorito (CU10)
      const isArtistInFavorites =
        favoriteArtistNames.has(candidateArtistKey) ||
        (candidateArtistId && favoriteArtistIds.has(candidateArtistId));
      if (isArtistInFavorites) {
        score += RECOMMENDATION_WEIGHTS.ARTISTA_FAVORITO;
        reasons.push(`Por artistas en tus favoritos: ${candidate.artistaNombre}`);
      }

      // Señal 4: Artista en historial de reproducción válida (CU11)
      const artistPlays = validPlaysCountByArtist.get(candidateArtistKey) || 0;
      if (artistPlays > 0) {
        score += RECOMMENDATION_WEIGHTS.ARTISTA_HISTORIAL;
        reasons.push(`Has escuchado a ${candidate.artistaNombre}`);

        // Frecuencia alta (>= 3 reproducciones completas)
        if (artistPlays >= 3) {
          score += RECOMMENDATION_WEIGHTS.HISTORIAL_FRECUENTE;
          reasons.push(
            `Artista frecuente en tu historial (${artistPlays} reproducciones)`,
          );
        }
      }

      // Señal 5: Tiempo efectivo escuchado del artista (segundos)
      const artistSeconds = listenedSecondsByArtist.get(candidateArtistKey) || 0;
      if (artistSeconds >= 120) {
        score += RECOMMENDATION_WEIGHTS.TIEMPO_ESCUCHADO;
        const minutes = Math.floor(artistSeconds / 60);
        reasons.push(`Más de ${minutes} min escuchados de este artista`);
      }

      // Señal 6: Coincidencia con género escuchado frecuentemente
      if (candidateGenreName && (validPlaysCountByGenre.get(candidateGenreName) || 0) >= 2) {
        score += RECOMMENDATION_WEIGHTS.GENERO_HISTORIAL;
        reasons.push(`Género frecuente en tu historial reciente`);
      }

      // Señal 7: Penalización por omisión SKIPPED (CU11)
      // SKIPPED no equivale a reproducción completa y reduce el ranking
      if (skippedTrackIds.has(candidateTrackKey)) {
        score -= RECOMMENDATION_WEIGHTS.PENALIZACION_SKIPPED_CANCION;
      }

      // Si no hubo ningún motivo específico pero la canción es candidata
      if (reasons.length === 0) {
        reasons.push('Recomendado para explorar nueva música');
        score += 10;
      }

      // Normalizar el score entre 0 y 100
      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      scoredList.push({
        candidate,
        score: finalScore,
        reasons,
      });
    }

    // 7. Ordenar de forma estrictamente determinista: mayor score primero, luego título y ID
    scoredList.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const titleComp = a.candidate.titulo.localeCompare(b.candidate.titulo);
      if (titleComp !== 0) {
        return titleComp;
      }
      return a.candidate.id.localeCompare(b.candidate.id);
    });

    // 8. Aplicar control de diversidad artística (máximo 2 canciones por artista)
    const selectedItems: RecommendedTrackItem[] = [];
    const artistOccurrences = new Map<string, number>();

    for (const item of scoredList) {
      const artistKey =
        item.candidate.artistaId || item.candidate.artistaNombre.toLowerCase().trim();
      const currentCount = artistOccurrences.get(artistKey) || 0;

      if (currentCount >= RECOMMENDATION_WEIGHTS.MAX_POR_ARTISTA_DEFAULT) {
        continue;
      }

      artistOccurrences.set(artistKey, currentCount + 1);
      selectedItems.push({
        id: item.candidate.id,
        source: item.candidate.source,
        titulo: item.candidate.titulo,
        artista: {
          id: item.candidate.artistaId,
          nombre: item.candidate.artistaNombre,
        },
        genero: item.candidate.generoNombre
          ? {
              id: item.candidate.generoId || '',
              nombre: item.candidate.generoNombre,
            }
          : null,
        duracionSegundos: item.candidate.duracionSegundos ?? null,
        coverUrl: item.candidate.coverUrl ?? null,
        score: item.score,
        motivosRecomendacion: item.reasons,
        playable: item.candidate.playable,
      });

      if (selectedItems.length >= maxResults) {
        break;
      }
    }

    return {
      items: selectedItems,
      total: selectedItems.length,
      esPersonalizada: true,
      criterioPrincipal: 'Afinidad por preferencias, favoritos e historial de escucha',
    };
  }
}
