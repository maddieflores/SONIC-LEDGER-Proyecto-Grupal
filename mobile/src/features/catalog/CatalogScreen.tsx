import { CatalogIcon } from "../../components/CatalogIcon";
import { useNativePlayback, PlayerIcon } from "../playback/NativePlayback";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Brand, NeonButton } from "../../components/Neon";
import { getToken, clearToken } from "../../services/session";
import {
  CatalogError,
  catalogCoverUrl,
  catalogDuration,
  catalogRequest,
  type CatalogGenre,
  type CatalogPage,
  type CatalogSong,
  type CatalogDetail,
} from "../../../../shared/catalog";
import { fetchMusicRecommendations } from "../../../../shared/recommendations-api";
import type { MusicRecommendationsResponse } from "../../../../shared/recommendations";
const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
function useCatalogToken() {
  const [token, setToken] = useState("");
  useEffect(() => {
    let active = true;
    void getToken().then((value) => {
      if (!value) router.replace("/iniciar-sesion");
      else if (active) setToken(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return token;
}
async function sessionError(e: unknown, setError: (value: string) => void) {
  if (e instanceof CatalogError && e.status === 401) {
    await clearToken();
    router.replace("/iniciar-sesion");
  } else setError((e as Error).message);
}
export function BottomNav({
  current = "Explorar",
}: {
  current?: "Inicio" | "Explorar" | "Mi música" | "Lanzamientos" | "Perfil";
} = {}) {
  const tabs = [
    { label: "Inicio", icon: "home" as const, route: "/inicio" },
    { label: "Explorar", icon: "search" as const, route: "/explorar" },
    { label: "Mi música", icon: "music" as const, route: "/mi-musica" },
    { label: "Lanzamientos", icon: "layers" as const, route: "/lanzamientos" },
    { label: "Perfil", icon: "user" as const, route: "/perfil" },
  ];

  return (
    <View style={s.bottom}>
      {tabs.map((tab) => {
        const isSelected = tab.label === current;
        return (
          <Pressable
            key={tab.label}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{
              selected: isSelected,
            }}
            onPress={() => {
              if (tab.route === "/explorar" || tab.route === "/inicio") {
                router.replace(tab.route as any);
              } else {
                router.push(tab.route as any);
              }
            }}
            style={s.nav}
          >
            {isSelected && (
              <LinearGradient
                colors={["#9d29ed", "#b818c8"]}
                style={StyleSheet.absoluteFill}
              />
            )}
            <CatalogIcon
              name={tab.icon}
              color={isSelected ? "white" : "#d3bde6"}
            />
            <Text style={s.navLabel}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function CatalogHero() {
  return (
    <View style={s.hero}>
      <Image
        source={require("../../../assets/sonic-login-portrait.png")}
        style={s.heroImage}
        resizeMode="cover"
        accessible={false}
      />
      <LinearGradient
        colors={["#080516", "#08051600"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.heroCopy}>
        <Text style={s.heroTitle}>Explorar</Text>
        <Text style={s.heroText}>
          Descubre canciones publicadas en Sonic Ledger
        </Text>
      </View>
      <View style={s.waveViolet} />
      <View style={s.waveBlue} />
    </View>
  );
}
export function SearchBar({
  value,
  onChange,
  input,
}: {
  value: string;
  onChange: (value: string) => void;
  input: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
}) {
  return (
    <View style={[s.search, Boolean(value) && s.searchActive]}>
      <CatalogIcon name="search" size={22} />
      <TextInput
        ref={input}
        accessibilityLabel="Buscar canciones, artistas o géneros"
        placeholder="Buscar canciones, artistas o géneros…"
        placeholderTextColor="#b7a3cb"
        value={value}
        onChangeText={onChange}
        maxLength={100}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={s.searchInput}
      />
      {Boolean(value) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
          onPress={() => {
            onChange("");
            input.current?.focus();
          }}
          style={s.clear}
        >
          <CatalogIcon name="close" size={22} />
        </Pressable>
      )}
    </View>
  );
}
export function GenreChips({
  genres,
  value,
  onChange,
}: {
  genres: CatalogGenre[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.genres}
      keyboardShouldPersistTaps="handled"
    >
      {[{ id: "", nombre: "Todo" }, ...genres].map((g) => (
        <Pressable
          key={g.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value === g.id }}
          onPress={() => onChange(g.id)}
          style={[s.genre, value === g.id && s.genreSelected]}
        >
          {value === g.id && (
            <LinearGradient
              colors={["#9b25f8", "#d61bcb"]}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Text style={s.genreText}>{g.nombre}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function Cover({
  song,
  token,
  large = false,
}: {
  song: CatalogSong;
  token: string;
  large?: boolean;
}) {
  const url = catalogCoverUrl(base, song.coverUrl),
    [blob, setBlob] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (Platform.OS !== "web" || !url) return;
    let active = true,
      objectUrl: string | undefined;
    const controller = new AbortController();
    void fetch(url, {
      headers: url.startsWith(base + "/") ? { Authorization: "Bearer " + token } : undefined,
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((value) => {
        if (active) {
          objectUrl = URL.createObjectURL(value);
          setBlob(objectUrl);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token]);
  const source =
    url && !failed
      ? Platform.OS === "web"
        ? blob
          ? { uri: blob }
          : null
        : { uri: url, headers: url.startsWith(base + "/") ? { Authorization: "Bearer " + token } : undefined }
      : null;
  return (
    <View
      style={[
        s.cover,
        !large && width < 370 && s.coverSmall,
        large && s.coverLarge,
      ]}
    >
      {source ? (
        <Image
          source={source}
          accessibilityLabel={"Portada de " + song.titulo}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <CatalogIcon name="music" size={large ? 70 : 26} color="#b895cf" />
      )}
    </View>
  );
}
export function SongListItem({
  song,
  token,
  queue,
}: {
  song: CatalogSong;
  token: string;
  queue?: CatalogSong[];
}) {
  const playback = useNativePlayback();
  const active = playback.song?.id === song.id;
  return (
    <View style={[s.songRow, active && { backgroundColor: "#66317b44" }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          "Ver detalle de " + song.titulo + ", " + song.artista.nombre
        }
        onPress={() =>
          router.push({
            pathname: "/explorar/cancion/[id]",
            params: { id: song.id },
          })
        }
        style={s.songLink}
      >
        <Cover key={song.coverUrl ?? song.id} song={song} token={token} />
        <View style={s.songCopy}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={s.songTitle}>
            {song.titulo}
          </Text>
          <Text numberOfLines={1} style={s.artist}>
            {song.artista.nombre} · {song.source || "LOCAL"}
          </Text>
        </View>
      </Pressable>
      <Text style={s.duration}>{catalogDuration(song.duracionSegundos)}</Text>
      <Pressable
        disabled={song.playable === false}
        accessibilityRole="button"
        accessibilityState={{ disabled: song.playable === false }}
        onPress={() => {
          if (active && playback.playing) playback.toggle();
          else {
            playback.play(song, queue ?? [song]);
            router.push("/reproduciendo");
          }
        }}
        accessibilityLabel={
          (song.playable === false
            ? "Audio no disponible: "
            : active && playback.playing
              ? "Pausar "
              : "Reproducir ") + song.titulo
        }
        style={s.playTarget}
      >
        <View style={s.playCircle}>
          <PlayerIcon
            name={active && playback.playing ? "pause" : "play"}
            size={22}
          />
        </View>
      </Pressable>
    </View>
  );
}
export function CatalogStates({
  loading,
  error,
  filtered,
  retry,
  clear,
}: {
  loading?: boolean;
  error?: string;
  filtered?: boolean;
  retry: () => void;
  clear?: () => void;
}) {
  return (
    <View style={s.state} accessibilityLiveRegion="polite">
      {loading ? (
        <ActivityIndicator color="#ce5fe2" />
      ) : (
        <CatalogIcon name="music" size={32} />
      )}
      <Text style={s.stateTitle}>
        {error
          ? "No se pudo cargar el catálogo"
          : loading
            ? "Buscando tu próximo sonido…"
            : "No hay canciones para mostrar"}
      </Text>
      <Text style={s.stateText}>
        {error ||
          (loading
            ? "Cargando canciones publicadas."
            : filtered
              ? "No encontramos coincidencias con tu búsqueda."
              : "Las canciones publicadas aparecerán aquí cuando estén disponibles.")}
      </Text>
      {Boolean(error) && <NeonButton onPress={retry}>Reintentar</NeonButton>}
      {!loading && !error && clear && (
        <NeonButton secondary onPress={clear}>
          Limpiar filtros
        </NeonButton>
      )}
    </View>
  );
}

function RecommendedMobileSection({ token }: { token: string }) {
  const playback = useNativePlayback();
  const [data, setData] = useState<MusicRecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let active = true;
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
  }, [token]);

  if (loading || !data || data.items.length === 0) {
    return null;
  }

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
    <View style={s.recSection}>
      <View style={s.recHeader}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.recSparkle}>✨</Text>
            <Text style={s.recTitle}>Recomendado para ti</Text>
          </View>
          <Text style={s.recSubtitle}>
            {data.esPersonalizada
              ? 'Por afinidad con tus gustos, favoritos e historial'
              : 'Descubrimiento destacado en Sonic Ledger'}
          </Text>
        </View>
        <View
          style={[
            s.recBadge,
            data.esPersonalizada ? s.recBadgePersonalized : s.recBadgeDiscovery,
          ]}
        >
          <Text
            style={[
              s.recBadgeText,
              data.esPersonalizada ? s.recBadgeTextPersonalized : s.recBadgeTextDiscovery,
            ]}
          >
            {data.esPersonalizada ? '★ Personalizado' : '✦ Descubrimiento'}
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.recScrollContent}
      >
        {data.items.map((item, idx) => {
          const isCurrent = playback.song?.id === item.id;
          const isPlaying = isCurrent && playback.playing;
          const songObj = queue[idx];
          const coverUri = catalogCoverUrl(base, item.coverUrl);

          return (
            <View
              key={item.id}
              style={[s.recCard, isCurrent && s.recCardActive]}
            >
              <View style={s.recCoverBox}>
                {coverUri ? (
                  <Image source={{ uri: coverUri }} style={s.recCoverImg} />
                ) : (
                  <View style={s.recCoverFallback}>
                    <CatalogIcon name="music" size={28} color="#a855f7" />
                  </View>
                )}

                <View style={s.recSourceTag}>
                  <Text style={s.recSourceText}>{item.source}</Text>
                </View>

                {data.esPersonalizada ? (
                  <View style={s.recScoreTag}>
                    <Text style={s.recScoreText}>{item.score}% afinidad</Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isPlaying
                      ? `Pausar ${item.titulo}`
                      : `Reproducir ${item.titulo}`
                  }
                  style={[s.recPlayBtn, isPlaying && s.recPlayBtnActive]}
                  onPress={() => {
                    if (isCurrent) {
                      playback.toggle();
                    } else {
                      playback.play(songObj, queue);
                      router.push('/reproduciendo');
                    }
                  }}
                  disabled={item.playable === false}
                >
                  <PlayerIcon
                    name={isPlaying ? 'pause' : 'play'}
                    size={20}
                    color="#ffffff"
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={() =>
                  router.push(`/explorar/cancion/${item.id}` as any)
                }
              >
                <Text style={s.recSongTitle} numberOfLines={1}>
                  {item.titulo}
                </Text>
              </Pressable>

              <Text style={s.recArtistName} numberOfLines={1}>
                {item.artista.nombre}
              </Text>

              <View style={s.recReasonBox}>
                <Text style={s.recReasonText} numberOfLines={2}>
                  {item.motivosRecomendacion[0] || 'Recomendación Sonic Ledger'}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function CatalogScreen() {
  const playback = useNativePlayback();
  const token = useCatalogToken(),
    input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [q, setQ] = useState(""),
    [genre, setGenre] = useState(""),
    [page, setPage] = useState(1),
    [genres, setGenres] = useState<CatalogGenre[]>([]),
    [data, setData] = useState<CatalogPage | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void catalogRequest<CatalogGenre[]>(
      base,
      "/genres",
      token,
      controller.signal,
    )
      .then(setGenres)
      .catch((e) => {
        if (!controller.signal.aborted) void sessionError(e, setError);
      });
    return () => controller.abort();
  }, [token, retry]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setData(null);
        setError("");
      }
    });
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ page: String(page), pageSize: "12" });
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
          if (!controller.signal.aborted) void sessionError(e, setError);
        });
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, q, genre, page, retry]);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Brand />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver conciertos"
            onPress={() => router.push('/conciertos' as any)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: 'rgba(236, 72, 153, 0.2)',
              borderWidth: 1,
              borderColor: 'rgba(236, 72, 153, 0.4)',
            }}
          >
            <Text style={{ color: '#f472b6', fontSize: 12, fontWeight: '700' }}>
              Conciertos
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enfocar buscador"
            onPress={() => input.current?.focus()}
            style={s.headerSearch}
          >
            <CatalogIcon name="search" />
          </Pressable>
        </View>
      </View>
      <FlatList
        data={error ? [] : (data?.items ?? [])}
        keyExtractor={(song) => song.id}
        renderItem={({ item }) => (
          <SongListItem song={item} token={token} queue={data?.items} />
        )}
        contentContainerStyle={[
          s.listContent,
          playback.song && { paddingBottom: 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <>
            <CatalogHero />
            <RecommendedMobileSection token={token} />
            {data?.externalError ? <Text accessibilityRole="alert" style={s.artist}>{data.externalError}</Text> : null}
            <SearchBar
              input={input}
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(1);
              }}
            />
            <GenreChips
              genres={genres}
              value={genre}
              onChange={(value) => {
                setGenre(value);
                setPage(1);
              }}
            />
            <View style={s.listHeading}>
              <Text style={s.listTitle}>
                {q.trim() || genre ? "Resultados" : "Catálogo musical"}
              </Text>
              <Text style={s.count} accessibilityLiveRegion="polite">
                {data
                  ? data.total +
                    " " +
                    (data.total === 1 ? "canción" : "canciones")
                  : error
                    ? ""
                    : "Buscando…"}
              </Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <CatalogStates
            loading={!data && !error}
            error={error}
            filtered={Boolean(q || genre)}
            retry={() => setRetry((v) => v + 1)}
            clear={
              q || genre
                ? () => {
                    setQ("");
                    setGenre("");
                    setPage(1);
                  }
                : undefined
            }
          />
        }
        ListFooterComponent={
          <>
            <View style={s.pagination}>
              {data && data.totalPages > 1 && (
                <>
                  <Pressable
                    disabled={page <= 1}
                    accessibilityRole="button"
                    accessibilityLabel="Página anterior"
                    onPress={() => setPage((v) => v - 1)}
                    style={s.pageButton}
                  >
                    <CatalogIcon name="back" size={17} />
                  </Pressable>
                  <Text style={s.pageText}>
                    {page} / {data.totalPages}
                  </Text>
                  <Pressable
                    disabled={page >= data.totalPages}
                    accessibilityRole="button"
                    accessibilityLabel="Página siguiente"
                    onPress={() => setPage((v) => v + 1)}
                    style={[
                      s.pageButton,
                      { transform: [{ rotate: "180deg" }] },
                    ]}
                  >
                    <CatalogIcon name="back" size={17} />
                  </Pressable>
                </>
              )}
            </View>
            <Text style={s.coming}>
              Toca el botón circular para escuchar o el título para ver su
              detalle.
            </Text>
          </>
        }
      />
      <BottomNav />
    </SafeAreaView>
  );
}
export function SongDetailScreen() {
  const playback = useNativePlayback();
  const { id } = useLocalSearchParams<{ id: string }>(),
    token = useCatalogToken();
  const [data, setData] = useState<CatalogDetail | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setData(null);
        setError("");
      }
    });
    void catalogRequest<CatalogDetail>(
      base,
      "/" + encodeURIComponent(id),
      token,
      controller.signal,
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          void sessionError(
            e instanceof CatalogError && e.status === 404
              ? new Error("La canción ya no está disponible o no existe.")
              : e,
            setError,
          );
      });
    return () => controller.abort();
  }, [id, token, retry]);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.detailHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a Explorar"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/explorar")
          }
          style={s.headerSearch}
        >
          <CatalogIcon name="back" />
        </Pressable>
        <Text style={s.detailHeaderTitle}>Canción</Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          s.detailContent,
          playback.song && { paddingBottom: 105 },
        ]}
      >
        {!data ? (
          <CatalogStates
            loading={!error}
            error={error}
            retry={() => setRetry((v) => v + 1)}
          />
        ) : (
          <>
            <View style={s.detailTop}>
              <Cover
                key={data.song.coverUrl ?? data.song.id}
                song={data.song}
                token={token}
                large
              />
              <Text style={s.detailTitle}>{data.song.titulo}</Text>
              <Text style={s.detailArtist}>{data.song.artista.nombre}</Text>
              <View style={s.detailMeta}>
                {data.song.genero && (
                  <Text style={s.meta}>{data.song.genero.nombre}</Text>
                )}
                <Text style={s.meta}>
                  {catalogDuration(data.song.duracionSegundos)}
                </Text>
              </View>
              {Boolean(data.song.descripcion) && (
                <Text style={s.description}>{data.song.descripcion}</Text>
              )}
              <Pressable
                disabled={data.song.playable === false}
                onPress={() => {
                  playback.play(data.song, [data.song, ...data.moreByArtist]);
                  router.push("/reproduciendo");
                }}
                accessibilityRole="button"
                accessibilityState={{ disabled: data.song.playable === false }}
                accessibilityLabel="Reproducir canción"
                style={s.detailPlay}
              >
                <CatalogIcon name="play" size={20} />
                <Text style={s.detailPlayText}>Reproducir</Text>
              </Pressable>
            </View>
            {data.moreByArtist.length > 0 && (
              <>
                <Text style={s.relatedTitle}>
                  Más de {data.song.artista.nombre}
                </Text>
                {data.moreByArtist.map((song) => (
                  <SongListItem
                    key={song.id}
                    song={song}
                    token={token}
                    queue={[data.song, ...data.moreByArtist]}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080516" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  headerSearch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#674184",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25113666",
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  hero: {
    height: 180,
    position: "relative",
    overflow: "hidden",
    marginHorizontal: -20,
  },
  heroImage: {
    position: "absolute",
    right: -18,
    top: -15,
    width: 220,
    height: 260,
    opacity: 0.8,
  },
  heroCopy: { zIndex: 2, paddingLeft: 20, paddingTop: 12, maxWidth: "73%" },
  heroTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#f8f4ff",
    letterSpacing: -0.8,
    marginBottom: 9,
  },
  heroText: { fontSize: 13, color: "#d8c3e6", lineHeight: 20 },
  waveViolet: {
    position: "absolute",
    left: -20,
    right: 0,
    bottom: 18,
    height: 48,
    borderBottomWidth: 2,
    borderBottomColor: "#ba2ded",
    borderRadius: 120,
    transform: [{ rotate: "-5deg" }],
  },
  waveBlue: {
    position: "absolute",
    left: 120,
    right: -40,
    bottom: 19,
    height: 36,
    borderTopWidth: 2,
    borderTopColor: "#189cf0",
    borderRadius: 100,
    transform: [{ rotate: "6deg" }],
  },
  search: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#a34bc0",
    backgroundColor: "#281337aa",
    minHeight: 53,
    paddingLeft: 15,
    paddingRight: 5,
  },
  searchActive: { borderColor: "#589ae8" },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#f4e9fc",
    fontSize: 13,
    paddingVertical: 14,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  genres: { gap: 9, paddingVertical: 21 },
  genre: {
    minHeight: 39,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#783e92",
    borderRadius: 23,
    overflow: "hidden",
    backgroundColor: "#1c0b2b",
  },
  genreSelected: { borderColor: "#d452e4" },
  genreText: { color: "#f0e2fa", fontSize: 12 },
  listHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 5,
    marginBottom: 14,
  },
  listTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: "#f8f4ff",
    letterSpacing: -0.4,
  },
  count: { fontSize: 11, color: "#bba4cf" },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 83,
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 5,
    borderRadius: 12,
    backgroundColor: "#2a16402d",
  },
  songLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 11,
    overflow: "hidden",
    backgroundColor: "#35264a",
    alignItems: "center",
    justifyContent: "center",
  },
  coverSmall: { width: 52, height: 52 },
  coverLarge: {
    width: 260,
    height: 260,
    borderRadius: 22,
    alignSelf: "center",
    maxWidth: "100%",
    marginBottom: 22,
  },
  songCopy: { flex: 1, minWidth: 0, gap: 5 },
  songTitle: { color: "#f8f4ff", fontSize: 16, fontWeight: "600" },
  artist: { color: "#c9b4df", fontSize: 13 },
  duration: {
    color: "#c9b4df",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    width: 33,
    textAlign: "right",
  },
  playTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#b5a0ce66",
    backgroundColor: "#73509744",
    opacity: 0.65,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#653c8244",
    backgroundColor: "#11091f",
  },
  nav: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    borderRadius: 22,
    gap: 5,
    overflow: "hidden",
  },
  navLabel: { color: "#ddc8ec", fontSize: 10 },
  state: {
    paddingVertical: 32,
    paddingHorizontal: 18,
    gap: 14,
    borderRadius: 19,
    backgroundColor: "#28133533",
    alignItems: "center",
  },
  stateTitle: {
    fontSize: 18,
    color: "#eadcf4",
    fontWeight: "600",
    textAlign: "center",
  },
  stateText: {
    fontSize: 12,
    color: "#bfa6d2",
    lineHeight: 19,
    textAlign: "center",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    marginVertical: 18,
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#7f4e99",
    alignItems: "center",
    justifyContent: "center",
  },
  pageText: { fontSize: 12, color: "#c9b2db" },
  coming: {
    fontSize: 10,
    color: "#947da9",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 18,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailHeaderTitle: { color: "#f8f4ff", fontSize: 19, fontWeight: "600" },
  detailContent: { padding: 22, paddingBottom: 28 },
  detailTop: { alignItems: "center" },
  detailTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f8f4ff",
    textAlign: "center",
    marginBottom: 9,
  },
  detailArtist: { fontSize: 18, color: "#c9b4df", textAlign: "center" },
  detailMeta: { flexDirection: "row", gap: 12, marginVertical: 19 },
  meta: {
    color: "#bca2ce",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#70438a55",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  description: {
    color: "#ccb9db",
    fontSize: 14,
    lineHeight: 23,
    marginBottom: 18,
    textAlign: "center",
  },
  detailPlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#a85dbb",
    borderRadius: 25,
    minHeight: 48,
    paddingHorizontal: 22,
    backgroundColor: "#79319a66",
    opacity: 0.65,
  },
  detailPlayText: { color: "#e2c9ed", fontSize: 13 },
  relatedTitle: {
    fontSize: 21,
    fontWeight: "600",
    color: "#f0e1fb",
    marginTop: 35,
    marginBottom: 20,
  },
  recSection: {
    marginVertical: 18,
    backgroundColor: '#110a24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.28)',
    padding: 16,
    overflow: 'hidden',
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  recSparkle: {
    fontSize: 18,
  },
  recTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  recSubtitle: {
    color: '#cdbedb',
    fontSize: 12,
    marginTop: 2,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  recBadgePersonalized: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  recBadgeDiscovery: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  recBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  recBadgeTextPersonalized: {
    color: '#d8b4fe',
  },
  recBadgeTextDiscovery: {
    color: '#67e8f9',
  },
  recScrollContent: {
    gap: 14,
    paddingRight: 10,
  },
  recCard: {
    width: 175,
    backgroundColor: '#0c071a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    padding: 10,
  },
  recCardActive: {
    borderColor: '#00f0ff',
    backgroundColor: '#120d29',
  },
  recCoverBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1133',
    marginBottom: 8,
  },
  recCoverImg: {
    width: '100%',
    height: '100%',
  },
  recCoverFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191030',
  },
  recSourceTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(10, 6, 20, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
  },
  recSourceText: {
    color: '#67e8f9',
    fontSize: 9,
    fontWeight: '800',
  },
  recScoreTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(10, 6, 20, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.5)',
  },
  recScoreText: {
    color: '#f472b6',
    fontSize: 9,
    fontWeight: '700',
  },
  recPlayBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#9333ea',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  recPlayBtnActive: {
    backgroundColor: '#00f0ff',
  },
  recSongTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  recArtistName: {
    color: '#a797ba',
    fontSize: 11,
    marginBottom: 6,
  },
  recReasonBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 'auto',
  },
  recReasonText: {
    color: '#d8b4fe',
    fontSize: 10,
    lineHeight: 13,
  },
});
