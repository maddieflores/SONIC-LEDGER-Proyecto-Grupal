import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SonicSidebar } from "./components/SonicSidebar";
import {
  ArrowLeft,
  ArrowRight,
  Disc3,
  Play,
  Pause,
  Search,
  UserRound,
} from "lucide-react";
import {
  catalogRequest,
  CatalogError,
  type CatalogSong,
} from "../../shared/catalog";
import type { PublicArtist } from "../../shared/playback";
import { usePlayback } from "./PlaybackContext";
import { SongListItem } from "./Catalog";
import { getApiBaseUrl } from "./auth-api";
const base = getApiBaseUrl();
function artistImage(reference: string | null) {
  return reference &&
    /^\/api\/auth\/catalog\/artists\/[a-f0-9-]+\/media\/(avatar|cover)$/.test(
      reference,
    )
    ? base.replace(/\/api\/?$/, "") + reference
    : undefined;
}
export function PublicArtistPage() {
  const { id } = useParams(),
    navigate = useNavigate(),
    p = usePlayback();
  const [data, setData] = useState<PublicArtist | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [tab, setTab] = useState("resumen"),
    [query, setQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined;
    void catalogRequest<PublicArtist>(
      base,
      "/artists/" + id + "?page=" + page + "&pageSize=20",
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
            ? "Inicia sesión para ver el perfil completo del artista."
            : e.message || "No se pudo cargar el artista.",
        );
      });
    return () => controller.abort();
  }, [id, page]);
  const first = data?.songs.find((s) => s.playable !== false);
  return (
    <div className="public-artist-page">
      <SonicSidebar />
      <main className="public-artist-main">
        <header>
          <button aria-label="Volver" onClick={() => navigate(-1)}>
            <ArrowLeft />
          </button>
          <button aria-label="Adelante" onClick={() => navigate(1)}>
            <ArrowRight />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/explorar?q=" + encodeURIComponent(query));
            }}
          >
            <Search />
            <input
              aria-label="Buscar en catálogo"
              placeholder="Buscar canciones, artistas o géneros…"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <Link to="/perfil" aria-label="Mi perfil">
            <UserRound />
          </Link>
        </header>
        {error ? (
          <section className="public-empty" role="alert">
            <p>{error}</p>
            <Link to="/explorar">Volver a Explorar</Link>
          </section>
        ) : !data ? (
          <p className="public-empty">Cargando artista…</p>
        ) : (
          <>
            <section
              className="public-artist-hero"
              style={
                data.artist.coverUrl
                  ? {
                      backgroundImage: `linear-gradient(90deg,#1b0825dd,#0c071740),url("${artistImage(data.artist.coverUrl)}")`,
                    }
                  : undefined
              }
            >
              {!data.artist.coverUrl && (
                <img
                  className="public-hero-decoration"
                  src="/images/sonic-artist-hero.png"
                  alt="Ilustración musical neón"
                />
              )}
              <div className="public-hero-copy">
                <div className="public-artist-avatar">
                  {data.artist.avatarUrl ? (
                    <img
                      src={artistImage(data.artist.avatarUrl)}
                      alt={"Avatar de " + data.artist.nombre}
                    />
                  ) : (
                    <span>{data.artist.nombre.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h1>{data.artist.nombre}</h1>
                  {data.artist.identidad.length > 0 && (
                    <p>{data.artist.identidad.join(" · ")}</p>
                  )}
                  {(data.artist.ciudad || data.artist.pais) && (
                    <small>
                      {[data.artist.ciudad, data.artist.pais]
                        .filter(Boolean)
                        .join(", ")}
                    </small>
                  )}
                </div>
              </div>
              <button
                className="public-hero-play"
                disabled={!first}
                onClick={() => first && p.play(first, data.songs)}
              >
                {p.playing&&p.song?.id===first?.id?<Pause fill="currentColor" size={20}/>:<Play fill="currentColor" size={20}/>} {p.playing&&p.song?.id===first?.id?"Pausar":"Reproducir"}
              </button>
            </section>
            <nav className="public-tabs">
              {[
                ["resumen", "Resumen"],
                ["canciones", "Canciones"],
                ["lanzamientos", "Lanzamientos"],
                ["acerca", "Acerca de"],
              ].map(([key, title]) => (
                <button
                  key={key}
                  aria-current={tab === key ? "page" : undefined}
                  onClick={() => setTab(key)}
                >
                  {title}
                </button>
              ))}
            </nav>
            <div className="public-artist-content">
              <section>
                {tab === "acerca" ? (
                  <>
                    <h2>Acerca de {data.artist.nombre}</h2>
                    <p className="public-biography">
                      {data.artist.biografia ||
                        "El artista todavía no ha añadido una biografía."}
                    </p>
                  </>
                ) : tab === "lanzamientos" ? (
                  <Release data={data} />
                ) : (
                  <>
                    <h2>Canciones publicadas</h2>
                    {data.songs.length ? (
                      data.songs.map((song: CatalogSong) => (
                        <SongListItem
                          key={song.id}
                          song={song}
                          queue={data.songs}
                        />
                      ))
                    ) : (
                      <p className="public-empty">
                        Este artista aún no tiene canciones publicadas.
                      </p>
                    )}
                    {data.totalPages > 1 && (
                      <div className="public-paging">
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage((v) => v - 1)}
                        >
                          Anterior
                        </button>
                        <span>
                          {page} / {data.totalPages}
                        </span>
                        <button
                          disabled={page >= data.totalPages}
                          onClick={() => setPage((v) => v + 1)}
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
              {tab === "resumen" && (
                <aside>
                  <Release data={data} />
                  {data.artist.biografia && (
                    <section className="public-artist-about">
                      <h2>Identidad del artista</h2>
                      <p>{data.artist.biografia}</p>
                    </section>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
function Release({ data }: { data: PublicArtist }) {
  const p = usePlayback();
  const releases = data.releases || [];

  if (releases.length > 0) {
    return (
      <section className="public-release" style={{ width: "100%" }}>
        <h2>Lanzamientos publicados</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginTop: 12 }}>
          {releases.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: "rgba(22, 10, 42, 0.7)",
                borderRadius: 14,
                border: "1px solid rgba(157, 41, 237, 0.25)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {r.coverUrl ? (
                <img
                  src={base.replace(/\/api\/?$/, "") + r.coverUrl}
                  alt={r.titulo}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10 }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 160,
                    borderRadius: 10,
                    backgroundColor: "#130724",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Disc3 size={40} color="#9d29ed" />
                </div>
              )}
              <h3 style={{ margin: 0, fontSize: 16, color: "#ffffff" }}>{r.titulo}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#baa4d4" }}>
                {r.tipo} · {r.songCount} {r.songCount === 1 ? "canción" : "canciones"}
              </p>
              {r.canciones && r.canciones.length > 0 && (
                <button
                  style={{
                    marginTop: "auto",
                    padding: "8px 14px",
                    borderRadius: 10,
                    backgroundColor: "linear-gradient(90deg, #d414a8, #9d29ed)",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onClick={() => p.play(r.canciones[0], r.canciones)}
                >
                  <Play size={14} fill="currentColor" /> Reproducir lanzamiento
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="public-release">
      <h2>Último lanzamiento</h2>
      {data.latestRelease ? (
        <>
          <Disc3 size={45} />
          <h3>{data.latestRelease.titulo}</h3>
          <p>
            {data.latestRelease.tipo} · {data.latestRelease.songCount} canciones
            publicadas
          </p>
          {data.latestRelease.fecha && (
            <small>
              {new Date(data.latestRelease.fecha).toLocaleDateString("es-BO")}
            </small>
          )}
        </>
      ) : (
        <p>No hay lanzamientos publicados disponibles.</p>
      )}
    </section>
  );
}
