import { PlaybackContext as Context, usePlayback } from "./PlaybackContext";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Heart,
  ListMusic,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from "lucide-react";
import { catalogCoverUrl, type CatalogSong } from "../../shared/catalog";
import {
  cycleRepeat,
  nextIndex,
  playbackTime,
  publishedAudioUrl,
  shuffleSongs,
  type RepeatMode,
} from "../../shared/playback";
import { checkFavorites, toggleFavorite } from "../../shared/library-api";
import { recordPlaybackEvent } from "../../shared/history-api";
import { isValidPlayback } from "../../shared/history";
import "./Playback.css";
const base = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null),
    generation = useRef(0),
    original = useRef<CatalogSong[]>([]);
  const sessionRef = useRef<{
    songId: string;
    source: "LOCAL" | "AUDIUS";
    sessionId: string;
    startedAt: string;
    lastPosition: number;
    listenedSeconds: number;
    duration: number;
    playedSent: boolean;
  } | null>(null);
  const [queue, setQueue] = useState<CatalogSong[]>([]),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(0),
    [error, setError] = useState(""),
    [repeat, setRepeat] = useState<RepeatMode>("none"),
    [shuffle, setShuffle] = useState(false),
    [volume, setVolumeState] = useState(1);
  const location = useLocation();
  const song = queue[index] ?? null;
  function begin(
    selected: CatalogSong,
    items: CatalogSong[],
    selectedIndex: number,
  ) {
    const element = audio.current;
    if (!element) return;
    if (selected.playable === false) {
      setError("El audio de esta publicación no está disponible.");
      return;
    }

    if (sessionRef.current && !sessionRef.current.playedSent && sessionRef.current.listenedSeconds >= 2) {
      void recordPlaybackEvent(base, {
        trackId: sessionRef.current.songId,
        source: sessionRef.current.source,
        listenedSeconds: Math.round(sessionRef.current.listenedSeconds * 10) / 10,
        trackDurationSeconds: sessionRef.current.duration || null,
        clientEventId: sessionRef.current.sessionId,
        startedAt: sessionRef.current.startedAt,
        endedAt: new Date().toISOString(),
        eventType: "SKIPPED",
      }).catch(() => {});
    }

    sessionRef.current = {
      songId: selected.id,
      source: selected.source || "LOCAL",
      sessionId: `web-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      startedAt: new Date().toISOString(),
      lastPosition: 0,
      listenedSeconds: 0,
      duration: selected.duracionSegundos || 0,
      playedSent: false,
    };

    const version = ++generation.current;
    element.pause();
    setQueue(items);
    setIndex(selectedIndex);
    setError("");
    setLoading(true);
    setPosition(0);
    setDuration(0);
    element.src = publishedAudioUrl(base, selected.id);
    element.load();
    void element.play().catch((e) => {
      if (version !== generation.current || e.name === "AbortError") return;
      setLoading(false);
      setPlaying(false);
      setError(
        e.name === "NotAllowedError"
          ? "Pulsa reproducir para iniciar el audio."
          : "No se pudo reproducir el audio. Comprueba tu conexión o vuelve a iniciar sesión.",
      );
    });
  }
  function play(selected: CatalogSong, items: CatalogSong[] = [selected]) {
    if (song?.id === selected.id && !error) {
      toggle();
      return;
    }
    const valid = items.filter((s) => s.playable !== false);
    if (!valid.some((s) => s.id === selected.id)) valid.unshift(selected);
    original.current = valid;
    const ordered = shuffle ? shuffleSongs(valid, selected) : valid;
    begin(
      selected,
      ordered,
      ordered.findIndex((s) => s.id === selected.id),
    );
  }
  function toggle() {
    const element = audio.current;
    if (!element || !song) return;
    if (error) {
      begin(song, queue, index);
      return;
    }
    if (element.paused) {
      if (element.ended) element.currentTime = 0;
      setError("");
      void element
        .play()
        .catch(() =>
          setError(
            "No se pudo reanudar el audio. Vuelve a seleccionar la canción.",
          ),
        );
    } else element.pause();
  }
  function seek(value: number) {
    const element = audio.current;
    if (element && Number.isFinite(element.duration)) {
      element.currentTime = Math.max(0, Math.min(value, element.duration));
      setPosition(element.currentTime);
    }
  }
  function next(ended = false) {
    const target = nextIndex(index, queue.length, repeat, ended);
    if (target < 0) {
      setPlaying(false);
      return;
    }
    if (ended && target === index && repeat === "one") {
      seek(0);
      void audio.current
        ?.play()
        .catch(() => setError("No se pudo repetir el audio."));
    } else begin(queue[target], queue, target);
  }
  function previous() {
    if (position > 3) {
      seek(0);
      return;
    }
    const target =
      index > 0 ? index - 1 : repeat === "all" ? queue.length - 1 : 0;
    if (queue[target]) begin(queue[target], queue, target);
  }
  function stop() {
    if (sessionRef.current && !sessionRef.current.playedSent && sessionRef.current.listenedSeconds >= 2) {
      void recordPlaybackEvent(base, {
        trackId: sessionRef.current.songId,
        source: sessionRef.current.source,
        listenedSeconds: Math.round(sessionRef.current.listenedSeconds * 10) / 10,
        trackDurationSeconds: sessionRef.current.duration || null,
        clientEventId: sessionRef.current.sessionId,
        startedAt: sessionRef.current.startedAt,
        endedAt: new Date().toISOString(),
        eventType: "SKIPPED",
      }).catch(() => {});
    }
    sessionRef.current = null;
    generation.current++;
    const element = audio.current;
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    setQueue([]);
    setIndex(0);
    setPosition(0);
    setDuration(0);
    setLoading(false);
    setPlaying(false);
    setError("");
  }
  function changeShuffle() {
    if (song) {
      const ordered = shuffle ? original.current : shuffleSongs(queue, song);
      setQueue(ordered);
      setIndex(
        Math.max(
          0,
          ordered.findIndex((s) => s.id === song.id),
        ),
      );
    }
    setShuffle(!shuffle);
  }
  useEffect(() => {
    const element = audio.current;
    return () => {
      element?.pause();
      element?.removeAttribute("src");
      element?.load();
    };
  }, []);
  useEffect(() => {
    if (
      !/^\/(inicio|explorar|artista|artistas|perfil|reproduciendo|mi-musica|playlists|favoritos|historial|lanzamientos)(\/|$|-)/.test(
        location.pathname,
      )
    )
      void Promise.resolve().then(stop);
  }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle("has-sonic-player", Boolean(song));
    return () => document.body.classList.remove("has-sonic-player");
  }, [song]);
  return (
    <Context.Provider
      value={{
        song,
        queue,
        index,
        playing,
        loading,
        position,
        duration,
        error,
        repeat,
        shuffle,
        volume,
        play,
        toggle,
        seek,
        next: () => next(false),
        previous,
        setRepeat: () => setRepeat(cycleRepeat(repeat)),
        setShuffle: changeShuffle,
        setVolume: (value) => {
          const v = Math.max(0, Math.min(1, value));
          if (audio.current) audio.current.volume = v;
          setVolumeState(v);
        },
        stop,
      }}
    >
      <audio
        ref={audio}
        data-testid="global-audio"
        crossOrigin="use-credentials"
        preload="metadata"
        onLoadedMetadata={() => {
          const value = audio.current?.duration ?? 0;
          setDuration(Number.isFinite(value) ? value : 0);
        }}
        onTimeUpdate={() => {
          const cur = audio.current?.currentTime ?? 0;
          setPosition(cur);
          if (sessionRef.current && audio.current && !audio.current.paused) {
            const delta = cur - sessionRef.current.lastPosition;
            if (delta > 0 && delta < 2) {
              sessionRef.current.listenedSeconds += delta;
            }
            sessionRef.current.lastPosition = cur;
            if (!sessionRef.current.playedSent) {
              const dur = sessionRef.current.duration || audio.current.duration || 0;
              if (isValidPlayback(sessionRef.current.listenedSeconds, dur)) {
                sessionRef.current.playedSent = true;
                void recordPlaybackEvent(base, {
                  trackId: sessionRef.current.songId,
                  source: sessionRef.current.source,
                  listenedSeconds: Math.round(sessionRef.current.listenedSeconds * 10) / 10,
                  trackDurationSeconds: dur || null,
                  clientEventId: sessionRef.current.sessionId,
                  startedAt: sessionRef.current.startedAt,
                  endedAt: new Date().toISOString(),
                  eventType: "PLAYED",
                }).catch(() => {});
              }
            }
          }
        }}
        onPlaying={() => {
          setPlaying(true);
          setLoading(false);
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onEnded={() => {
          if (sessionRef.current && !sessionRef.current.playedSent) {
            const dur = sessionRef.current.duration || audio.current?.duration || 0;
            const valid = isValidPlayback(sessionRef.current.listenedSeconds, dur);
            sessionRef.current.playedSent = true;
            void recordPlaybackEvent(base, {
              trackId: sessionRef.current.songId,
              source: sessionRef.current.source,
              listenedSeconds: Math.round(sessionRef.current.listenedSeconds * 10) / 10,
              trackDurationSeconds: dur || null,
              clientEventId: sessionRef.current.sessionId,
              startedAt: sessionRef.current.startedAt,
              endedAt: new Date().toISOString(),
              eventType: valid ? "PLAYED" : "SKIPPED",
            }).catch(() => {});
          }
          next(true);
        }}
        onError={() => {
          if (audio.current?.getAttribute("src")) {
            setError(
              "Audio no disponible o sesión vencida. Vuelve a seleccionar una canción publicada.",
            );
            setPlaying(false);
            setLoading(false);
          }
        }}
      />
      {children}
    </Context.Provider>
  );
}
export function SongArtwork({
  song,
  circular = false,
}: {
  song: CatalogSong;
  circular?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={"song-artwork " + (circular ? "circular" : "")}>
      {song.coverUrl && !broken ? (
        <img
          src={catalogCoverUrl(base, song.coverUrl)}
          alt={"Portada de " + song.titulo}
          onError={() => setBroken(true)}
        />
      ) : (
        <Music2 />
      )}
    </span>
  );
}
export function WaveformProgress({ compact = false }: { compact?: boolean }) {
  const p = usePlayback();
  return (
    <div className={"waveform-progress " + (compact ? "compact" : "")}>
      <div className="waveform-bars" aria-hidden="true">
        {Array.from({ length: 60 }, (_, i) => (
          <i
            key={i}
            style={{
              height: 12 + ((i * 23) % 43) + "%",
              background:
                i / 60 <= p.position / (p.duration || 1)
                  ? "linear-gradient(#fb51e5,#c932fa)"
                  : "linear-gradient(#608aff,#7166c4)",
            }}
          />
        ))}
      </div>
      <input
        aria-label="Posición de reproducción"
        type="range"
        min={0}
        max={p.duration || 1}
        step="0.01"
        value={Math.min(p.position, p.duration || 0)}
        disabled={!p.duration}
        onInput={(e) => p.seek(Number(e.currentTarget.value))}
      />
    </div>
  );
}
export function PlaybackControls({ full = false }: { full?: boolean }) {
  const p = usePlayback();
  return (
    <div className="playback-controls">
      {full && (
        <button
          aria-label="Aleatorio"
          aria-pressed={p.shuffle}
          onClick={p.setShuffle}
        >
          <Shuffle />
        </button>
      )}
      <button
        aria-label="Canción anterior"
        disabled={!p.song}
        onClick={p.previous}
      >
        <SkipBack fill="currentColor" />
      </button>
      <button
        className="playback-toggle"
        aria-label={p.playing ? "Pausar" : "Reproducir"}
        disabled={!p.song || p.loading}
        onClick={p.toggle}
      >
        {p.loading ? (
          <LoaderCircle />
        ) : p.playing ? (
          <Pause fill="currentColor" />
        ) : (
          <Play fill="currentColor" />
        )}
      </button>
      <button
        aria-label="Canción siguiente"
        disabled={nextIndex(p.index, p.queue.length, p.repeat) < 0}
        onClick={p.next}
      >
        <SkipForward fill="currentColor" />
      </button>
      {full && (
        <button
          aria-label={"Repetir: " + p.repeat}
          aria-pressed={p.repeat !== "none"}
          onClick={p.setRepeat}
        >
          {p.repeat === "one" ? <Repeat1 /> : <Repeat />}
        </button>
      )}
    </div>
  );
}
export function PlaybackQueue({ close }: { close: () => void }) {
  const p = usePlayback();
  return (
    <section className="playback-queue" aria-label="Cola de reproducción">
      <header>
        <h2>Cola de reproducción</h2>
        <button aria-label="Cerrar cola" onClick={close}>
          <X />
        </button>
      </header>
      {p.queue.map((song, i) => (
        <button
          className={i === p.index ? "active" : ""}
          key={song.id}
          onClick={() => p.play(song, p.queue)}
        >
          <SongArtwork song={song} />
          <span>
            {song.titulo}
            <small>{song.artista.nombre}</small>
          </span>
          {i === p.index && <AudioStatus playing={p.playing} />}
        </button>
      ))}
    </section>
  );
}
function AudioStatus({ playing }: { playing: boolean }) {
  return (
    <span className="audio-status">{playing ? "Sonando" : "Pausada"}</span>
  );
}
function useSongFavorite(songId?: string, source?: "LOCAL" | "AUDIUS") {
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!songId) {
      setIsFav(false);
      return;
    }
    let cancelled = false;
    void checkFavorites(base, [songId])
      .then((map: Record<string, boolean>) => {
        if (!cancelled) setIsFav(Boolean(map[songId]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const toggle = async () => {
    if (!songId || loading) return;
    setLoading(true);
    try {
      const res = await toggleFavorite(base, songId, isFav, source || "LOCAL");
      setIsFav(res.favorited);
    } catch {
      // Ignora error silenciosamente si no autenticado
    } finally {
      setLoading(false);
    }
  };

  return { isFav, toggle, loading };
}

export function MiniPlayerWeb() {
  const p = usePlayback(),
    location = useLocation();
  const [queue, setQueue] = useState(false);
  const fav = useSongFavorite(p.song?.id, p.song?.source);
  if (!p.song || location.pathname === "/reproduciendo") return null;
  return (
    <>
      <section className="mini-player-web" aria-label="Reproductor persistente">
        <Link className="mini-song" to="/reproduciendo">
          <SongArtwork key={p.song.id} song={p.song} circular />
          <span>
            <strong>{p.song.titulo}</strong>
            <small>{p.song.artista.nombre}</small>
          </span>
        </Link>
        <WaveformProgress compact />
        <span className="player-time">
          {playbackTime(p.position)} / {playbackTime(p.duration)}
        </span>
        <PlaybackControls />
        <button
          className="player-icon"
          aria-label="Abrir cola"
          aria-expanded={queue}
          onClick={() => setQueue(!queue)}
        >
          <ListMusic />
        </button>
        <button
          className={`player-icon player-favorite ${fav.isFav ? "active" : ""}`}
          aria-label={fav.isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          disabled={fav.loading}
          onClick={fav.toggle}
        >
          <Heart fill={fav.isFav ? "currentColor" : "none"} />
        </button>
        <button
          className="player-icon player-close"
          aria-label="Cerrar reproductor"
          onClick={p.stop}
        >
          <X size={17} />
        </button>
        {p.error && (
          <p role="alert" className="player-error">
            {p.error}
          </p>
        )}
      </section>
      {queue && <PlaybackQueue close={() => setQueue(false)} />}
    </>
  );
}
export function FullPlayerWeb() {
  const p = usePlayback(),
    [queue, setQueue] = useState(false);
  const fav = useSongFavorite(p.song?.id, p.song?.source);
  return (
    <main className="full-player-web">
      <Link className="player-back" to="/explorar">
        Volver a Explorar
      </Link>
      {p.song ? (
        <>
          <p className="now-heading">Reproduciendo ahora</p>
          <SongArtwork key={p.song.id} song={p.song} circular />
          <h1>{p.song.titulo}</h1>
          <Link to={"/artistas/" + p.song.artista.id}>
            {p.song.artista.nombre}
          </Link>
          {p.song.genero && (
            <small className="player-genre">{p.song.genero.nombre}</small>
          )}
          <WaveformProgress />
          <div className="full-player-times">
            <span>{playbackTime(p.position)}</span>
            <span>{playbackTime(p.duration)}</span>
          </div>
          <PlaybackControls full />
          <div className="player-extras">
            <Volume2 />
            <input
              aria-label="Volumen"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
            />
            <button aria-label="Abrir cola" onClick={() => setQueue(!queue)}>
              <ListMusic />
            </button>
            <button
              className={fav.isFav ? "player-favorite active" : ""}
              aria-label={fav.isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
              disabled={fav.loading}
              onClick={fav.toggle}
            >
              <Heart fill={fav.isFav ? "currentColor" : "none"} />
            </button>
          </div>
          {p.error && (
            <p role="alert" className="player-error">
              {p.error}
            </p>
          )}
          {queue && <PlaybackQueue close={() => setQueue(false)} />}
        </>
      ) : (
        <p>
          No hay una canción activa. Selecciona una publicación en Explorar.
        </p>
      )}
    </main>
  );
}
