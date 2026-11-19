import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { SonicSidebar } from "./components/SonicSidebar";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  ImagePlus,
  ListMusic,
  MoreHorizontal,
  Music2,
  Pencil,
  Plus,
  Radio,
  Save,
  Search,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  songsApi,
  SongsApiError,
  songDuration,
  songMediaUrl,
  uploadSongFile,
  type Dashboard,
  type Song,
  type SongInput,
  type SongList,
  type SongOptions,
  type SongState,
} from "./songs-api";
import "./ArtistMusic.css";
type MusicContext = {
  dashboard: Dashboard;
  options: SongOptions;
  refresh: () => Promise<void>;
};
const MusicContext = createContext<MusicContext | null>(null);
function useMusic() {
  const context = useContext(MusicContext);
  if (!context) throw new Error("Falta contexto musical.");
  return context;
}
export function ArtistMusicLayout() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [options, setOptions] = useState<SongOptions | null>(null),
    [message, setMessage] = useState(""),
    [blocked, setBlocked] = useState(false);
  const navigate = useNavigate();
  const refresh = useCallback(async () => {
    setDashboard(await songsApi.dashboard());
  }, []);
  const load = useCallback(async () => {
    try {
      const [d, o] = await Promise.all([
        songsApi.dashboard(),
        songsApi.options(),
      ]);
      setDashboard(d);
      setOptions(o);
    } catch (e) {
      if (e instanceof SongsApiError && e.status === 401)
        navigate("/iniciar-sesion", { replace: true });
      else {
        setMessage((e as Error).message);
        if (
          e instanceof SongsApiError &&
          (e.status === 403 || e.status === 409)
        )
          setBlocked(true);
      }
    }
  }, [navigate]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const unavailable = () =>
    setMessage("Este módulo todavía no está disponible.");
  return (
    <div className="music-app">
      <SonicSidebar artistMode />
      <div className="music-main-wrapper">
        <header className="music-header">
          <nav>
            <Link aria-current="page" to="/artista">
              Música
            </Link>
            <button onClick={unavailable}>DJ con IA</button>
            <button onClick={unavailable}>Conciertos</button>
          </nav>
          <div className="music-header-tools">
            <Link aria-label="Buscar canciones" to="/artista/canciones?buscar=1">
              <Search />
            </Link>
            <button aria-label="Notificaciones" onClick={unavailable}>
              <Bell />
            </button>
            <Link
              aria-label="Perfil artístico"
              className="music-header-avatar"
              to="/perfil-artistico"
            >
              <UserRound />
            </Link>
          </div>
        </header>
        <main className="music-main">
          {message && (
            <div role="status" className="music-notice">
              {message}
              <button aria-label="Cerrar aviso" onClick={() => setMessage("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {blocked ? (
            <section className="music-panel music-blocked">
              <Music2 size={42} />
              <h1>Acceso al espacio del artista</h1>
              <p>{message}</p>
              <p>
                Solo una cuenta habilitada como ARTISTA puede administrar
                canciones propias.
              </p>
              <Link className="music-primary" to="/perfil-artistico">
                Ir al perfil artístico
              </Link>
            </section>
          ) : !dashboard || !options ? (
            <section className="music-panel music-loading">
              {message ? (
                <button onClick={() => void load()}>Reintentar</button>
              ) : (
                "Cargando tu espacio musical…"
              )}
            </section>
          ) : (
            <MusicContext.Provider value={{ dashboard, options, refresh }}>
              <Outlet />
            </MusicContext.Provider>
          )}
        </main>
      </div>
    </div>
  );
}
function Stats() {
  const {
    dashboard: { totals: t },
  } = useMusic();
  return (
    <div className="music-stats">
      {[
        [Music2, t.total, "Canciones totales"],
        [Radio, t.published, "Publicadas"],
        [FileText, t.drafts, "Borradores"],
        [CalendarDays, t.releases, "Lanzamientos"],
      ].map(([Icon, value, label]) => {
        const I = Icon as typeof Music2;
        return (
          <div className="music-stat" key={String(label)}>
            <I />
            <div>
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function Cover({ song, small = false }: { song: Song; small?: boolean }) {
  return (
    <span className={"music-cover " + (small ? "small" : "")}>
      {song.coverUrl ? (
        <img
          src={songMediaUrl(song.coverUrl)}
          alt={"Portada de " + song.titulo}
        />
      ) : (
        <Music2 aria-hidden="true" />
      )}
    </span>
  );
}
function State({ value }: { value: SongState }) {
  return (
    <span className={"music-state " + value}>
      {value === "publicado" ? <Check size={15} /> : <FileText size={14} />}{" "}
      {value === "publicado" ? "Publicada" : "Borrador"}
    </span>
  );
}
export function ArtistDashboard() {
  const { dashboard: d } = useMusic();
  return (
    <>
      <section className="music-welcome">
        <div>
          <h1>¡Bienvenido, {d.artist.nombreArtistico}!</h1>
          <p>Gestiona, publica y haz crecer tu música en Sonic Ledger.</p>
          <Link className="music-primary" to="/artista/publicar">
            Publicar canción <ArrowRight />
          </Link>
        </div>
        <img
          src="/images/sonic-artist-hero.png"
          alt="Personaje musical iluminado en violeta y magenta"
        />
        <SoundWave />
      </section>
      <Stats />
      <div className="music-dashboard-grid">
        <section className="music-panel">
          <h2>
            <Music2 /> Canciones publicadas <em>({d.totals.published})</em>
            <Link to="/artista/canciones?estado=publicado">
              Ver todas <ArrowRight size={15} />
            </Link>
          </h2>
          {d.published.length ? (
            d.published.map((s) => (
              <Link
                to={"/artista/canciones/" + s.id + "/editar"}
                className="music-mini-song"
                key={s.id}
              >
                <Cover song={s} small />
                <div>
                  <strong>{s.titulo}</strong>
                  <small>{s.artista}</small>
                </div>
                <State value={s.estado} />
              </Link>
            ))
          ) : (
            <Empty text="Todavía no has publicado canciones." />
          )}
        </section>
        <section className="music-panel">
          <h2>
            <FileText /> Borradores <em>({d.totals.drafts})</em>
            <Link to="/artista/canciones?estado=borrador">
              Ver todos <ArrowRight size={15} />
            </Link>
          </h2>
          {d.drafts.length ? (
            d.drafts.map((s) => (
              <Link
                className="music-mini-draft"
                key={s.id}
                to={"/artista/canciones/" + s.id + "/editar"}
              >
                <div>
                  <strong>{s.titulo}</strong>
                  <small>
                    {s.genero ?? "Sin género"} ·{" "}
                    {songDuration(s.duracionSegundos)}
                  </small>
                </div>
                <State value={s.estado} />
              </Link>
            ))
          ) : (
            <Empty text="Tus próximos sonidos empiezan aquí. Guarda tu primer borrador." />
          )}
          <Link
            className="music-text-link"
            to="/artista/canciones?estado=borrador"
          >
            Ver borradores <ArrowRight size={17} />
          </Link>
        </section>
        <div className="music-dashboard-aside">
          <section className="music-panel music-quick">
            <h2>
              <Zap /> Acciones rápidas
            </h2>
            <Link to="/artista/publicar">
              <Plus /> Publicar canción
            </Link>
            <Link to="/artista/canciones">
              <ListMusic /> Administrar canciones
            </Link>
            <Link to="/perfil-artistico">
              <Pencil /> Editar perfil
            </Link>
          </section>
          <section className="music-panel music-activity">
            <h2>
              <Activity /> Actividad reciente
            </h2>
            {d.recentActivity.length ? (
              d.recentActivity.slice(0, 3).map((s) => (
                <Link key={s.id} to={"/artista/canciones/" + s.id + "/editar"}>
                  <span>
                    <Music2 size={18} />
                  </span>
                  <div>
                    <strong>{s.titulo}</strong>
                    <small>
                      {s.estado === "publicado" ? "Publicada" : "Borrador"} ·
                      Actualizada{" "}
                      {new Date(s.updatedAt).toLocaleDateString("es-BO")}
                    </small>
                  </div>
                </Link>
              ))
            ) : (
              <Empty text="Tu actividad musical aparecerá aquí cuando guardes canciones." />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="music-empty">
      <AudioLines />
      <p>{text}</p>
      <Link to="/artista/publicar">
        Crear canción <ArrowRight size={15} />
      </Link>
    </div>
  );
}
function SoundWave({ smooth = false }: { smooth?: boolean }) {
 return <svg className="music-sound-wave" viewBox="0 0 500 100" aria-hidden="true"><defs><linearGradient id="music-wave-gradient"><stop stopColor="#d925fb"/><stop offset=".5" stopColor="#f63de3"/><stop offset="1" stopColor="#009bff"/></linearGradient></defs>{smooth?<><path stroke="url(#music-wave-gradient)" d="M0 75 C100 95 135 -15 235 25 S365 105 500 30"/><path stroke="url(#music-wave-gradient)" d="M0 80 C100 30 180 70 265 76 S380 5 500 10"/></>:<path d="M0 50 L30 50 40 40 50 70 60 25 70 60 80 46 90 55 100 20 110 75 120 40 130 55 145 45 160 65 175 30 190 55 205 50 220 15 235 80 250 40 265 58 280 48 295 0 310 60 325 35 340 65 355 42 370 50 400 47 425 50 500 50"/>}</svg>;
}
const blankSong = (): SongInput => ({
  titulo: "",
  descripcion: "",
  generoId: null,
  lanzamientoId: null,
});
export function SongEditor() {
  const { options, refresh } = useMusic(),
    { id } = useParams(),
    navigate = useNavigate(),
    location = useLocation();
  const [draft, setDraft] = useState<SongInput>(blankSong),
    [song, setSong] = useState<Song | null>(null),
    [songId, setSongId] = useState<string | undefined>(id),
    [audio, setAudio] = useState<File | null>(null),
    [cover, setCover] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [target, setTarget] = useState<SongState>("publicado"),
    [message, setMessage] = useState<string>(location.state?.notice ?? ""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(Boolean(id)),
    [uploading, setUploading] = useState<{
      kind: string;
      percent: number;
    } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    if (id) {
      void songsApi
        .get(id)
        .then((s) => {
          if (active) {
            setSong(s);
            setSongId(s.id);
            setDraft({
              titulo: s.titulo,
              descripcion: s.descripcion,
              generoId: s.generoId,
              lanzamientoId: s.lanzamientoId,
            });
            setTarget(s.estado);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setMessage(e.message);
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [id]);
  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    void Promise.resolve().then(() => setPreview(url));
    return () => URL.revokeObjectURL(url);
  }, [cover]);
  function choose(kind: "audio" | "cover", file?: File) {
    if (busy || !file) return;
    const valid =
      kind === "audio"
        ? /\.wav$/i.test(file.name)
        : /\.(png|jpe?g)$/i.test(file.name);
    if (!valid) {
      setMessage(
        kind === "audio"
          ? "Solo WAV PCM está habilitado. MP3 y FLAC todavía no son compatibles."
          : "Selecciona una portada PNG o JPG.",
      );
      return;
    }
    if (file.size > (kind === "audio" ? 50 : 2) * 1024 * 1024) {
      setMessage(
        "El archivo supera el límite de " +
          (kind === "audio" ? "50" : "2") +
          " MB.",
      );
      return;
    }
    if (kind === "audio") setAudio(file);
    else setCover(file);
    setMessage("");
  }
  async function save(state: SongState) {
    if (!form.current?.reportValidity()) return;
    if (state === "publicado" && !draft.generoId) {
      setMessage("Selecciona un género antes de publicar.");
      return;
    }
    if (state === "publicado" && !audio && !song?.audioUrl) {
      setMessage("Selecciona un audio WAV válido antes de publicar.");
      return;
    }
    setBusy(true);
    setMessage("");
    let savedId = songId;
    try {
      if (savedId && song?.estado === "publicado" && state === "borrador")
        await songsApi.state(savedId, "borrador");
      let result = savedId
        ? await songsApi.update(savedId, draft)
        : await songsApi.create(draft);
      savedId = result.id;
      setSongId(result.id);
      setSong(result);
      for (const [kind, file] of [
        ["audio", audio],
        ["cover", cover],
      ] as const) {
        if (file) {
          setUploading({ kind, percent: 0 });
          result = await uploadSongFile(result.id, kind, file, (percent) =>
            setUploading({ kind, percent }),
          );
          setSong(result);
          if (kind === "audio") setAudio(null);
          else {
            setCover(null);
            setPreview("");
          }
        }
      }
      result = await songsApi.state(result.id, state);
      setSong(result);
      setTarget(result.estado);
      const notice =
        state === "publicado" ? "Canción publicada." : "Borrador guardado.";
      setMessage(notice);
      await refresh();
      if (!id)
        navigate("/artista/canciones/" + result.id + "/editar", {
          replace: true,
          state: { notice },
        });
    } catch (e) {
      setMessage(
        (e as Error).message +
          (savedId
            ? " Los cambios ya guardados se conservan; revisa la canción antes de reintentar."
            : ""),
      );
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
      setUploading(null);
    }
  }
  if (loading)
    return <div className="music-panel music-loading">Cargando canción…</div>;
  if (id && !song)
    return (
      <div className="music-panel">
        <p role="alert">{message || "Canción no encontrada."}</p>
        <Link to="/artista/canciones">Volver a mis canciones</Link>
      </div>
    );
  return (
    <>
      <div className="music-page-heading">
        <div>
          <h1>{id ? "Editar canción" : "Publicar canción"}</h1>
          <p>
            Sube tu música, completa la información y publícala en Sonic Ledger.
          </p>
        </div>
        <SoundWave smooth />
      </div>
      <p role="status" className="music-form-message">
        {message}
      </p>
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          void save(target);
        }}
      >
        <fieldset disabled={busy} className="music-publish-grid">
          <legend className="music-sr-only">Datos de la canción</legend>
          <div className="music-upload-column">
            <UploadZone
              kind="audio"
              file={audio}
              stored={song?.audioUrl ?? null}
              choose={(f) => choose("audio", f)}
              preview=""
            />
            <UploadZone
              kind="cover"
              file={cover}
              stored={song?.coverUrl ?? null}
              choose={(f) => choose("cover", f)}
              preview={preview}
            />
            {!options.uploadsEnabled && (
              <p className="music-muted">
                Las cargas locales no están habilitadas en producción.
              </p>
            )}
          </div>
          <div className="music-metadata">
            <div className="music-form-fields">
              <label>
                Título de la canción <b>*</b>
                <input
                  autoComplete="off"
                  required
                  minLength={2}
                  maxLength={150}
                  value={draft.titulo}
                  onChange={(e) =>
                    setDraft({ ...draft, titulo: e.target.value })
                  }
                />
              </label>
              <label>
                Género <b>* al publicar</b>
                <select
                  aria-label="Género"
                  value={draft.generoId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, generoId: e.target.value || null })
                  }
                >
                  <option value="">Selecciona un género</option>
                  {options.genres.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lanzamiento (opcional)
                <select
                  value={draft.lanzamientoId ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      lanzamientoId: e.target.value || null,
                    })
                  }
                >
                  <option value="">Sin lanzamiento</option>
                  {options.releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.titulo}
                    </option>
                  ))}
                </select>
                {!options.releases.length && (
                  <small>No tienes lanzamientos registrados.</small>
                )}
              </label>
              <label>
                Duración <b>* al publicar</b>
                <span className="music-duration-field">
                  <Clock3 size={20} />
                  <input
                    aria-label="Duración"
                    readOnly
                    value={
                      song?.duracionSegundos
                        ? songDuration(song.duracionSegundos)
                        : ""
                    }
                    placeholder="Se calcula al almacenar el audio"
                  />
                </span>
              </label>
            </div>
            <label>
              Descripción
              <textarea
                maxLength={2000}
                rows={5}
                value={draft.descripcion}
                onChange={(e) =>
                  setDraft({ ...draft, descripcion: e.target.value })
                }
              />
              <small>{draft.descripcion.length}/2000</small>
            </label>
            <div className="music-state-choice">
              <span>
                Estado de la canción <b>*</b>
              </span>
              <div>
                {[
                  ["borrador", "Borrador", "Solo tú podrás verla."],
                  ["publicado", "Publicado", "Requiere audio válido y género."],
                ].map(([value, label, note]) => (
                  <label
                    key={value}
                    className={target === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="estado"
                      checked={target === value}
                      onChange={() => setTarget(value as SongState)}
                    />
                    <span className="music-radio">
                      {target === value && <Check size={18} />}
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{note}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="music-form-actions">
              <button
                type="button"
                className="music-secondary"
                disabled={busy}
                onClick={() => void save("borrador")}
              >
                <Save /> Guardar borrador
              </button>
              <button className="music-primary" disabled={busy}>
                <Upload />
                {busy
                  ? "Guardando…"
                  : target === "publicado"
                    ? "Publicar"
                    : "Guardar cambios"}
              </button>
            </div>
          </div>
        </fieldset>
        {uploading && (
          <div className="music-upload-progress" role="status">
            {uploading.percent === 100 ? "Validando y almacenando" : "Subiendo"}{" "}
            {uploading.kind === "audio" ? "audio" : "portada"} ·{" "}
            {uploading.percent}%<progress max={100} value={uploading.percent} />
          </div>
        )}
      </form>
    </>
  );
}
function UploadZone({
  kind,
  file,
  stored,
  preview,
  choose,
}: {
  kind: "audio" | "cover";
  file: File | null;
  stored: string | null;
  preview: string;
  choose: (file?: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [drag, setDrag] = useState(false);
  const image = preview || songMediaUrl(stored);
  return (
    <div
      className={"music-upload-zone " + (drag ? "dragging" : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        choose(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={input}
        type="file"
        aria-label={
          kind === "audio" ? "Seleccionar audio" : "Seleccionar portada"
        }
        accept={
          kind === "audio"
            ? ".wav,audio/wav"
            : ".png,.jpg,.jpeg,image/png,image/jpeg"
        }
        onChange={(e) => {
          choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {kind === "cover" && image ? (
        <img
          className="music-upload-preview"
          src={image}
          alt="Vista previa de portada"
        />
      ) : kind === "audio" ? (
        <Music2 className="music-upload-icon" />
      ) : (
        <ImagePlus className="music-upload-icon" />
      )}
      <button type="button" onClick={() => input.current?.click()}>
        {kind === "audio" ? "Subir audio" : "Subir portada"}
      </button>
      <p>
        Arrastra y suelta {kind === "audio" ? "tu archivo" : "una imagen"} aquí
        <br />o haz clic para seleccionar{kind === "audio" ? "lo" : "la"}.
      </p>
      <small>
        {kind === "audio"
          ? "WAV PCM (máx. 50 MB). MP3/FLAC no habilitados."
          : "JPG, PNG · cuadrada, mín. 1200 × 1200 px · máx. 2 MB"}
      </small>
      {(file || stored) && (
        <span className="music-file-status">
          <Check size={16} />
          {file
            ? file.name +
              " · " +
              (file.size / 1024 / 1024).toFixed(2) +
              " MB · pendiente de guardar"
            : kind === "audio"
              ? "Audio WAV almacenado"
              : "Portada almacenada"}
        </span>
      )}
    </div>
  );
}
export function ArtistSongs() {
  const { dashboard, options, refresh } = useMusic(),
    [params, setParams] = useSearchParams();
  const [list, setList] = useState<SongList | null>(null),
    [search, setSearch] = useState(params.get("q") ?? ""),
    [message, setMessage] = useState(""),
    [filters, setFilters] = useState(false),
    [more, setMore] = useState<string | null>(null),
    [detail, setDetail] = useState<Song | null>(null),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const state = params.get("estado") ?? "",
    genre = params.get("generoId") ?? "",
    sort = params.get("sort") ?? "newest",
    page = Number(params.get("page") ?? 1);
  function filter(key: string, value: string) {
    const q = new URLSearchParams(params);
    if (value) q.set(key, value);
    else q.delete(key);
    if (key !== "page") q.delete("page");
    setParams(q);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === (params.get("q") ?? "")) return;
      const q = new URLSearchParams(params);
      if (search) q.set("q", search);
      else q.delete("q");
      q.delete("page");
      setParams(q, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, setParams]);
  useEffect(() => {
    let active = true;
    const q = new URLSearchParams(params);
    q.delete("buscar");
    q.set("pageSize", "4");
    void Promise.resolve()
      .then(() => {
        if (active) setLoading(true);
        return songsApi.list(q);
      })
      .then((value) => {
        if (active) setList(value);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params, revision]);
  useEffect(() => {
    if (detail) dialog.current?.showModal();
  }, [detail]);
  async function change(song: Song) {
    try {
      await songsApi.state(
        song.id,
        song.estado === "publicado" ? "borrador" : "publicado",
      );
      setMessage(
        song.estado === "publicado"
          ? "Publicación retirada. El registro se conserva como borrador."
          : "Canción publicada.",
      );
      setMore(null);
      await refresh();
      setRevision((v) => v + 1);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function show(song: Song) {
    try {
      setDetail(await songsApi.get(song.id));
      setMore(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <div className="music-page-heading music-list-heading">
        <div>
          <h1>Mis canciones</h1>
          <p>
            Administra tu catálogo musical, edita, publica o guarda borradores.
          </p>
        </div>
        <img
          src="/images/sonic-headphones.webp"
          alt="Audífonos con iluminación neón"
        />
        <Link className="music-primary" to="/artista/publicar">
          <Plus /> Publicar canción
        </Link>
      </div>
      <Stats />
      <div className="music-list-controls">
        <div className="music-filter-tabs">
          {[
            ["", "Todas", dashboard.totals.total],
            ["publicado", "Publicadas", dashboard.totals.published],
            ["borrador", "Borradores", dashboard.totals.drafts],
          ].map(([value, label, count]) => (
            <button
              key={String(value)}
              className={state === value ? "active" : ""}
              onClick={() => filter("estado", String(value))}
            >
              {String(label)} ({count})
            </button>
          ))}
        </div>
        <label className="music-search">
          <Search size={21} />
          <input
            autoFocus={params.has("buscar")}
            aria-label="Buscar canción"
            maxLength={100}
            placeholder="Buscar canción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className="music-filter-toggle"
          aria-expanded={filters}
          onClick={() => setFilters(!filters)}
        >
          <Filter size={19} /> Filtrar
        </button>
      </div>
      {filters && (
        <div className="music-filter-panel">
          <label>
            Género
            <select
              aria-label="Filtrar por género" value={genre}
              onChange={(e) => filter("generoId", e.target.value)}
            >
              <option value="">Todos los géneros</option>
              {options.genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ordenar
            <select
              aria-label="Ordenar" value={sort}
              onChange={(e) => filter("sort", e.target.value)}
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="title">Título A–Z</option>
            </select>
          </label>
          <button
            onClick={() => {
              setSearch("");
              setParams({});
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
      <p className="music-form-message" role="status">
        {message || (loading ? "Cargando canciones…" : "")}
      </p>
      <div className="music-song-list" aria-busy={loading}>
        {list?.items.map((song) => (
          <article className="music-song-row" key={song.id}>
            <button
              className="music-row-cover"
              aria-label={"Ver detalle de " + song.titulo}
              onClick={() => void show(song)}
            >
              <Cover song={song} />
            </button>
            <button
              className="music-song-title"
              onClick={() => void show(song)}
            >
              <strong>{song.titulo}</strong>
              <small>{song.artista}</small>
            </button>
            <span className="music-genre">{song.genero ?? "Sin género"}</span>
            <span className="music-row-wave" aria-hidden="true">
              {Array.from({ length: 25 }, (_, i) => (
                <i key={i} style={{ height: 10 + ((i * 17) % 31) + "px" }} />
              ))}
            </span>
            <span className="music-song-duration">
              {songDuration(song.duracionSegundos)}
            </span>
            <State value={song.estado} />
            <time dateTime={song.createdAt}>
              <CalendarDays size={17} />
              {new Date(song.createdAt).toLocaleDateString("es-BO")}
            </time>
            <div className="music-row-actions">
              <Link
                aria-label={"Editar " + song.titulo}
                to={"/artista/canciones/" + song.id + "/editar"}
              >
                <Pencil size={19} />
              </Link>
              <button
                aria-label={"Más opciones de " + song.titulo}
                aria-expanded={more === song.id}
                onClick={() => setMore(more === song.id ? null : song.id)}
              >
                <MoreHorizontal size={22} />
              </button>
              {more === song.id && (
                <div className="music-song-menu">
                  <button onClick={() => void show(song)}>
                    Consultar detalle
                  </button>
                  <button onClick={() => void change(song)}>
                    {song.estado === "publicado"
                      ? "Retirar publicación"
                      : "Publicar canción"}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      {list && !list.items.length && (
        <section className="music-panel">
          <Empty
            text={
              dashboard.totals.total
                ? "No hay canciones con estos filtros."
                : "Todavía no tienes canciones. Crea tu primer borrador."
            }
          />
        </section>
      )}
      {list && list.totalPages > 1 && (
        <nav className="music-pagination" aria-label="Páginas de canciones">
          <button
            disabled={page <= 1}
            aria-label="Página anterior"
            onClick={() => filter("page", String(page - 1))}
          >
            <ChevronLeft />
          </button>
          {Array.from(
            { length: Math.min(5, list.totalPages) },
            (_, i) => Math.max(1, Math.min(page - 2, list.totalPages - 4)) + i,
          ).map((n) => (
            <button
              key={n}
              aria-current={page === n ? "page" : undefined}
              onClick={() => filter("page", String(n))}
            >
              {n}
            </button>
          ))}
          <button
            disabled={page >= list.totalPages}
            aria-label="Página siguiente"
            onClick={() => filter("page", String(page + 1))}
          >
            <ChevronRight />
          </button>
        </nav>
      )}
      <dialog
        className="music-detail"
        ref={dialog}
        onClose={() => setDetail(null)}
      >
        <button
          className="music-detail-close"
          aria-label="Cerrar detalle"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        {detail && (
          <>
            <Cover song={detail} />
            <h2>{detail.titulo}</h2>
            <p>{detail.artista}</p>
            <State value={detail.estado} />
            <p>{detail.descripcion || "Sin descripción."}</p>
            <dl>
              <dt>Género</dt>
              <dd>{detail.genero ?? "Sin género"}</dd>
              <dt>Duración</dt>
              <dd>{songDuration(detail.duracionSegundos)}</dd>
              <dt>Lanzamiento</dt>
              <dd>{detail.lanzamiento ?? "Sin lanzamiento"}</dd>
            </dl>
            <Link
              className="music-primary"
              to={"/artista/canciones/" + detail.id + "/editar"}
              onClick={() => dialog.current?.close()}
            >
              Editar canción <Pencil size={18} />
            </Link>
            {detail.audioUrl && (
              <a
                className="music-text-link"
                href={songMediaUrl(detail.audioUrl)}
                download
              >
                Descargar mi audio <ArrowDownToLine size={16} />
              </a>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
