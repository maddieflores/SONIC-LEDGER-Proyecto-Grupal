import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { NeonButton } from "../components/Neon";
import { getToken, clearToken } from "../services/session";
import {
  ArtistApiError,
  artistMediaUrl,
  artistRequest,
} from "../../../shared/artist-api";
import {
  artistIdentities,
  artistUpdate,
  emptyArtist,
  skyline,
  socialFields,
  type ArtistResponse,
  type ArtistUpdate,
} from "../../../shared/artist";
import { toggle, type Genre } from "../../../shared/profile";
const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
export default function ArtistScreen() {
  const [response, setResponse] = useState<ArtistResponse | null>(null),
    [draft, setDraft] = useState<ArtistUpdate>(emptyArtist),
    [genres, setGenres] = useState<Genre[]>([]),
    [message, setMessage] = useState(""),
    [denied, setDenied] = useState(false),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState(""),
    [identityOpen, setIdentityOpen] = useState(false);
  const load = useCallback(async () => {
    try {
      const t = await getToken();
      if (!t) {
        router.replace("/iniciar-sesion");
        return;
      }
      setToken(t);
      const r = await artistRequest<ArtistResponse>(
        base,
        "artist-profile",
        "GET",
        undefined,
        t,
      );
      setResponse(r);
      setDraft(r.profile ? artistUpdate(r.profile) : emptyArtist());
      setGenres(
        await artistRequest<Genre[]>(
          base,
          "profile/genres",
          "GET",
          undefined,
          t,
        ),
      );
    } catch (e) {
      if (e instanceof ArtistApiError && e.status === 401) {
        await clearToken();
        router.replace("/iniciar-sesion");
      } else if (e instanceof ArtistApiError && e.status === 403)
        setDenied(true);
      else setMessage((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  function edit<K extends keyof ArtistUpdate>(key: K, value: ArtistUpdate[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function save() {
    if (draft.nombreArtistico.trim().length < 2) {
      setMessage("Introduce un nombre artístico de al menos 2 caracteres.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const r = await artistRequest<ArtistResponse>(
        base,
        "artist-profile",
        response?.profile ? "PATCH" : "POST",
        artistUpdate(draft),
        await getToken(),
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
  async function upload(kind: "avatar" | "cover") {
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (image.fileSize && image.fileSize > 2097152) {
        setMessage("Selecciona un PNG o JPEG de hasta 2 MB.");
        return;
      }
      const mime = image.mimeType || "";
      if (!["image/png", "image/jpeg"].includes(mime)) {
        setMessage("Selecciona una imagen PNG o JPEG.");
        return;
      }
      setBusy(true);
      setMessage("");
      const data = new FormData();
      if (Platform.OS === "web" && image.file) data.append("file", image.file);
      else
        data.append("file", {
          uri: image.uri,
          name:
            image.fileName || "image." + (mime === "image/png" ? "png" : "jpg"),
          type: mime,
        } as unknown as Blob);
      const stored = await artistRequest<{ reference: string }>(
        base,
        "artist-profile/media/" + kind,
        "POST",
        data,
        await getToken(),
      );
      setResponse((r) =>
        r?.profile
          ? {
              ...r,
              profile: {
                ...r.profile,
                [kind === "avatar" ? "avatarUrl" : "coverUrl"]:
                  stored.reference,
              },
            }
          : r,
      );
      setMessage("Imagen almacenada.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const unavailable = () =>
    setMessage("Esta sección todavía no está disponible.");
  const avatar = artistMediaUrl(base, response?.profile?.avatarUrl ?? null),
    cover = artistMediaUrl(base, response?.profile?.coverUrl ?? null);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver al inicio"
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.back}>‹</Text>
          </Pressable>
          <View>
            <Text style={s.title}>Perfil artístico</Text>
            <Text style={s.subtitle}>Gestiona tu identidad musical</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Más información"
            onPress={() =>
              setMessage(
                "Solo tú puedes gestionar tu perfil. Las imágenes se guardan localmente en desarrollo.",
              )
            }
          >
            <Text style={s.menu}>···</Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <Text style={s.status} accessibilityLiveRegion="polite">
            {message}
          </Text>
          {denied ? (
            <View style={s.access}>
              <Text style={s.sectionTitle}>
                Tu cuenta aún no está habilitada como artista
              </Text>
              <Text style={s.muted}>
                Se requiere el rol ARTISTA. La habilitación debe ser autorizada;
                no se concede desde este formulario.
              </Text>
              <NeonButton onPress={() => router.replace("/inicio")}>
                Volver al inicio
              </NeonButton>
            </View>
          ) : !response ? (
            <View>
              <ActivityIndicator color="#e342e7" />
              {Boolean(message) && (
                <NeonButton onPress={() => void load()}>Reintentar</NeonButton>
              )}
            </View>
          ) : (
            <>
              {!response.profile && (
                <Text style={s.notice}>
                  Aún no tienes perfil artístico. Completa tus datos para
                  crearlo.
                </Text>
              )}
              <View style={s.avatarArea}>
                <Text style={s.wave} accessibilityElementsHidden>
                  ∿∿∿∿∿∿∿∿∿∿∿∿
                </Text>
                <LinearGradient
                  colors={["#126fd9", "#5a1a8c", "#db19b9"]}
                  style={s.avatar}
                >
                  {avatar ? (
                    <ArtistImage
                      key={avatar}
                      uri={avatar}
                      token={token}
                      avatar
                      onError={() => setMessage("No se pudo cargar el avatar.")}
                    />
                  ) : (
                    <Text style={s.avatarLetter}>
                      {draft.nombreArtistico.trim().slice(0, 1).toUpperCase() ||
                        "♫"}
                    </Text>
                  )}
                </LinearGradient>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar avatar"
                  disabled={busy}
                  onPress={() => void upload("avatar")}
                  style={s.camera}
                >
                  <Text style={s.cameraIcon}>▣</Text>
                </Pressable>
              </View>
              <Field
                icon="♙"
                label="Nombre artístico"
                value={draft.nombreArtistico}
                maxLength={100}
                editable={!busy}
                onChange={(v) => edit("nombreArtistico", v)}
              />
              <Field
                icon="@"
                label="Usuario"
                value={response.username}
                editable={false}
              />
              <Field
                icon="✎"
                label="Biografía"
                value={draft.biografia}
                editable={!busy}
                maxLength={500}
                multiline
                onChange={(v) => edit("biografia", v)}
              />
              <Text style={s.groupTitle}>♫ Géneros</Text>
              <View style={s.chips}>
                {genres.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.nombre}
                    selected={draft.genreIds.includes(g.id)}
                    disabled={busy}
                    onPress={() =>
                      edit("genreIds", toggle(draft.genreIds, g.id))
                    }
                  />
                ))}
              </View>
              {!genres.length && (
                <Text style={s.muted}>No hay géneros activos disponibles.</Text>
              )}
              <View style={s.location}>
                <View style={s.flex}>
                  <Field
                    icon="♧"
                    label="Ciudad"
                    value={draft.ciudad}
                    editable={!busy}
                    maxLength={80}
                    onChange={(v) => edit("ciudad", v)}
                  />
                </View>
                <View style={s.flex}>
                  <Field
                    label="País"
                    value={draft.pais}
                    editable={!busy}
                    maxLength={80}
                    onChange={(v) => edit("pais", v)}
                  />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: identityOpen }}
                onPress={() => setIdentityOpen(!identityOpen)}
              >
                <Text style={s.groupTitle}>
                  ☆ Identidad artística {identityOpen ? "−" : "+"}
                </Text>
              </Pressable>
              {identityOpen && (
                <View style={s.chips}>
                  {artistIdentities.map((t) => (
                    <Chip
                      key={t}
                      label={t}
                      selected={draft.identidad.includes(t)}
                      disabled={busy}
                      onPress={() =>
                        edit("identidad", toggle(draft.identidad, t))
                      }
                    />
                  ))}
                </View>
              )}
              <Text style={s.groupTitle}>♧ Redes</Text>
              {socialFields.map(([key, label, placeholder]) => (
                <View key={key} style={s.socialRow}>
                  <View style={s.flex}>
                    <Field
                      label={label}
                      value={draft.redes[key] || ""}
                      maxLength={500}
                      editable={!busy}
                      url
                      placeholder={placeholder}
                      onChange={(v) =>
                        edit("redes", { ...draft.redes, [key]: v })
                      }
                    />
                  </View>
                  {Boolean(draft.redes[key]) && (
                    <Pressable
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={"Eliminar " + label}
                      onPress={() =>
                        edit("redes", { ...draft.redes, [key]: "" })
                      }
                      style={s.remove}
                    >
                      <Text style={s.removeText}>×</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Text style={s.groupTitle}>▧ Portada del artista</Text>
              <View style={s.cover}>
                {cover ? (
                  <ArtistImage
                    key={cover}
                    uri={cover}
                    token={token}
                    onError={() => setMessage("No se pudo cargar la portada.")}
                  />
                ) : (
                  <CityCover />
                )}
                <Pressable
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Editar portada"
                  onPress={() => void upload("cover")}
                  style={s.coverEdit}
                >
                  <Text style={s.cameraIcon}>✎</Text>
                </Pressable>
                {!cover && (
                  <Text style={s.defaultCover}>Portada predeterminada</Text>
                )}
              </View>
              <NeonButton disabled={busy} onPress={() => void save()}>
                {busy
                  ? "Guardando…"
                  : response.profile
                    ? "Guardar cambios  →"
                    : "Crear perfil  →"}
              </NeonButton>
              <Text style={s.statistics}>
                Seguidores, reproducciones y conciertos: estadísticas no
                disponibles.
              </Text>
            </>
          )}
        </ScrollView>
        <View style={s.bottom}>
          {[
            ["⌂", "Inicio"],
            ["≋", "Música"],
            ["♡", "Favoritos"],
            ["♙", "Perfil artístico"],
          ].map(([icon, label]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: label === "Perfil artístico" }}
              onPress={
                label === "Inicio"
                  ? () => router.replace("/inicio")
                  : label === "Perfil artístico"
                    ? () => {}
                    : unavailable
              }
              style={[s.nav, label === "Perfil artístico" && s.navSelected]}
            >
              <Text style={s.navIcon}>{icon}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function ArtistImage({
  uri,
  token,
  avatar = false,
  onError,
}: {
  uri: string;
  token: string;
  avatar?: boolean;
  onError: () => void;
}) {
  const [blobUri, setBlobUri] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let active = true,
      objectUrl: string | undefined;
    const controller = new AbortController();
    void fetch(uri, {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Imagen no disponible");
        return r.blob();
      })
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setBlobUri(objectUrl);
        }
      })
      .catch((e) => {
        if (active && e.name !== "AbortError") setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri, token]);
  const source =
    Platform.OS === "web"
      ? blobUri
        ? { uri: blobUri }
        : null
      : { uri, headers: { Authorization: "Bearer " + token } };
  if (failed) return <Text style={s.muted}>Imagen no disponible</Text>;
  return source ? (
    <Image
      source={source}
      style={avatar ? s.avatarImage : StyleSheet.absoluteFill}
      resizeMode="cover"
      accessibilityRole="image"
      accessibilityLabel={avatar ? "Avatar del artista" : "Portada del artista"}
      onError={onError}
    />
  ) : (
    <ActivityIndicator color="#e852ed" />
  );
}
function Field({
  label,
  value,
  icon,
  editable,
  multiline = false,
  maxLength,
  onChange,
  url = false,
  placeholder,
}: {
  label: string;
  value: string;
  icon?: string;
  editable: boolean;
  multiline?: boolean;
  maxLength?: number;
  onChange?: (v: string) => void;
  url?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={s.field}>
      {Boolean(icon) && <Text style={s.fieldIcon}>{icon}</Text>}
      <View style={s.flex}>
        <Text style={s.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          onChangeText={onChange}
          keyboardType={url ? "url" : "default"}
          autoCapitalize={url ? "none" : "sentences"}
          autoCorrect={!url}
          placeholder={placeholder}
          placeholderTextColor="#887493"
          style={[s.input, multiline && s.biography]}
        />
        {multiline && (
          <Text style={s.counter}>
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
    </View>
  );
}
function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.chip, selected && s.selected]}
    >
      {selected && (
        <LinearGradient
          colors={["#902cff", "#e52ac9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={s.chipText}>
        {selected ? "✓  " : ""}
        {label}
      </Text>
    </Pressable>
  );
}
function CityCover() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityLabel="Ciudad neón decorativa"
    >
      <LinearGradient
        colors={["#080b3a", "#382073", "#89134e"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.sun} />
      <View style={s.skyline}>
        {skyline.map((h, i) => (
          <View key={i} style={[s.building, { height: `${h}%` }]}>
            {[0, 1, 2, 3].map((n) => (
              <View style={s.window} key={n} />
            ))}
          </View>
        ))}
      </View>
      <View style={s.horizon} />
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#090414" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 21,
    paddingVertical: 12,
  },
  back: { color: "white", fontSize: 32 },
  title: {
    color: "#f8f4ff",
    fontWeight: "700",
    fontSize: 20,
    textAlign: "center",
  },
  subtitle: {
    color: "#c9b4df",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  menu: {
    color: "white",
    fontSize: 23,
    backgroundColor: "#2b123e",
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  content: { paddingHorizontal: 22, paddingBottom: 26, gap: 9 },
  status: { color: "#f4a2e6", fontSize: 12 },
  notice: {
    borderWidth: 1,
    borderColor: "#794790",
    borderRadius: 12,
    color: "#d4b7e3",
    fontSize: 12,
    padding: 12,
  },
  avatarArea: {
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
    overflow: "visible",
  },
  wave: {
    position: "absolute",
    left: -40,
    right: -40,
    color: "#a527d0",
    fontSize: 38,
    letterSpacing: -5,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#ed35df",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarLetter: { color: "#ecd9fa", fontSize: 55, fontWeight: "300" },
  camera: {
    position: "absolute",
    bottom: 0,
    left: "59%",
    width: 37,
    height: 37,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#f19aec",
    backgroundColor: "#8a24c0",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIcon: { fontSize: 22, color: "white" },
  field: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderWidth: 1,
    borderColor: "#6d4388",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: "#1b1029",
    minWidth: 0,
  },
  fieldIcon: { color: "#f18ce7", fontSize: 22, width: 23, paddingTop: 5 },
  label: { color: "#c9b4df", fontSize: 10 },
  input: { color: "#f8f4ff", fontSize: 13, minHeight: 28, paddingVertical: 3 },
  biography: { minHeight: 62, textAlignVertical: "top" },
  counter: { textAlign: "right", fontSize: 10, color: "#bca2ce" },
  groupTitle: {
    color: "#f8f4ff",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#76538a",
    paddingVertical: 9,
    paddingHorizontal: 16,
    minHeight: 38,
    backgroundColor: "#190c28",
  },
  selected: { borderColor: "#d55deb" },
  chipText: { color: "white", fontSize: 12 },
  location: { flexDirection: "row", gap: 8, marginTop: 5 },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  remove: {
    height: 44,
    width: 35,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#35113f",
  },
  removeText: { color: "#ef8edb", fontSize: 24 },
  cover: {
    height: 100,
    borderWidth: 1,
    borderColor: "#b234de",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 7,
  },
  coverEdit: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#842ac7",
    borderWidth: 1,
    borderColor: "#f39de7",
    alignItems: "center",
    justifyContent: "center",
  },
  defaultCover: {
    position: "absolute",
    bottom: 6,
    left: 9,
    color: "#d7b4eb",
    fontSize: 9,
  },
  sun: {
    position: "absolute",
    left: "40%",
    top: 5,
    width: 85,
    height: 85,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: "#ff46ed",
    backgroundColor: "#9c15973a",
  },
  skyline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  building: {
    flex: 1,
    backgroundColor: "#101038",
    borderWidth: 1,
    borderColor: "#385e9a",
    gap: 6,
    paddingTop: 4,
    overflow: "hidden",
  },
  window: {
    height: 2,
    width: 3,
    backgroundColor: "#e236d1",
    alignSelf: "center",
  },
  horizon: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#fc2fce",
  },
  statistics: {
    color: "#a58ab9",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 5,
  },
  bottom: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#7d388e",
    overflow: "hidden",
    backgroundColor: "#1c0b2b",
  },
  nav: { flex: 1, alignItems: "center", padding: 8 },
  navSelected: { backgroundColor: "#7c168e" },
  navIcon: { color: "white", fontSize: 25 },
  access: { gap: 20, paddingVertical: 35 },
  sectionTitle: { fontSize: 23, color: "white", fontWeight: "700" },
  muted: { color: "#c9b4df", fontSize: 13, lineHeight: 21 },
});
