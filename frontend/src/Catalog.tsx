import { usePlayback } from "./PlaybackContext";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  ChevronRight,
  Heart,
  Music2,
  Play,
  Pause,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  fetchMusicRecommendations,
} from "../../shared/recommendations-api";
import type {
  MusicRecommendationsResponse,
} from "../../shared/recommendations";
import {
  CatalogError,
  catalogCoverUrl,
  catalogDuration,
  catalogRequest,
  type CatalogDetail,
  type CatalogGenre,
  type CatalogPage,
  type CatalogSong,
} from "../../shared/catalog";
import { AddToPlaylistModal } from "./UserLibrary";
import { type PlaylistSummary } from "../../shared/library";
import {
  fetchUserPlaylists,
  toggleFavorite,
  checkFavorites,
} from "../../shared/library-api";
import { SonicSidebar } from "./components/SonicSidebar";
import { getApiBaseUrl } from "./auth-api";
import "./Catalog.css";
const base = getApiBaseUrl();
function CatalogLayout({
  children,
  focus,
}: {
  children: React.ReactNode;
  focus?: () => void;
}) {
  return (
    <div className="catalog-page">
      <SonicSidebar />
      <div className="catalog-main-wrapper">
        <header className="catalog-header">
          <nav>
            <Link to="/explorar" aria-current="page">
              Música
            </Link>
            <Link to="/dj">DJ con IA</Link>
            <Link to="/conciertos">Conciertos</Link>
          </nav>
          <div className="catalog-tools">
            {focus && (
              <button aria-label="Enfocar buscador" onClick={focus}>
                <Search />
              </button>
            )}
            <button
              disabled
              aria-label="Notificaciones próximamente"
              title="Notificaciones próximamente"
            >
              <Bell />
            </button>
            <Link to="/perfil" aria-label="Mi perfil">
              <UserRound />
            </Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
export function CatalogHero() {
  return (
    <section className="catalog-hero">
      <div>
        <span className="catalog-eyebrow">ENCUENTRA TU FRECUENCIA</span>
        <h1>Explorar</h1>
        <p>Descubre canciones publicadas en Sonic Ledger</p>
      </div>
      <img
        src="/images/sonic-artist-hero.png"
        alt="Mujer con audífonos iluminada en violeta, magenta y azul"
      />
      <svg viewBox="0 0 800 85" aria-hidden="true">
        <defs>
          <linearGradient id="catalog-wave">
            <stop stopColor="#8729f8" />
            <stop offset=".5" stopColor="#f322cc" />
            <stop offset="1" stopColor="#009bff" />
          </linearGradient>
        </defs>
        <path d="M0 50 C100 100 140 -25 250 40 S400 85 470 50 S580 -5 680 45 S760 70 800 45" />
      </svg>
    </section>
  );
}
export function SearchBar({
  value,
  onChange,
  input,
}: {
  value: string;
  onChange: (v: string) => void;
  input: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="catalog-search">
      <Search aria-hidden="true" />
      <input
        ref={input}
        value={value}
        maxLength={100}
        aria-label="Buscar canciones, artistas o géneros"
        placeholder="Buscar canciones, artistas o géneros…"
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          aria-label="Limpiar búsqueda"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <X />
        </button>
      )}
    </div>
  );
}
export function GenreChips({
  genres,
  value,
  onChange,
}: {
  genres: CatalogGenre[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="catalog-genres" aria-label="Filtrar por género">
      {[{ id: "", nombre: "Todo" }, ...genres].map((g) => (
        <button
          type="button"
          key={g.id}
          aria-pressed={value === g.id}
          onClick={() => onChange(g.id)}
        >
          {g.nombre}
        </button>
      ))}
    </div>
  );
}
function CatalogCover({
  song,
  large = false,
}: {
  song: CatalogSong;
  large?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const coverUrl = song.coverUrl ? catalogCoverUrl(base, song.coverUrl) : undefined;
  return (
    <span className={"catalog-cover " + (large ? "large" : "")}>
      {coverUrl && !broken ? (
        <img
          src={coverUrl}
          alt={"Portada de " + song.titulo}
          onError={() => setBroken(true)}
          loading="lazy"
        />
      ) : (
        <Music2 aria-label="Portada no disponible" />
      )}
    </span>
  );
}
export function SongListItem({
  song,
  queue,
  onAddToPlaylist,
  isFavorite: initialFav,
  onToggleFavorite,
}: {
  song: CatalogSong;
  queue?: CatalogSong[];
  onAddToPlaylist?: (song: CatalogSong) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (song: CatalogSong) => void;
}) {
  const playback = usePlayback();
  const active = playback.song?.id === song.id;
  const [fav, setFav] = useState(Boolean(initialFav));
  const [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    if (initialFav !== undefined) {
      setFav(initialFav);
    }
  }, [initialFav]);

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(song);
      return;
    }
    setLoadingFav(true);
    try {
      const res = await toggleFavorite(base, song.id, fav, song.source);
      setFav(res.favorited);
    } catch {
      // ignore
    } finally {
      setLoadingFav(false);
    }
  };

  return (
    <article className={"catalog-song " + (active ? "is-playing" : "")}>
      <Link
        className="catalog-song-link"
        to={"/explorar/cancion/" + song.id}
        aria-label={
          "Ver detalle de " + song.titulo + ", " + song.artista.nombre
        }
      >
        <CatalogCover song={song} />
        <span className="catalog-song-copy">
          <strong title={song.titulo}>{song.titulo}</strong>
          <small title={song.artista.nombre}>{song.artista.nombre} · {song.source || "LOCAL"}</small>
        </span>
      </Link>
      <span className="catalog-song-genre">{song.genero?.nombre ?? ""}</span>
      <time className="catalog-duration">
        {catalogDuration(song.duracionSegundos)}
      </time>
      <div className="catalog-song-actions" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button
          type="button"
          aria-label={fav ? "Quitar de favoritas" : "Añadir a favoritas"}
          title={fav ? "Quitar de favoritas" : "Añadir a favoritas"}
          disabled={loadingFav}
          onClick={handleToggleFav}
          style={{ background: "none", border: "none", color: fav ? "#ff2d6a" : "#8c7b9e", cursor: "pointer", padding: "6px" }}
        >
          <Heart size={18} fill={fav ? "#ff2d6a" : "none"} />
        </button>
        {onAddToPlaylist && (
          <button
            type="button"
            aria-label="Añadir a playlist"
            title="Añadir a playlist"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddToPlaylist(song);
            }}
            style={{ background: "none", border: "none", color: "#8c7b9e", cursor: "pointer", padding: "6px" }}
          >
            <Plus size={18} />
          </button>
        )}
        <button
          disabled={song.playable === false}
          onClick={() => playback.play(song, queue ?? [song])}
          className="catalog-play"
          aria-label={
            (song.playable === false
              ? "Audio no disponible: "
              : active && playback.playing
                ? "Pausar "
                : "Reproducir ") + song.titulo
          }
          title={
            song.playable === false
              ? "Audio no disponible"
              : "Reproducir / Pausar"
          }
        >
          {active && playback.playing ? (
            <Pause fill="currentColor" size={18} />
          ) : (
            <Play fill="currentColor" size={18} />
          )}
        </button>
      </div>
    </article>
  );
}
export function CatalogStates({
  loading,
  error,
  empty,
  retry,
  clear,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  retry: () => void;
  clear?: () => void;
}) {
  return (
    <div className="catalog-state" role={error ? "alert" : "status"}>
      <Music2 />
      <h2>
        {error
          ? "No se pudo cargar el catálogo"
          : loading
            ? "Buscando tu próximo sonido…"
            : "No hay canciones para mostrar"}
      </h2>
      <p>
        {error ||
          (loading
            ? "Cargando canciones publicadas."
            : empty
              ? "No encontramos coincidencias con tu búsqueda."
              : "Las canciones publicadas aparecerán aquí cuando estén disponibles.")}
      </p>
      {error && <button onClick={retry}>Reintentar</button>}
      {!loading && !error && clear && (
        <button onClick={clear}>Limpiar filtros</button>
      )}
    </div>
  );
}

function RecommendedSection() {
  const playback = usePlayback();
  const [data, setData] = useState<MusicRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    void fetchMusicRecommendations(base, token, 10)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading || !data || data.items.length === 0) {
    return null;
  }

  // Convert recommended items to CatalogSong queue
  const queue: CatalogSong[] = data.items.map((item) => ({
    id: item.id,
    source: item.source,
    titulo: item.titulo,
    artista: {
      id: item.artista.id || '',
      nombre: item.artista.nombre,
    },
    genero: item.genero,
    duracionSegundos: item.duracionSegundos,
    descripcion: item.motivosRecomendacion.join('. '),
    coverUrl: item.coverUrl,
    playable: item.playable,
  }));

  return (
    <section className="rec-music-section" aria-label="Recomendado para ti">
      <div className="rec-music-header">
        <div className="rec-music-title-wrap">
          <h2>
            <Sparkles size={22} /> Recomendado para ti
          </h2>
          <p className="rec-music-subtitle">
            {data.esPersonalizada
              ? 'Basado en tus preferencias de géneros, canciones favoritas y tiempo de escucha'
              : 'Descubrimiento musical destacado en Sonic Ledger · Personaliza tu perfil para afinar'}
          </p>
        </div>
        <span
          className={
            'rec-status-badge ' +
            (data.esPersonalizada ? 'personalized' : 'discovery')
          }
        >
          {data.esPersonalizada ? '★ Personalizado' : '✦ Descubrimiento'}
        </span>
      </div>

      <div className="rec-music-track-wrapper">
        <div className="rec-music-carousel" role="list">
          {data.items.map((item, idx) => {
            const active = playback.song?.id === item.id;
            const isPlaying = active && playback.playing;
            const songObj = queue[idx];

            return (
              <article
                key={item.id}
                className={'rec-music-card ' + (active ? 'is-active' : '')}
                role="listitem"
              >
                <div className="rec-card-cover-container">
                  {item.coverUrl ? (
                    <img
                      src={catalogCoverUrl(base, item.coverUrl)}
                      alt={`Portada de ${item.titulo}`}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="rec-card-cover-fallback">
                      <Music2 size={36} />
                    </div>
                  )}

                  <span className="rec-source-pill">{item.source}</span>
                  {data.esPersonalizada && (
                    <span
                      className="rec-affinity-badge"
                      title="Puntuación de afinidad con tus gustos"
                    >
                      {item.score}% afinidad
                    </span>
                  )}

                  <div className="rec-play-overlay">
                    <button
                      className={'rec-play-btn ' + (isPlaying ? 'playing' : '')}
                      onClick={() => {
                        if (isPlaying) {
                          playback.toggle();
                        } else if (active) {
                          playback.toggle();
                        } else {
                          playback.play(songObj, queue);
                        }
                      }}
                      disabled={item.playable === false}
                      aria-label={
                        isPlaying
                          ? `Pausar ${item.titulo}`
                          : `Reproducir ${item.titulo}`
                      }
                    >
                      {isPlaying ? (
                        <Pause size={22} fill="currentColor" />
                      ) : (
                        <Play size={22} fill="currentColor" style={{ marginLeft: 2 }} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rec-card-body">
                  <Link
                    to={`/explorar/cancion/${item.id}`}
                    className="rec-song-title"
                    title={item.titulo}
                  >
                    {item.titulo}
                  </Link>
                  <span className="rec-song-artist" title={item.artista.nombre}>
                    {item.artista.nombre}
                  </span>
                  <div
                    className="rec-reason-tag"
                    title={item.motivosRecomendacion.join('. ')}
                  >
                    {item.motivosRecomendacion[0] || 'Recomendación Sonic Ledger'}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Catalog() {
  const [params, setParams] = useSearchParams(),
    input = useRef<HTMLInputElement>(null);
  const q = params.get("q") ?? "",
    genre = params.get("generoId") ?? "",
    page = params.get("page") ?? "1";
  const [genres, setGenres] = useState<CatalogGenre[]>([]),
    [data, setData] = useState<CatalogPage | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistSummary[]>([]);
  const [songForPlaylist, setSongForPlaylist] = useState<CatalogSong | null>(null);
  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    void fetchUserPlaylists(base, token).then(setUserPlaylists).catch(() => {});
  }, []);

  useEffect(() => {
    if (!data?.items?.length) return;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    const ids = data.items.map((s) => s.id);
    void checkFavorites(base, ids, token).then(setFavoriteMap).catch(() => {});
  }, [data]);
  useEffect(() => {
    const controller = new AbortController();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    void catalogRequest<CatalogGenre[]>(
      base,
      "/genres",
      token,
      controller.signal,
    )
      .then(setGenres)
      .catch(() => {
        // Si no hay géneros disponibles o no hay sesión, continuar con catálogo general
        setGenres([]);
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setData(null);
        setError("");
      }
    });
    const timer = setTimeout(() => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
      const query = new URLSearchParams({ page, pageSize: "12" });
      if (q.trim()) query.set("q", q.trim());
      if (genre) query.set("generoId", genre);
      void catalogRequest<CatalogPage>(
        base,
        "?" + query,
        token,
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) setData(value);
        })
        .catch((e) => {
          if (controller.signal.aborted) return;
          setError(
            e instanceof CatalogError && e.status === 401
              ? "Inicia sesión para explorar todas las canciones del catálogo."
              : e.message || "No se pudo cargar el catálogo de canciones."
          );
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, genre, page, retry]);
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "q" });
  }
  return (
    <CatalogLayout focus={() => input.current?.focus()}>
      <CatalogHero />
      <RecommendedSection />
      <SearchBar input={input} value={q} onChange={(v) => change("q", v)} />
      <GenreChips
        genres={genres}
        value={genre}
        onChange={(v) => change("generoId", v)}
      />
      <div className="catalog-list-heading">
        <h2>{params.get("tipo") === "album" ? "Álbumes y catálogo" : q.trim() || genre ? "Resultados" : "Catálogo musical"}</h2>
        <span role="status">
          {data
            ? data.total +
              " " +
              (data.total === 1 ? "canción" : "canciones") +
              (q.trim() ? " encontradas" : "")
            : error
              ? ""
              : "Buscando…"}
        </span>
      </div>
      {error || !data ? (
        <CatalogStates
          loading={!error}
          error={error}
          retry={() => setRetry((v) => v + 1)}
        />
      ) : !data.items.length ? (
        <CatalogStates
          empty={Boolean(q || genre)}
          retry={() => setRetry((v) => v + 1)}
          clear={q || genre ? () => setParams({}) : undefined}
        />
      ) : (
        <div className="catalog-song-list">
          {data.externalError && <p role="status">{data.externalError}</p>}
          {data.items.map((song) => (
            <SongListItem
              key={song.id}
              song={song}
              queue={data.items}
              isFavorite={favoriteMap[song.id]}
              onAddToPlaylist={(s) => setSongForPlaylist(s)}
            />
          ))}
        </div>
      )}
      {data && data.totalPages > 1 && (
        <nav
          className="catalog-pagination"
          aria-label="Paginación del catálogo"
        >
          <button
            disabled={data.page <= 1}
            aria-label="Página anterior"
            onClick={() => change("page", String(data.page - 1))}
          >
            <ChevronLeft />
          </button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <button
            disabled={data.page >= data.totalPages}
            aria-label="Página siguiente"
            onClick={() => change("page", String(data.page + 1))}
          >
            <ChevronRight />
          </button>
        </nav>
      )}
      <p className="catalog-coming">
        Selecciona el botón circular para escuchar o el título para ver el
        detalle.
      </p>
      {songForPlaylist && (
        <AddToPlaylistModal
          song={songForPlaylist}
          playlists={userPlaylists}
          onClose={() => setSongForPlaylist(null)}
          onAdded={async () => {
            setSongForPlaylist(null);
            const pls = await fetchUserPlaylists(base);
            setUserPlaylists(pls);
          }}
        />
      )}
    </CatalogLayout>
  );
}
export function SongDetail() {
  const playback = usePlayback();
  const { id } = useParams();
  const [data, setData] = useState<CatalogDetail | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [isFav, setIsFav] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistSummary[]>([]);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    void checkFavorites(base, [id])
      .then((m: Record<string, boolean>) => setIsFav(Boolean(m[id])))
      .catch(() => {});
    void fetchUserPlaylists(base)
      .then(setUserPlaylists)
      .catch(() => {});
  }, [id]);

  const handleToggleFav = async () => {
    if (!data?.song || loadingFav) return;
    setLoadingFav(true);
    try {
      const res = await toggleFavorite(base, data.song.id, isFav, data.song.source);
      setIsFav(res.favorited);
    } catch {
      // ignore
    } finally {
      setLoadingFav(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setData(null);
        setError("");
      }
    });
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    void catalogRequest<CatalogDetail>(
      base,
      "/" + encodeURIComponent(id ?? ""),
      token,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(
          e instanceof CatalogError && e.status === 404
            ? "La canción ya no está disponible o no existe."
            : e instanceof CatalogError && e.status === 401
              ? "Inicia sesión para ver los detalles de esta canción."
              : e.message || "No se pudo cargar la canción.",
        );
      });
    return () => controller.abort();
  }, [id, retry]);
  return (
    <CatalogLayout>
      <Link className="catalog-back" to="/explorar">
        <ArrowLeft size={19} /> Volver a Explorar
      </Link>
      {!data ? (
        <CatalogStates
          loading={!error}
          error={error}
          retry={() => setRetry((v) => v + 1)}
        />
      ) : (
        <>
          <section className="catalog-detail">
            <CatalogCover key={data.song.id} song={data.song} large />
            <div>
              <span className="catalog-eyebrow">CANCIÓN</span>
              <h1>{data.song.titulo}</h1>
              <h2>
                <Link to={"/artistas/" + data.song.artista.id}>
                  {data.song.artista.nombre}
                </Link>
              </h2>
              <div className="catalog-detail-meta">
                {data.song.genero && <span>{data.song.genero.nombre}</span>}
                <span>{catalogDuration(data.song.duracionSegundos)}</span>
              </div>
              {data.song.descripcion && <p>{data.song.descripcion}</p>}
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "16px", flexWrap: "wrap" }}>
                <button
                  className="catalog-detail-play"
                  disabled={data.song.playable === false}
                  onClick={() =>
                    playback.play(data.song, [data.song, ...data.moreByArtist])
                  }
                  aria-label={playback.song?.id===data.song.id&&playback.playing?"Pausar canción":"Reproducir canción"}
                >
                  {playback.song?.id===data.song.id&&playback.playing?<Pause fill="currentColor" size={20}/>:<Play fill="currentColor" size={20}/>} {playback.song?.id===data.song.id&&playback.playing?"Pausar":"Reproducir"}
                </button>
                <button
                  type="button"
                  onClick={handleToggleFav}
                  disabled={loadingFav}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "24px",
                    background: isFav ? "rgba(255, 45, 106, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    border: `1px solid ${isFav ? "#ff2d6a" : "rgba(255, 255, 255, 0.2)"}`,
                    color: isFav ? "#ff2d6a" : "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  <Heart size={18} fill={isFav ? "#ff2d6a" : "none"} />
                  <span>{isFav ? "Favorita" : "Añadir a favoritas"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlaylistModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 18px",
                    borderRadius: "24px",
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  <Plus size={18} />
                  <span>Añadir a playlist</span>
                </button>
              </div>
            </div>
          </section>
          {data.moreByArtist.length > 0 && (
            <section>
              <h2 className="catalog-related-title">
                Más de {data.song.artista.nombre}
              </h2>
              {data.moreByArtist.map((song) => (
                <SongListItem
                  key={song.id}
                  song={song}
                  queue={[data.song, ...data.moreByArtist]}
                />
              ))}
            </section>
          )}
          {showPlaylistModal && (
            <AddToPlaylistModal
              song={data.song}
              playlists={userPlaylists}
              onClose={() => setShowPlaylistModal(false)}
              onAdded={async () => {
                setShowPlaylistModal(false);
                const pls = await fetchUserPlaylists(base);
                setUserPlaylists(pls);
              }}
            />
          )}
        </>
      )}
    </CatalogLayout>
  );
}

