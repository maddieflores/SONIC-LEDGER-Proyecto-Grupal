import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { router, usePathname } from "expo-router";
import { getToken } from "../../services/session";
import { CatalogIcon } from "../../components/CatalogIcon";
import { catalogCoverUrl, type CatalogSong } from "../../../../shared/catalog";
import {
  cycleRepeat,
  nextIndex,
  playbackTime,
  publishedAudioUrl,
  shuffleSongs,
  type RepeatMode,
} from "../../../../shared/playback";
import { checkFavorites, toggleFavorite } from "../../../../shared/library-api";
import { recordPlaybackEvent } from "../../../../shared/history-api";
import { isValidPlayback } from "../../../../shared/history";
const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
type NativeState = {
  song: CatalogSong | null;
  queue: CatalogSong[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  error: string;
  repeat: RepeatMode;
  shuffle: boolean;
  volume: number;
  play: (song: CatalogSong, queue?: CatalogSong[]) => void;
  toggle: () => void;
  seek: (value: number) => void;
  next: () => void;
  previous: () => void;
  setRepeat: () => void;
  setShuffle: () => void;
  setVolume: (value: number) => void;
  stop: () => void;
  token: string;
};
const Context = createContext<NativeState | null>(null);
export function useNativePlayback() {
  const value = useContext(Context);
  if (!value) throw new Error("Falta NativePlayerProvider.");
  return value;
}
export function NativePlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const player = useAudioPlayer(null, { updateInterval: 250 }),
    status = useAudioPlayerStatus(player),
    pathname = usePathname();
  const [queue, setQueue] = useState<CatalogSong[]>([]),
    [index, setIndex] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [repeat, setRepeat] = useState<RepeatMode>("none"),
    [shuffle, setShuffle] = useState(false),
    [volume, setVolume] = useState(1),
    [token, setToken] = useState("");
  const generation = useRef(0),
    download = useRef<AbortController | null>(null),
    blob = useRef<string | null>(null),
    original = useRef<CatalogSong[]>([]),
    end = useRef<() => void>(() => {});
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
  const song = queue[index] ?? null;
  const stop = useCallback(() => {
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
    download.current?.abort();
    player.pause();
    player.replace(null);
    if (blob.current) {
      URL.revokeObjectURL(blob.current);
      blob.current = null;
    }
    setQueue([]);
    setLoading(false);
    setError("");
  }, [player]);
  async function begin(
    selected: CatalogSong,
    items: CatalogSong[],
    selectedIndex: number,
  ) {
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
      sessionId: `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      startedAt: new Date().toISOString(),
      lastPosition: 0,
      listenedSeconds: 0,
      duration: selected.duracionSegundos || 0,
      playedSent: false,
    };

    const version = ++generation.current;
    download.current?.abort();
    player.pause();
    setQueue(items);
    setIndex(selectedIndex);
    setLoading(true);
    setError("");
    try {
      const t = await getToken();
      if (version !== generation.current) return;
      if (!t) throw new Error("Vuelve a iniciar sesión para reproducir.");
      setToken(t);
      const uri = publishedAudioUrl(base, selected.id);
      if (blob.current) {
        URL.revokeObjectURL(blob.current);
        blob.current = null;
      }
      if (Platform.OS === "web") {
        const controller = new AbortController();
        download.current = controller;
        const response = await fetch(uri, {
          headers: { Authorization: "Bearer " + t },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Audio no disponible o sesión vencida.");
        const bytes = await response.blob();
        if (version !== generation.current) return;
        blob.current = URL.createObjectURL(bytes);
        player.replace({ uri: blob.current });
      } else player.replace({ uri, headers: { Authorization: "Bearer " + t } });
      player.play();
      setLoading(false);
    } catch (e) {
      if (
        version === generation.current &&
        (e as Error).name !== "AbortError"
      ) {
        setError((e as Error).message || "No se pudo cargar el audio.");
        setLoading(false);
      }
    }
  }
  function play(selected: CatalogSong, items: CatalogSong[] = [selected]) {
    if (selected.id === song?.id && !error) {
      toggle();
      return;
    }
    const valid = items.filter((s) => s.playable !== false);
    if (!valid.some((s) => s.id === selected.id)) valid.unshift(selected);
    original.current = valid;
    const ordered = shuffle ? shuffleSongs(valid, selected) : valid;
    void begin(
      selected,
      ordered,
      ordered.findIndex((s) => s.id === selected.id),
    );
  }
  function toggle() {
    if (!song) return;
    if (error || status.error) {
      void begin(song, queue, index);
      return;
    }
    try {
      if (status.playing) player.pause();
      else {
        if (status.didJustFinish)
          void player.seekTo(0).then(() => player.play());
        else player.play();
      }
    } catch {
      setError(
        "No se pudo reanudar el audio. Vuelve a seleccionar la canción.",
      );
    }
  }
  function seek(value: number) {
    if (status.isLoaded)
      void player
        .seekTo(Math.max(0, Math.min(value, status.duration)))
        .catch(() => setError("No se pudo cambiar la posición."));
  }
  function next(ended = false) {
    const target = nextIndex(index, queue.length, repeat, ended);
    if (target < 0) {
      player.pause();
      return;
    }
    if (ended && target === index && repeat === "one")
      void player.seekTo(0).then(() => player.play());
    else void begin(queue[target], queue, target);
  }
  function previous() {
    if (status.currentTime > 3) {
      seek(0);
      return;
    }
    const target =
      index > 0 ? index - 1 : repeat === "all" ? queue.length - 1 : 0;
    if (queue[target]) void begin(queue[target], queue, target);
  }
  useEffect(() => {
    end.current = () => next(true);
  });
  useEffect(() => {
    if (!sessionRef.current) return;
    const cur = status.currentTime || 0;
    if (status.playing) {
      const delta = cur - sessionRef.current.lastPosition;
      if (delta > 0 && delta < 2) {
        sessionRef.current.listenedSeconds += delta;
      }
      if (!sessionRef.current.playedSent) {
        const dur = sessionRef.current.duration || status.duration || 0;
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
    sessionRef.current.lastPosition = cur;
  }, [status.currentTime, status.playing, status.duration]);
  useEffect(() => {
    if (status.didJustFinish) {
      if (sessionRef.current && !sessionRef.current.playedSent) {
        const dur = sessionRef.current.duration || status.duration || 0;
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
      void Promise.resolve().then(() => end.current());
    }
  }, [status.didJustFinish]);
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
    }).catch(() => setError("No se pudo configurar la sesión de audio."));
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => {
      subscription.remove();
      download.current?.abort();
      if (blob.current) URL.revokeObjectURL(blob.current);
    };
  }, [player]);
  useEffect(() => {
    if (
      !/^\/(inicio|explorar|perfil|reproduciendo|mi-musica|lanzamientos|publicar-cancion)(\/|$|-)/.test(
        pathname,
      )
    )
      void Promise.resolve().then(stop);
  }, [pathname, stop]);
  const audioError = error || (status.error ? "No se pudo reproducir el audio. Comprueba tu conexión o vuelve a seleccionar la canción." : "");
  return (
    <Context.Provider
      value={{
        song,
        queue,
        index,
        playing: status.playing,
        loading: loading || status.isBuffering,
        position: status.currentTime || 0,
        duration: status.isLoaded ? status.duration : 0,
        error: audioError,
        repeat,
        shuffle,
        volume,
        token,
        play,
        toggle,
        seek,
        next: () => next(false),
        previous,
        setRepeat: () => setRepeat(cycleRepeat(repeat)),
        setShuffle: () => {
          if (song) {
            const ordered = shuffle
              ? original.current
              : shuffleSongs(queue, song);
            setQueue(ordered);
            setIndex(
              Math.max(
                0,
                ordered.findIndex((s) => s.id === song.id),
              ),
            );
          }
          setShuffle(!shuffle);
        },
        setVolume: (value) => {
          const v = Math.max(0, Math.min(1, value));
          player.volume = v;
          setVolume(v);
        },
        stop,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function PlayerIcon({
  name,
  size = 24,
  color = "#e4cfef",
}: {
  name:
    | "play"
    | "pause"
    | "previous"
    | "next"
    | "shuffle"
    | "repeat"
    | "queue"
    | "volume"
    | "heart"
    | "close";
  size?: number;
  color?: string;
}) {
  if (["play", "heart", "close"].includes(name))
    return (
      <CatalogIcon
        name={name as "play" | "heart" | "close"}
        size={size}
        color={color}
      />
    );
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible={false}
    >
      {name === "pause" ? (
        <View style={{ flexDirection: "row", gap: 5 }}>
          <View
            style={{
              width: 5,
              height: 19,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: 5,
              height: 19,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
        </View>
      ) : name === "previous" || name === "next" ? (
        <View
          style={{
            width: 24,
            height: 24,
            transform: [{ rotate: name === "next" ? "180deg" : "0deg" }],
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 4,
              top: 4,
              width: 2,
              height: 17,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 8,
              top: 5,
              width: 0,
              height: 0,
              borderTopWidth: 8,
              borderBottomWidth: 8,
              borderRightWidth: 11,
              borderRightColor: color,
              borderTopColor: "transparent",
              borderBottomColor: "transparent",
            }}
          />
        </View>
      ) : name === "queue" ? (
        <View style={{ gap: 5 }}>
          {[0, 1, 2].map((n) => (
            <View
              key={n}
              style={{ width: 20, height: 1.7, backgroundColor: color }}
            />
          ))}
        </View>
      ) : name === "repeat" ? (
        <View
          style={{
            width: 22,
            height: 15,
            borderWidth: 1.6,
            borderColor: color,
            borderRadius: 7,
          }}
        />
      ) : name === "shuffle" ? (
        <View style={{ width: 24, height: 24 }}>
          {[-1, 1].map((n) => (
            <View
              key={n}
              style={{
                position: "absolute",
                left: 2,
                top: 11,
                width: 20,
                height: 1.7,
                backgroundColor: color,
                transform: [{ rotate: n * 30 + "deg" }],
              }}
            />
          ))}
        </View>
      ) : (
        <View
          style={{
            width: 19,
            height: 16,
            borderWidth: 1.6,
            borderColor: color,
            borderTopRightRadius: 8,
            borderBottomRightRadius: 8,
          }}
        />
      )}
    </View>
  );
}
export function NativeSongArtwork({
  song,
  large = false,
}: {
  song: CatalogSong;
  large?: boolean;
}) {
  const { token } = useNativePlayback(),
    [blobUrl, setBlobUrl] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  const uri = catalogCoverUrl(base, song.coverUrl);
  useEffect(() => {
    if (Platform.OS !== "web" || !uri || !token) return;
    const controller = new AbortController();
    let url: string | undefined;
    void fetch(uri, {
      headers: uri.startsWith(base + "/") ? { Authorization: "Bearer " + token } : undefined,
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((b) => {
        if (!controller.signal.aborted) {
          url = URL.createObjectURL(b);
          setBlobUrl(url);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [uri, token]);
  const source =
    uri && !failed
      ? Platform.OS === "web"
        ? blobUrl
          ? { uri: blobUrl }
          : null
        : { uri, headers: uri.startsWith(base + "/") ? { Authorization: "Bearer " + token } : undefined }
      : null;
  const { width } = useWindowDimensions();
  return (
    <LinearGradient
      colors={["#ea29e4", "#8e2bff", "#008fea"]}
      style={[
        s.artRing,
        large && {
          width: Math.min(width * 0.74, 330),
          height: Math.min(width * 0.74, 330),
          borderRadius: 200,
          padding: 3,
        },
      ]}
    >
      <View style={s.artInside}>
        {source ? (
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={"Portada de " + song.titulo}
            onError={() => setFailed(true)}
          />
        ) : (
          <CatalogIcon name="music" size={large ? 70 : 24} color="#d3a9e8" />
        )}
      </View>
    </LinearGradient>
  );
}
export function NativeWaveform() {
  const p = useNativePlayback();
  const [width, setWidth] = useState(1);
  const move = (x: number) => p.seek((x / width) * p.duration);
  return (
    <View
      style={s.waveWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel="Posición de reproducción"
      accessibilityValue={{
        min: 0,
        max: Math.round(p.duration),
        now: Math.round(p.position),
        text: playbackTime(p.position) + " de " + playbackTime(p.duration),
      }}
      accessibilityActions={[
        { name: "increment", label: "Adelantar 5 segundos" },
        { name: "decrement", label: "Retroceder 5 segundos" },
      ]}
      onAccessibilityAction={(e) =>
        p.seek(p.position + (e.nativeEvent.actionName === "increment" ? 5 : -5))
      }
      onStartShouldSetResponder={() => Boolean(p.duration)}
      onResponderGrant={(e) => move(e.nativeEvent.locationX)}
      onResponderMove={(e) => move(e.nativeEvent.locationX)}
    >
      <View style={s.waveBars} pointerEvents="none">
        {Array.from({ length: 50 }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              minWidth: 2,
              borderRadius: 3,
              height: 8 + ((i * 17) % 33),
              backgroundColor:
                i / 50 <= p.position / (p.duration || 1)
                  ? "#e743e6"
                  : "#6a66cd",
            }}
          />
        ))}
      </View>
      <View
        style={[
          s.wavePosition,
          { left: Math.min(100, (p.position / (p.duration || 1)) * 100) + "%" },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}
export function NativeControls() {
  const p = useNativePlayback();
  return (
    <View style={s.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aleatorio"
        accessibilityState={{ selected: p.shuffle }}
        onPress={p.setShuffle}
        style={s.control}
      >
        <PlayerIcon name="shuffle" color={p.shuffle ? "#f149ed" : "#c0a7d2"} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Canción anterior"
        onPress={p.previous}
        style={s.control}
      >
        <PlayerIcon name="previous" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.playing ? "Pausar" : "Reproducir"}
        disabled={p.loading}
        onPress={p.toggle}
        style={s.mainPlay}
      >
        <LinearGradient
          colors={["#c550d8", "#7f298e"]}
          style={StyleSheet.absoluteFill}
        />
        <PlayerIcon name={p.playing ? "pause" : "play"} size={30} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Canción siguiente"
        disabled={nextIndex(p.index, p.queue.length, p.repeat) < 0}
        onPress={p.next}
        style={s.control}
      >
        <PlayerIcon name="next" />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={"Repetir: " + p.repeat}
        onPress={p.setRepeat}
        style={s.control}
      >
        <PlayerIcon
          name="repeat"
          color={p.repeat !== "none" ? "#f149ed" : "#c0a7d2"}
        />
        {p.repeat === "one" && <Text style={s.repeatOne}>1</Text>}
      </Pressable>
    </View>
  );
}
export function NativeQueue({
  visible,
  close,
}: {
  visible: boolean;
  close: () => void;
}) {
  const p = useNativePlayback();
  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={close}
      animationType="fade"
    >
      <View style={s.modal}>
        <View style={s.queue}>
          <View style={s.queueHeader}>
            <Text style={s.queueTitle}>Cola de reproducción</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar cola"
              onPress={close}
              style={s.control}
            >
              <PlayerIcon name="close" />
            </Pressable>
          </View>
          <ScrollView>
            {p.queue.map((song, i) => (
              <Pressable
                key={song.id}
                accessibilityRole="button"
                accessibilityLabel={"Reproducir " + song.titulo}
                onPress={() => {
                  p.play(song, p.queue);
                  close();
                }}
                style={[
                  s.queueRow,
                  i === p.index && { backgroundColor: "#77308b55" },
                ]}
              >
                <Text style={s.queueSong}>{song.titulo}</Text>
                <Text style={s.queueArtist}>{song.artista.nombre}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function MiniPlayerMobile() {
  const p = useNativePlayback(),
    path = usePathname(),
    insets = useSafeAreaInsets();
  if (!p.song || path === "/reproduciendo") return null;
  return (
    <View
      style={[
        s.mini,
        {
          bottom: insets.bottom + (/^\/(explorar|perfil|inicio|mi-musica)/.test(path) ? 74 : 12),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir Reproduciendo ahora"
        onPress={() => router.push("/reproduciendo")}
        style={s.miniSong}
      >
        <NativeSongArtwork key={p.song.id} song={p.song} />
        <View style={s.miniCopy}>
          <Text numberOfLines={1} style={s.miniTitle}>
            {p.song.titulo}
          </Text>
          <Text numberOfLines={1} style={s.miniArtist}>
            {p.song.artista.nombre}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.playing ? "Pausar" : "Reproducir"}
        onPress={p.toggle}
        disabled={p.loading}
        style={s.control}
      >
        <PlayerIcon name={p.playing ? "pause" : "play"} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Canción siguiente"
        disabled={nextIndex(p.index, p.queue.length, p.repeat) < 0}
        onPress={p.next}
        style={s.control}
      >
        <PlayerIcon name="next" size={21} />
      </Pressable>
      <View
        style={[
          s.miniProgress,
          {
            width: Math.min(100, (p.position / (p.duration || 1)) * 100) + "%",
          },
        ]}
      />
      {Boolean(p.error) && (
        <Text style={s.miniError} accessibilityLiveRegion="polite">
          {p.error}
        </Text>
      )}
    </View>
  );
}
export function FullPlayerMobile() {
  const p = useNativePlayback(),
    [queue, setQueue] = useState(false),
    [barWidth, setBarWidth] = useState(1),
    [isFav, setIsFav] = useState(false),
    [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    if (!p.song?.id || !p.token) return;
    let cancelled = false;
    void checkFavorites(base, [p.song.id], p.token)
      .then((m: Record<string, boolean>) => {
        if (!cancelled && p.song) setIsFav(Boolean(m[p.song.id]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [p.song?.id, p.token]);

  const handleToggleFav = async () => {
    if (!p.song?.id || !p.token || loadingFav) return;
    setLoadingFav(true);
    try {
      const res = await toggleFavorite(base, p.song.id, isFav, p.song.source, p.token);
      setIsFav(res.favorited);
    } catch {
      // ignore
    } finally {
      setLoadingFav(false);
    }
  };

  return (
    <SafeAreaView style={s.full}>
      <View style={s.fullHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Minimizar reproductor"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/explorar")
          }
          style={s.headerBack}
        >
          <CatalogIcon name="back" size={18} />
        </Pressable>
        <Text style={s.nowTitle}>Reproduciendo ahora</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
          disabled={loadingFav}
          onPress={handleToggleFav}
          style={s.headerBack}
        >
          <PlayerIcon name="heart" size={21} color={isFav ? "#ff2d6a" : "#eadcf7"} />
        </Pressable>
      </View>
      {p.song ? (
        <ScrollView contentContainerStyle={s.fullContent}>
          <NativeSongArtwork key={p.song.id} song={p.song} large />
          <Text style={s.title}>{p.song.titulo}</Text>
          <Text style={s.artist}>{p.song.artista.nombre}</Text>
          {p.song.genero && <Text style={s.genre}>{p.song.genero.nombre}</Text>}
          <NativeWaveform />
          <View style={s.times}>
            <Text style={s.time}>{playbackTime(p.position)}</Text>
            <Text style={s.time}>{playbackTime(p.duration)}</Text>
          </View>
          <NativeControls />
          <View style={s.extras}>
            <PlayerIcon name="volume" size={20} />
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Volumen"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(p.volume * 100),
              }}
              accessibilityActions={[
                { name: "increment" },
                { name: "decrement" },
              ]}
              onAccessibilityAction={(e) =>
                p.setVolume(
                  p.volume +
                    (e.nativeEvent.actionName === "increment" ? 0.1 : -0.1),
                )
              }
              style={s.volume}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => true}
              onResponderGrant={(e) =>
                p.setVolume(e.nativeEvent.locationX / barWidth)
              }
              onResponderMove={(e) =>
                p.setVolume(e.nativeEvent.locationX / barWidth)
              }
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 20,
                  height: 4,
                  borderRadius: 3,
                  backgroundColor: "#4d3b72",
                }}
              />
              <View pointerEvents="none" style={[s.volumeFill, { width: p.volume * 100 + "%" }]} />
              <View pointerEvents="none" style={[s.volumeThumb, { left: p.volume * 100 + "%" }]} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir cola"
              onPress={() => setQueue(true)}
              style={s.control}
            >
              <PlayerIcon name="queue" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar reproductor"
              onPress={() => {
                p.stop();
                router.replace("/explorar");
              }}
              style={s.control}
            >
              <PlayerIcon name="close" size={19} />
            </Pressable>
          </View>
          {Boolean(p.error) && (
            <Text accessibilityLiveRegion="polite" style={s.error}>
              {p.error}
            </Text>
          )}
          <NativeQueue visible={queue} close={() => setQueue(false)} />
        </ScrollView>
      ) : (
        <View style={s.empty}>
          <Text style={s.artist}>No hay una canción activa.</Text>
          <Pressable onPress={() => router.replace("/explorar")}>
            <Text style={s.error}>Volver a Explorar</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  full: { flex: 1, backgroundColor: "#080415" },
  fullHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  headerBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#8b33ac",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#29103c66",
  },
  nowTitle: { fontSize: 13, color: "#e3d4ee" },
  fullContent: {
    paddingHorizontal: 28,
    paddingTop: 25,
    paddingBottom: 30,
    alignItems: "center",
  },
  artRing: {
    width: 43,
    height: 43,
    padding: 1.5,
    borderRadius: 25,
    overflow: "hidden",
  },
  artInside: {
    flex: 1,
    width: "100%",
    borderRadius: 200,
    overflow: "hidden",
    backgroundColor: "#261434",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 25,
    fontWeight: "700",
    color: "#f6ecff",
    textAlign: "center",
    marginTop: 24,
  },
  artist: { fontSize: 15, color: "#c7b0da", textAlign: "center", marginTop: 7 },
  genre: {
    fontSize: 10,
    color: "#d2b7e6",
    backgroundColor: "#54317777",
    borderWidth: 1,
    borderColor: "#8d5cab66",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 4,
    marginTop: 11,
    marginBottom: 19,
  },
  waveWrap: {
    width: "100%",
    height: 64,
    justifyContent: "center",
    position: "relative",
    marginTop: 8,
  },
  waveBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    width: "100%",
    height: 50,
  },
  wavePosition: {
    position: "absolute",
    height: 43,
    width: 1,
    backgroundColor: "#f78ee9",
    opacity: 0.5,
  },
  times: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 1,
  },
  time: { fontSize: 11, color: "#c7addc", fontVariant: ["tabular-nums"] },
  controls: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  control: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  mainPlay: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ec7ce9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#f025eb",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 7,
  },
  repeatOne: { position: "absolute", fontSize: 9, color: "#f5dafa", bottom: 3 },
  extras: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 25,
  },
  volume: { flex: 1, height: 44, justifyContent: "center" },
  volumeFill: {
    height: 4,
    borderRadius: 3,
    backgroundColor: "#e735e2",
    zIndex: 1,
  },
  volumeThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 16,
    marginLeft: -6,
    backgroundColor: "#f2e7fa",
    zIndex: 2,
  },
  error: {
    color: "#f0a3db",
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 16,
  },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  mini: {
    position: "absolute",
    left: 12,
    right: 12,
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#bb43d9",
    borderRadius: 20,
    backgroundColor: "#24102ff5",
    overflow: "visible",
    zIndex: 20,
    shadowColor: "#b426dd",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 9,
  },
  miniSong: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  miniCopy: { flex: 1, minWidth: 0, gap: 4 },
  miniTitle: { fontSize: 13, fontWeight: "600", color: "#f2e4fa" },
  miniArtist: { fontSize: 10, color: "#ba9bcc" },
  miniProgress: {
    position: "absolute",
    left: 12,
    bottom: 1,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#e846df",
    maxWidth: "94%",
  },
  miniError: {
    position: "absolute",
    bottom: 70,
    left: 0,
    right: 0,
    color: "#fab2df",
    fontSize: 11,
    padding: 8,
    backgroundColor: "#36162eef",
    borderRadius: 8,
  },
  modal: { flex: 1, justifyContent: "flex-end", backgroundColor: "#05020ac7" },
  queue: {
    backgroundColor: "#1b0b2d",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "#8442a2",
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueTitle: { color: "#f2e4fb", fontSize: 20, fontWeight: "600" },
  queueRow: { padding: 13, borderRadius: 12, gap: 5 },
  queueSong: { color: "#f4eafa", fontSize: 14 },
  queueArtist: { color: "#b496c9", fontSize: 12 },
});
