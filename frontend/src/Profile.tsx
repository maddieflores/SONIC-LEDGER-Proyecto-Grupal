import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SonicSidebar } from "./components/SonicSidebar";
import {
  Search,
  Bell,
  UserRound,
  Camera,
  Mail,
  AtSign,
  Music2,
  SlidersHorizontal,
  Zap,
  ArrowRight,
} from "lucide-react";
import { ApiError, request } from "./auth-api";
import {
  adjustments,
  moods,
  profileUpdate,
  toggle,
  type Genre,
  type Profile,
} from "../../shared/profile";
import "./Profile.css";
export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [genres, setGenres] = useState<Genre[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([
        request<Profile>("profile"),
        request<Genre[]>("profile/genres"),
      ]);
      setProfile(p);
      setGenres(g);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        navigate("/iniciar-sesion", { replace: true });
      else setMessage((e as Error).message);
    }
  }, [navigate]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function save(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    setMessage("");
    try {
      setProfile(await request<Profile>("profile", profileUpdate(profile)));
      setMessage("Cambios guardados.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const unavailable = () =>
    setMessage("Esta sección todavía no está disponible.");
  return (
    <div className="profile-page">
      <SonicSidebar />
      <div className="profile-main-wrapper">
        <header className="profile-header">
          <nav>
            {["Música", "DJ con IA", "Conciertos"].map((t) => (
              <button type="button" onClick={() => t === "DJ con IA" ? navigate("/dj") : unavailable()} key={t}>
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
        <main className="profile-main">
          <div className="profile-heading">
            <h1>Perfil y preferencias</h1>
            <p>
              Edita tu información personal y personaliza tu experiencia
              musical.
            </p>
            <svg
              className="profile-wave"
              viewBox="0 0 600 110"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="profile-wave-color">
                  <stop stopColor="#ff24e6" />
                  <stop offset=".55" stopColor="#b63dff" />
                  <stop offset="1" stopColor="#16b9ff" />
                </linearGradient>
              </defs>
              <path d="M0 75 C120 -35 170 10 290 65 S460 105 600 15" />
              <path d="M0 85 C140 15 220 30 335 78 S500 35 600 48" />
            </svg>
          </div>
          <p role="status" className="profile-status">
            {message}
          </p>
          {!profile ? (
            <div className="profile-loading">
              {message ? (
                <button onClick={() => void load()}>Reintentar</button>
              ) : (
                "Cargando tu perfil…"
              )}
            </div>
          ) : (
            <form className="profile-panels" onSubmit={save}>
              <fieldset disabled={busy} className="profile-card">
                <legend className="sr-only">Datos de perfil</legend>
                <h2>
                  <UserRound /> Datos de perfil
                </h2>
                <div className="profile-avatar">
                  <UserRound size={78} />
                  <button
                    type="button"
                    aria-label="Información sobre cambiar avatar"
                    onClick={() =>
                      setMessage(
                        "La carga de avatar requiere almacenamiento seguro; todavía no está disponible.",
                      )
                    }
                  >
                    <Camera size={22} />
                  </button>
                </div>
                <label>
                  Nombre para mostrar
                  <span className="profile-input">
                    <UserRound />
                    <input
                      required
                      minLength={2}
                      maxLength={60}
                      value={profile.displayName}
                      onChange={(e) =>
                        setProfile({ ...profile, displayName: e.target.value })
                      }
                    />
                  </span>
                </label>
                <label>
                  Usuario
                  <span className="profile-input">
                    <AtSign />
                    <input readOnly value={profile.username} />
                  </span>
                </label>
                <label>
                  Correo electrónico
                  <span className="profile-input">
                    <Mail />
                    <input type="email" readOnly value={profile.email} />
                  </span>
                </label>
                <label>
                  Biografía (máx. 300 caracteres)
                  <span className="profile-biography">
                    <textarea
                      maxLength={300}
                      rows={4}
                      value={profile.biography}
                      onChange={(e) =>
                        setProfile({ ...profile, biography: e.target.value })
                      }
                    />
                    <small>{profile.biography.length}/300</small>
                  </span>
                </label>
              </fieldset>
              <fieldset
                disabled={busy}
                className="profile-card profile-preferences"
              >
                <legend className="sr-only">Preferencias musicales</legend>
                <h2>
                  <SlidersHorizontal /> Preferencias musicales
                </h2>
                <p>Personaliza tus gustos y recomendaciones.</p>
                <section>
                  <h3>
                    <Music2 /> Géneros favoritos
                  </h3>
                  <div className="profile-chips">
                    {(expanded ? genres : genres.slice(0, 5)).map((g) => (
                      <button
                        type="button"
                        aria-pressed={profile.genreIds.includes(g.id)}
                        key={g.id}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            genreIds: toggle(profile.genreIds, g.id),
                          })
                        }
                      >
                        {profile.genreIds.includes(g.id) && "✓ "}
                        {g.nombre}
                      </button>
                    ))}
                    {genres.length > 5 && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpanded(!expanded)}
                      >
                        {expanded ? "− Menos" : "+ Agregar"}
                      </button>
                    )}
                  </div>
                  {!genres.length && (
                    <p>No hay géneros disponibles en el catálogo.</p>
                  )}
                </section>
                <section>
                  <h3>
                    <Zap /> Momentos o estados de ánimo
                  </h3>
                  <div className="profile-chips">
                    {moods.map((m) => (
                      <button
                        type="button"
                        key={m}
                        aria-pressed={profile.moods.includes(m)}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            moods: toggle(profile.moods, m),
                          })
                        }
                      >
                        {profile.moods.includes(m) && "✓ "}
                        {m}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="profile-adjustments">
                  <h3>
                    <SlidersHorizontal /> Ajustes de recomendaciones
                  </h3>
                  {adjustments.map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={profile[key]}
                          style={
                            {
                              "--value": profile[key] + "%",
                            } as React.CSSProperties
                          }
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              [key]: Number(e.target.value),
                            })
                          }
                        />
                        <output>{profile[key]}%</output>
                      </span>
                    </label>
                  ))}
                </section>
                <button className="profile-save" disabled={busy}>
                  {busy ? "Guardando…" : "Guardar cambios"}
                  <ArrowRight size={21} />
                </button>
              </fieldset>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

