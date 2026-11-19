import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Heart,
  Music2,
  Play,
  Search,
  UserRound,
} from 'lucide-react';
import { SonicSidebar } from './components/SonicSidebar';
import { usePlayback } from './PlaybackContext';
import { request } from './auth-api';
import {
  catalogCoverUrl,
  catalogDuration,
  catalogRequest,
  type CatalogPage,
  type CatalogSong,
} from '../../shared/catalog';
import {
  fetchMusicRecommendations,
} from '../../shared/recommendations-api';
import type {
  MusicRecommendationsResponse,
  RecommendedTrackItem,
} from '../../shared/recommendations';
import {
  fetchUserPlaylists,
  fetchUserFavoriteIds,
  toggleFavorite,
} from '../../shared/library-api';
import type { PlaylistSummary } from '../../shared/library';
import type { Profile } from '../../shared/profile';
import { getApiBaseUrl } from './auth-api';
import './Dashboard.css';

const base = getApiBaseUrl();

export function Dashboard() {
  const navigate = useNavigate();
  const { play } = usePlayback();

  // User & Profile
  const [profile, setProfile] = useState<Profile | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Sections data
  const [recommendations, setRecommendations] = useState<CatalogSong[]>([]);
  const [popularSongs, setPopularSongs] = useState<CatalogSong[]>([]);
  const [trendingSongs, setTrendingSongs] = useState<CatalogSong[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistSummary[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Banner state
  const [isBannerFav, setIsBannerFav] = useState(false);

  // Carousel refs for scrolling
  const popularScrollRef = useRef<HTMLDivElement>(null);
  const releasesScrollRef = useRef<HTMLDivElement>(null);

  // Load user token & initial data
  const loadData = useCallback(async () => {
    const token = localStorage.getItem('token') || undefined;

    // 1. User Profile
    try {
      const p = await request<Profile>('profile', undefined, token);
      setProfile(p);
    } catch {
      // Si no hay perfil activo o expira token
    }

    // 2. Favorites check
    try {
      const favIds = await fetchUserFavoriteIds(base, token);
      setFavoriteIds(new Set(favIds));
    } catch {
      // Ignorar fallback
    }

    // 3. CU12: Recommendations for Discover Weekly & Made for You
    try {
      const recRes: MusicRecommendationsResponse = await fetchMusicRecommendations(base, token, 15);
      if (recRes && recRes.items && recRes.items.length > 0) {
        const mapped: CatalogSong[] = recRes.items.map((it: RecommendedTrackItem) => ({
          id: it.id,
          source: it.source,
          titulo: it.titulo,
          artista: {
            id: it.artista.id || '',
            nombre: it.artista.nombre,
          },
          genero: it.genero,
          duracionSegundos: it.duracionSegundos,
          descripcion: 'Recomendación personalizada',
          coverUrl: it.coverUrl,
          playable: it.playable,
        }));
        setRecommendations(mapped);
      }
    } catch {
      // Fallback
    }

    // 4. Popular & Trending (Catalog)
    try {
      const catData = await catalogRequest<CatalogPage>(base, '?pageSize=16', token);
      if (catData && catData.items) {
        setPopularSongs(catData.items.slice(0, 8));
        setTrendingSongs(catData.items.slice(0, 3));
      }
    } catch {
      // Fallback
    }

    // 5. Nuevos Lanzamientos (Releases)
    try {
      const relData = await catalogRequest<any>(base, '/releases?pageSize=10', token);
      if (relData && relData.items && relData.items.length > 0) {
        setNewReleases(relData.items);
      }
    } catch {
      // Fallback
    }

    // 6. Playlists (CU09)
    try {
      const pls = await fetchUserPlaylists(base, token);
      setUserPlaylists(pls);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explorar?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explorar');
    }
  };

  // Toggle Song Favorite
  const handleToggleFavorite = async (song: CatalogSong) => {
    const isFav = favoriteIds.has(song.id);
    const token = localStorage.getItem('token') || undefined;
    try {
      await toggleFavorite(base, song.id, isFav, song.source, token);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
    } catch {
      // Error silencioso
    }
  };

  // Discover Weekly Play
  const handlePlayDiscoverWeekly = () => {
    const queue = recommendations.length > 0 ? recommendations : popularSongs;
    if (queue.length > 0) {
      play(queue[0], queue);
    }
  };

  // Scroll carousels
  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const distance = 260;
      ref.current.scrollBy({
        left: direction === 'left' ? -distance : distance,
        behavior: 'smooth',
      });
    }
  };

  // Helper for Made for You mixes
  const mfyMix1 = recommendations.slice(0, 6);
  const mfyMix2 = popularSongs.slice(0, 6);

  // Play a specific playlist or queue
  const handlePlayQueue = (trackList: CatalogSong[]) => {
    if (trackList.length > 0) {
      play(trackList[0], trackList);
    }
  };

  // Top daily playlists source (user playlists + fallback to curated catalog mixes)
  const topPlaylists = userPlaylists.length > 0
    ? userPlaylists.slice(0, 3).map((p) => ({
        id: p.id,
        titulo: p.nombre,
        sub: `Por Sonic Ledger • ${p.trackCount} ${p.trackCount === 1 ? 'canción' : 'canciones'}`,
        coverUrl: p.firstTrackId ? `/api/auth/catalog/${p.firstTrackId}/cover` : null,
        tracks: [] as CatalogSong[],
      }))
    : [
        {
          id: 'top-1',
          titulo: 'Starlit Reverie',
          sub: 'Por Sonic Ledger • 24 canciones',
          coverUrl: popularSongs[0]?.coverUrl || null,
          tracks: popularSongs,
        },
        {
          id: 'top-2',
          titulo: 'Midnight Confessions',
          sub: 'Por Sonic Ledger • 18 canciones',
          coverUrl: recommendations[1]?.coverUrl || popularSongs[1]?.coverUrl || null,
          tracks: recommendations.length > 0 ? recommendations : popularSongs,
        },
        {
          id: 'top-3',
          titulo: 'Vibes de Oficina',
          sub: 'Por Sonic Ledger • 30 canciones',
          coverUrl: popularSongs[2]?.coverUrl || null,
          tracks: popularSongs,
        },
      ];

  const greetingName = profile?.displayName || profile?.username || 'Addy';

  return (
    <div className="sl-dash-page">
      {/* Barra lateral SonicSidebar */}
      <SonicSidebar />

      {/* Contenido principal */}
      <main className="sl-dash-main">
        {/* Cabecera superior: Buscador + Herramientas */}
        <header className="sl-dash-header">
          <form className="sl-dash-search" onSubmit={handleSearchSubmit}>
            <Search size={18} className="sl-dash-search-icon" />
            <input
              type="text"
              placeholder="Buscar canciones, artistas, playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar canciones, artistas, playlists"
            />
          </form>

          <div className="sl-dash-header-tools">
            <button
              type="button"
              className="sl-dash-icon-btn"
              title="Notificaciones"
              aria-label="Notificaciones"
            >
              <Bell size={18} />
              <span className="sl-dash-notif-dot" />
            </button>

            <Link
              to="/perfil"
              className="sl-dash-header-avatar"
              title="Mi perfil"
              aria-label="Mi perfil"
            >
              {profile?.avatarUrl ? (
                <img src={catalogCoverUrl(base, profile.avatarUrl)} alt={greetingName} />
              ) : (
                <span className="sl-dash-avatar-text">
                  {greetingName.charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Saludo personalizado */}
        <section className="sl-dash-greeting" aria-label="Saludo">
          <div className="sl-dash-greet-left">
            <div className="sl-dash-greet-avatar">
              {profile?.avatarUrl ? (
                <img src={catalogCoverUrl(base, profile.avatarUrl)} alt={greetingName} />
              ) : (
                <UserRound size={26} color="#00f0ff" />
              )}
            </div>
            <div className="sl-dash-greet-info">
              <h1>Hola, {greetingName}</h1>
              <p>Tu música, tus playlists, tus lanzamientos y más, todo en un solo lugar.</p>
            </div>
          </div>

          {/* Ondas decorativas neón a la derecha */}
          <svg
            className="sl-dash-greet-waves"
            viewBox="0 0 450 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="neonWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff24e6" />
                <stop offset="50%" stopColor="#9d29ed" />
                <stop offset="100%" stopColor="#00f0ff" />
              </linearGradient>
            </defs>
            <path
              d="M10 50 C90 10 160 70 240 30 S360 10 440 45"
              stroke="url(#neonWaveGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M30 60 C110 25 180 65 260 40 S380 25 430 35"
              stroke="url(#neonWaveGrad)"
              strokeWidth="1.8"
              strokeOpacity="0.65"
              strokeLinecap="round"
            />
          </svg>
        </section>

        {/* Banner principal — Discover Weekly */}
        <section className="sl-dash-banner" aria-label="Banner Discover Weekly">
          <div className="sl-dash-banner-content">
            <span className="sl-dash-banner-tag">TU MIX PERSONALIZADO</span>
            <h2 className="sl-dash-banner-title">Discover Weekly</h2>
            <p className="sl-dash-banner-sub">Tu weekly mix</p>

            <div className="sl-dash-banner-actions">
              <button
                type="button"
                className="sl-dash-banner-play-btn"
                onClick={handlePlayDiscoverWeekly}
              >
                <Play fill="#ffffff" size={16} />
                <span>Reproducir ahora</span>
              </button>

              <button
                type="button"
                className="sl-dash-banner-fav-btn"
                onClick={() => setIsBannerFav((prev) => !prev)}
                aria-label="Guardar en favoritos"
              >
                <Heart
                  size={19}
                  fill={isBannerFav ? '#ff24e6' : 'transparent'}
                  color={isBannerFav ? '#ff24e6' : '#ffffff'}
                />
              </button>
            </div>
          </div>

          {/* Ilustración futurista chica con auriculares neón */}
          <div className="sl-dash-banner-art-wrap">
            <img
              src="/images/discover-weekly-girl.png"
              alt="Ilustración oyente futurista con audífonos neón"
              className="sl-dash-banner-art"
            />
          </div>

          {/* Indicadores de carrusel */}
          <div className="sl-dash-banner-dots" aria-hidden="true">
            <span className="sl-dash-dot active" />
            <span className="sl-dash-dot" />
            <span className="sl-dash-dot" />
          </div>
        </section>

        {/* =========================================================
            PRIMERA FILA — TRES COLUMNAS
            Columna 1: POPULAR (carrusel con flechas)
            Columna 2: HOT & TRENDING 🔥 (lista vertical compacta)
            Columna 3: NUEVOS LANZAMIENTOS (carrusel)
           ========================================================= */}
        <section className="sl-dash-row-1" aria-label="Secciones destacadas fila 1">
          {/* COLUMNA 1: POPULAR */}
          <div className="sl-dash-col">
            <div className="sl-dash-section-header">
              <h3>Popular</h3>
              <Link to="/explorar" className="sl-dash-see-all">
                Ver todo <ChevronRight size={14} />
              </Link>
            </div>

            <div className="sl-dash-carousel-outer">
              <button
                type="button"
                className="sl-dash-carousel-arrow left"
                onClick={() => scrollCarousel(popularScrollRef, 'left')}
                aria-label="Anterior en Popular"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="sl-dash-carousel" ref={popularScrollRef}>
                {popularSongs.map((song) => {
                  const cover = catalogCoverUrl(base, song.coverUrl);
                  const isFav = favoriteIds.has(song.id);
                  return (
                    <article
                      key={song.id}
                      className="sl-dash-music-card"
                      onClick={() => play(song, popularSongs)}
                    >
                      <div className="sl-dash-cover-box">
                        {cover ? (
                          <img
                            src={cover}
                            alt={song.titulo}
                            className="sl-dash-cover-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="sl-dash-cover-fallback">
                            <Music2 size={32} />
                          </div>
                        )}
                      </div>
                      <div className="sl-dash-card-info">
                        <div className="sl-dash-card-title" title={song.titulo}>
                          {song.titulo}
                        </div>
                        <div className="sl-dash-card-artist-row">
                          <span className="sl-dash-card-artist" title={song.artista?.nombre}>
                            {song.artista?.nombre || 'Artista'}
                          </span>
                          <button
                            type="button"
                            className="sl-dash-card-heart"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleFavorite(song);
                            }}
                            aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                          >
                            <Heart
                              size={13}
                              fill={isFav ? '#ff24e6' : 'transparent'}
                              color={isFav ? '#ff24e6' : '#9f91b3'}
                            />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="sl-dash-carousel-arrow right"
                onClick={() => scrollCarousel(popularScrollRef, 'right')}
                aria-label="Siguiente en Popular"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* COLUMNA 2: HOT & TRENDING 🔥 */}
          <div className="sl-dash-col">
            <div className="sl-dash-section-header">
              <h3>Hot & Trending 🔥</h3>
              <Link to="/explorar" className="sl-dash-see-all">
                Ver todo <ChevronRight size={14} />
              </Link>
            </div>

            <div className="sl-dash-box-container">
              {trendingSongs.slice(0, 3).map((song, idx) => {
                const cover = catalogCoverUrl(base, song.coverUrl);
                return (
                  <div
                    key={song.id || idx}
                    className="sl-dash-list-row"
                    onClick={() => play(song, trendingSongs)}
                  >
                    <div className="sl-dash-list-thumb">
                      {cover ? (
                        <img src={cover} alt={song.titulo} loading="lazy" />
                      ) : (
                        <div className="sl-dash-cover-fallback">
                          <Music2 size={18} />
                        </div>
                      )}
                    </div>
                    <div className="sl-dash-list-meta">
                      <div className="sl-dash-list-title" title={song.titulo}>
                        {song.titulo}
                      </div>
                      <div className="sl-dash-list-sub">
                        {song.duracionSegundos
                          ? `${catalogDuration(song.duracionSegundos)} • ${song.artista?.nombre}`
                          : song.artista?.nombre || 'Tendencia'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sl-dash-circle-play"
                      aria-label={`Reproducir ${song.titulo}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        play(song, trendingSongs);
                      }}
                    >
                      <Play fill="#ffffff" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 3: NUEVOS LANZAMIENTOS */}
          <div className="sl-dash-col">
            <div className="sl-dash-section-header">
              <h3>Nuevos lanzamientos</h3>
              <Link to="/lanzamientos" className="sl-dash-see-all">
                Ver todo <ChevronRight size={14} />
              </Link>
            </div>

            <div className="sl-dash-carousel-outer">
              <div className="sl-dash-carousel" ref={releasesScrollRef}>
                {(newReleases.length > 0 ? newReleases : popularSongs.slice(3, 7)).map(
                  (rel, idx) => {
                    const cover = catalogCoverUrl(base, rel.coverUrl);
                    const title = rel.titulo;
                    const artist = rel.artista?.nombre || 'Artista';
                    const tracksToPlay =
                      rel.canciones && rel.canciones.length > 0
                        ? rel.canciones
                        : popularSongs;

                    return (
                      <article
                        key={rel.id || idx}
                        className="sl-dash-release-card"
                        onClick={() => handlePlayQueue(tracksToPlay)}
                      >
                        <div className="sl-dash-release-cover-box">
                          {cover ? (
                            <img
                              src={cover}
                              alt={title}
                              className="sl-dash-cover-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="sl-dash-cover-fallback">
                              <Music2 size={32} />
                            </div>
                          )}
                        </div>
                        <div className="sl-dash-release-info-row">
                          <div className="sl-dash-release-text">
                            <div className="sl-dash-card-title" title={title}>
                              {title}
                            </div>
                            <div className="sl-dash-card-artist" title={artist}>
                              {artist}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="sl-dash-mini-play"
                            aria-label={`Reproducir ${title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayQueue(tracksToPlay);
                            }}
                          >
                            <Play fill="#ffffff" size={11} />
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            SEGUNDA FILA — TRES COLUMNAS (TERCERA ELIMINADA)
            Columna 1: MADE FOR YOU (2 tarjetas destacadas)
            Columna 2: TOP DAILY PLAYLISTS (lista compacta)
            Columna 3: ELIMINADA («Recomendado para ti»)
           ========================================================= */}
        <section className="sl-dash-row-2" aria-label="Secciones destacadas fila 2">
          {/* COLUMNA 1: MADE FOR YOU */}
          <div className="sl-dash-col">
            <div className="sl-dash-section-header">
              <h3>Made for You</h3>
            </div>

            <div className="sl-dash-mfy-grid">
              {/* Tarjeta 1: Long Ride / Chill Vibes */}
              <article
                className="sl-dash-mfy-card"
                onClick={() => handlePlayQueue(mfyMix1.length > 0 ? mfyMix1 : popularSongs)}
              >
                {mfyMix1[0]?.coverUrl ? (
                  <img
                    src={catalogCoverUrl(base, mfyMix1[0].coverUrl)}
                    alt="Long Ride"
                    className="sl-dash-mfy-bg"
                  />
                ) : (
                  <div
                    className="sl-dash-mfy-bg"
                    style={{
                      background: 'linear-gradient(135deg, #12082b, #4b105a)',
                    }}
                  />
                )}
                <div className="sl-dash-mfy-overlay" />
                <div className="sl-dash-mfy-content">
                  <div className="sl-dash-mfy-info">
                    <div className="sl-dash-mfy-title">Long Ride</div>
                    <div className="sl-dash-mfy-desc">Música para tus viajes</div>
                  </div>
                  <button
                    type="button"
                    className="sl-dash-circle-play"
                    aria-label="Reproducir Long Ride"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayQueue(mfyMix1.length > 0 ? mfyMix1 : popularSongs);
                    }}
                  >
                    <Play fill="#ffffff" size={13} />
                  </button>
                </div>
              </article>

              {/* Tarjeta 2: Love / Románticas */}
              <article
                className="sl-dash-mfy-card"
                onClick={() => handlePlayQueue(mfyMix2.length > 0 ? mfyMix2 : popularSongs)}
              >
                {mfyMix2[1]?.coverUrl ? (
                  <img
                    src={catalogCoverUrl(base, mfyMix2[1].coverUrl)}
                    alt="Love"
                    className="sl-dash-mfy-bg"
                  />
                ) : (
                  <div
                    className="sl-dash-mfy-bg"
                    style={{
                      background: 'linear-gradient(135deg, #440938, #180521)',
                    }}
                  />
                )}
                <div className="sl-dash-mfy-overlay" />
                <div className="sl-dash-mfy-content">
                  <div className="sl-dash-mfy-info">
                    <div className="sl-dash-mfy-title">Love</div>
                    <div className="sl-dash-mfy-desc">Tus canciones románticas</div>
                  </div>
                  <button
                    type="button"
                    className="sl-dash-circle-play"
                    aria-label="Reproducir Love"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayQueue(mfyMix2.length > 0 ? mfyMix2 : popularSongs);
                    }}
                  >
                    <Play fill="#ffffff" size={13} />
                  </button>
                </div>
              </article>
            </div>
          </div>

          {/* COLUMNA 2: TOP DAILY PLAYLISTS */}
          <div className="sl-dash-col">
            <div className="sl-dash-section-header">
              <h3>Top daily playlists</h3>
              <Link to="/playlists" className="sl-dash-see-all">
                Ver todo <ChevronRight size={14} />
              </Link>
            </div>

            <div className="sl-dash-box-container">
              {topPlaylists.map((pl) => {
                const cover = catalogCoverUrl(base, pl.coverUrl);
                return (
                  <div
                    key={pl.id}
                    className="sl-dash-list-row"
                    onClick={() => handlePlayQueue(pl.tracks)}
                  >
                    <div className="sl-dash-list-thumb">
                      {cover ? (
                        <img src={cover} alt={pl.titulo} loading="lazy" />
                      ) : (
                        <div className="sl-dash-cover-fallback">
                          <Music2 size={18} />
                        </div>
                      )}
                    </div>
                    <div className="sl-dash-list-meta">
                      <div className="sl-dash-list-title" title={pl.titulo}>
                        {pl.titulo}
                      </div>
                      <div className="sl-dash-list-sub">{pl.sub}</div>
                    </div>
                    <button
                      type="button"
                      className="sl-dash-circle-play"
                      aria-label={`Reproducir ${pl.titulo}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayQueue(pl.tracks);
                      }}
                    >
                      <Play fill="#ffffff" size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 3: COMPLETAMENTE ELIMINADA («Recomendado para ti») */}
        </section>
      </main>
    </div>
  );
}
export default Dashboard;
