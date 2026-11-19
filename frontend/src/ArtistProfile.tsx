import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SonicSidebar } from "./components/SonicSidebar";
import {
  ArrowRight,
  AtSign,
  AudioLines,
  Bell,
  Camera,
  ExternalLink,
  Link as LinkIcon,
  MapPin,
  Music2,
  Pencil,
  Plus,
  Search,
  Share2,
  Star,
  UserRound,
  X,
} from "lucide-react";
import {
  artistIdentities,
  artistUpdate,
  emptyArtist,
  skyline,
  socialFields,
  type ArtistProfile,
  type ArtistResponse,
  type ArtistUpdate,
} from "../../shared/artist";
import {
  ArtistApiError,
  artistMediaUrl,
  artistRequest,
} from "../../shared/artist-api";
import { toggle, type Genre } from "../../shared/profile";
import "./Profile.css";
import "./ArtistProfile.css";
const base = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export function ArtistEntry() {
  const { pathname } = useLocation();
  return ["/inicio", "/perfil"].includes(pathname) ? (
    <div className="catalog-entry-links"><Link to="/explorar">Explorar música</Link><Link className="artist-entry" to="/artista">
      <Music2 size={18} /> Espacio del artista
    </Link></div>
  ) : null;
}
function CityCover() {
  return (
    <div className="artist-city" aria-hidden="true">
      <div className="artist-sun" />
      <div className="artist-cloud cloud-one" />
      <div className="artist-cloud cloud-two" />
      <div className="artist-skyline">
        {skyline.map((height, i) => (
          <i
            key={i}
            style={{
              height: height + "%",
              width: 100 / skyline.length + "%",
              backgroundPosition: (i % 3) * 4 + "px 0",
            }}
          />
        ))}
      </div>
      <div className="artist-horizon" />
    </div>
  );
}
export function ArtistProfilePage() {
  const [response, setResponse] = useState<ArtistResponse | null>(null),
    [draft, setDraft] = useState<ArtistUpdate>(emptyArtist),
    [genres, setGenres] = useState<Genre[]>([]),
    [message, setMessage] = useState(""),
    [denied, setDenied] = useState(false),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("informacion"),
    [expand, setExpand] = useState(false);
  const navigate = useNavigate();
  const file = useRef<HTMLInputElement>(null);
  const mediaKind = useRef<"avatar" | "cover">("avatar");
  const load = useCallback(async () => {
    try {
      const r = await artistRequest<ArtistResponse>(base, "artist-profile");
      setResponse(r);
      setDraft(r.profile ? artistUpdate(r.profile) : emptyArtist());
      setGenres(await artistRequest<Genre[]>(base, "profile/genres"));
    } catch (e) {
      if (e instanceof ArtistApiError && e.status === 401)
        navigate("/iniciar-sesion", { replace: true });
      else if (e instanceof ArtistApiError && e.status === 403) setDenied(true);
      else setMessage((e as Error).message);
    }
  }, [navigate]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  function edit<K extends keyof ArtistUpdate>(key: K, value: ArtistUpdate[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await artistRequest<ArtistResponse>(
        base,
        "artist-profile",
        response?.profile ? "PATCH" : "POST",
        artistUpdate(draft),
      );
      setResponse(r);
      setDraft(artistUpdate(r.profile!));
      setMessage("Perfil artístico guardado.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function choose(kind: "avatar" | "cover") {
    if (!response?.profile) {
      setMessage("Guarda primero tu perfil para cargar imágenes.");
      return;
    }
    if (!response.mediaUploadAvailable) {
      setMessage(
        "La carga local de imágenes solo está habilitada en desarrollo.",
      );
      return;
    }
    mediaKind.current = kind;
    file.current?.click();
  }
  async function upload(image?: File) {
    if (!image) return;
    if (
      image.size > 2097152 ||
      !["image/png", "image/jpeg"].includes(image.type)
    ) {
      setMessage("Selecciona un PNG o JPEG de hasta 2 MB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = new FormData();
      data.append("file", image);
      const result = await artistRequest<{ reference: string }>(
        base,
        "artist-profile/media/" + mediaKind.current,
        "POST",
        data,
      );
      setResponse((r) =>
        r?.profile
          ? {
              ...r,
              profile: {
                ...r.profile,
                [mediaKind.current === "avatar" ? "avatarUrl" : "coverUrl"]:
                  result.reference,
              },
            }
          : r,
      );
      setMessage("Imagen almacenada.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  const unavailable = () =>
    setMessage("Esta sección todavía no está disponible.");
  const profile: ArtistProfile | null = response?.profile ?? null;
  const avatar = artistMediaUrl(base, profile?.avatarUrl ?? null),
    cover = artistMediaUrl(base, profile?.coverUrl ?? null);
  function jump(id: string) {
    setTab(id);
    document
      .getElementById("artist-" + id)
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
  }
  return (
    <div className="profile-page artist-page">
      <SonicSidebar artistMode />
      <div className="profile-main-wrapper">
        <header className="profile-header">
          <nav>
            {["Música", "DJ con IA", "Conciertos"].map((t) => (
              <button key={t} onClick={unavailable}>
                {t}
              </button>
            ))}
          </nav>
          <div className="profile-tools">
            <button aria-label="Buscar" onClick={unavailable}>
              <Search />
            </button>
            <button aria-label="Notificaciones" onClick={unavailable}>
              <Bell />
            </button>
            <span className="profile-mini">
              <UserRound />
            </span>
          </div>
        </header>
        <main className="artist-main">
          <h1>Perfil artístico</h1>
          <p className="artist-subtitle">
            Administra tu presencia como artista en Sonic Ledger.
          </p>
          <p role="status" className="artist-status">
            {message}
          </p>
          {denied ? (
            <section className="artist-panel artist-access">
              <Music2 size={40} />
              <h2>Tu cuenta aún no está habilitada como artista</h2>
              <p>
                Se requiere el rol ARTISTA para crear y gestionar un perfil
                artístico. La habilitación debe ser autorizada; no se concede
                desde este formulario.
              </p>
              <Link to="/perfil" className="artist-primary">
                Volver a mi perfil
              </Link>
            </section>
          ) : !response ? (
            <section className="artist-panel">
              {message ? (
                <button onClick={() => void load()}>Reintentar</button>
              ) : (
                "Cargando perfil artístico…"
              )}
            </section>
          ) : (
            <>
              {!profile && (
                <div className="artist-empty">
                  Aún no tienes un perfil artístico. Completa tus datos y
                  selecciona Crear perfil.
                </div>
              )}
              <section
                className="artist-hero"
                aria-label="Presentación del artista"
              >
                <div className="artist-cover">
                  {cover ? (
                    <img src={cover} alt="Portada del artista" />
                  ) : (
                    <CityCover />
                  )}
                  <button
                    type="button"
                    className="artist-cover-edit"
                    disabled={busy}
                    onClick={() => choose("cover")}
                  >
                    <Pencil size={14} /> Editar portada
                  </button>
                  {!cover && <small>Portada predeterminada</small>}
                </div>
                <div className="artist-summary">
                  <div className="artist-avatar">
                    {avatar ? (
                      <img src={avatar} alt="Avatar del artista" />
                    ) : (
                      <span>
                        {draft.nombreArtistico
                          .trim()
                          .slice(0, 1)
                          .toUpperCase() || <UserRound size={60} />}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      aria-label="Cambiar avatar"
                      onClick={() => choose("avatar")}
                    >
                      <Camera size={20} />
                    </button>
                  </div>
                  <div className="artist-summary-copy">
                    <h2>{draft.nombreArtistico || "Tu nombre artístico"}</h2>
                    <p>
                      {draft.identidad.length
                        ? draft.identidad.join(" · ")
                        : "Tu identidad musical"}
                    </p>
                    <div className="artist-stats">
                      {[
                        [AudioLines, "Seguidores"],
                        [Music2, "Reproducciones"],
                        [Star, "Conciertos"],
                      ].map(([Icon, label]) => {
                        const I = Icon as typeof Star;
                        return (
                          <span key={String(label)}>
                            <I size={18} />
                            <span>
                              {String(label)}
                              <small>No disponible</small>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
              <input
                ref={file}
                type="file"
                accept="image/png,image/jpeg"
                className="artist-file"
                aria-label="Seleccionar imagen"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <nav
                className="artist-tabs"
                aria-label="Secciones del perfil artístico"
              >
                {[
                  ["informacion", "Información", Pencil],
                  ["generos", "Géneros", Music2],
                  ["identidad", "Identidad", Star],
                  ["redes", "Redes", LinkIcon],
                ].map(([id, label, Icon]) => {
                  const I = Icon as typeof Star;
                  return (
                    <button
                      type="button"
                      aria-current={tab === id ? "location" : undefined}
                      key={String(id)}
                      onClick={() => jump(String(id))}
                    >
                      <I size={18} />
                      {String(label)}
                    </button>
                  );
                })}
              </nav>
              <form onSubmit={save}>
                <fieldset disabled={busy} className="artist-form">
                  <legend className="sr-only">
                    Gestionar perfil artístico
                  </legend>
                  <section
                    className="artist-panel artist-info"
                    id="artist-informacion"
                  >
                    <h2>
                      <UserRound /> Información del artista
                    </h2>
                    <p>Edita los datos principales de tu perfil.</p>
                    <label>
                      Nombre artístico (nombre en la plataforma)
                      <span className="artist-input">
                        <UserRound />
                        <input
                          required
                          minLength={2}
                          maxLength={100}
                          value={draft.nombreArtistico}
                          onChange={(e) =>
                            edit("nombreArtistico", e.target.value)
                          }
                        />
                      </span>
                    </label>
                    <label>
                      Usuario
                      <span className="artist-input">
                        <AtSign />
                        <input readOnly value={response.username} />
                      </span>
                    </label>
                    <label>
                      Biografía (máx. 500 caracteres)
                      <span className="artist-bio">
                        <textarea
                          aria-label="Biografía"
                          rows={4}
                          maxLength={500}
                          value={draft.biografia}
                          onChange={(e) => edit("biografia", e.target.value)}
                        />
                        <small>{draft.biografia.length}/500</small>
                      </span>
                    </label>
                    <label>
                      Ubicación
                      <span className="artist-location">
                        <span className="artist-input">
                          <MapPin />
                          <input
                            aria-label="Ciudad"
                            maxLength={80}
                            placeholder="Ciudad"
                            value={draft.ciudad}
                            onChange={(e) => edit("ciudad", e.target.value)}
                          />
                        </span>
                        <span className="artist-input">
                          <input
                            aria-label="País"
                            maxLength={80}
                            placeholder="País"
                            value={draft.pais}
                            onChange={(e) => edit("pais", e.target.value)}
                          />
                        </span>
                      </span>
                    </label>
                  </section>
                  <div className="artist-right">
                    <section className="artist-panel" id="artist-generos">
                      <h2>
                        <Music2 /> Géneros principales
                      </h2>
                      <p>Selecciona los géneros que te representan.</p>
                      <div className="artist-chips">
                        {(expand ? genres : genres.slice(0, 5)).map((g) => (
                          <button
                            type="button"
                            key={g.id}
                            aria-pressed={draft.genreIds.includes(g.id)}
                            onClick={() =>
                              edit("genreIds", toggle(draft.genreIds, g.id))
                            }
                          >
                            {draft.genreIds.includes(g.id) && "✓ "}
                            {g.nombre}
                          </button>
                        ))}
                        {genres.length > 5 && (
                          <button
                            type="button"
                            aria-expanded={expand}
                            onClick={() => setExpand(!expand)}
                          >
                            <Plus size={13} />
                            {expand ? "Ver menos" : "Agregar género"}
                          </button>
                        )}
                      </div>
                      {!genres.length && (
                        <p>No hay géneros activos disponibles.</p>
                      )}
                    </section>
                    <section className="artist-panel" id="artist-identidad">
                      <h2>
                        <Star /> Identidad del artista
                      </h2>
                      <p>Define cómo quieres que se perciba tu propuesta.</p>
                      <div className="artist-chips">
                        {artistIdentities.map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={draft.identidad.includes(t)}
                            onClick={() =>
                              edit("identidad", toggle(draft.identidad, t))
                            }
                          >
                            {draft.identidad.includes(t) && "✓ "}
                            {t}
                          </button>
                        ))}
                      </div>
                    </section>
                    <section
                      className="artist-panel artist-social"
                      id="artist-redes"
                    >
                      <h2>
                        <Share2 /> Redes y enlaces
                      </h2>
                      <p>Conecta tus redes y comparte tu música.</p>
                      {socialFields.map(([key, label, placeholder]) => (
                        <label key={key}>
                          <span>{label}</span>
                          <span className="artist-social-input">
                            <input
                              type="url"
                              aria-label={label}
                              placeholder={placeholder}
                              maxLength={500}
                              value={draft.redes[key] || ""}
                              onChange={(e) =>
                                edit("redes", {
                                  ...draft.redes,
                                  [key]: e.target.value,
                                })
                              }
                            />
                            {draft.redes[key] && (
                              <button
                                type="button"
                                aria-label={"Eliminar " + label}
                                onClick={() =>
                                  edit("redes", { ...draft.redes, [key]: "" })
                                }
                              >
                                <X size={13} />
                              </button>
                            )}
                            <ExternalLink size={13} aria-hidden="true" />
                          </span>
                        </label>
                      ))}
                    </section>
                  </div>
                </fieldset>
                <button className="artist-primary artist-save" disabled={busy}>
                  {busy
                    ? "Guardando…"
                    : profile
                      ? "Guardar perfil"
                      : "Crear perfil"}
                  <ArrowRight size={21} />
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
