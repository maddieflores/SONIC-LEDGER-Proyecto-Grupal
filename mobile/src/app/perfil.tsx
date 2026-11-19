import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { NeonButton } from "../components/Neon";
import { ApiError, request } from "../services/auth";
import { getToken, clearToken } from "../services/session";
import {
  adjustments,
  moods,
  profileUpdate,
  toggle,
  type Genre,
  type Profile,
} from "../../../shared/profile";
export default function ProfileScreen() {
  const [p, setP] = useState<Profile | null>(null),
    [genres, setGenres] = useState<Genre[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        router.replace("/iniciar-sesion");
        return;
      }
      const [profile, catalog] = await Promise.all([
        request<Profile>("profile", undefined, token),
        request<Genre[]>("profile/genres", undefined, token),
      ]);
      setP(profile);
      setGenres(catalog);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await clearToken();
        router.replace("/iniciar-sesion");
      } else setMessage((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function save() {
    if (!p) return;
    setBusy(true);
    setMessage("");
    try {
      setP(
        await request<Profile>("profile", profileUpdate(p), await getToken()),
      );
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
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.header}>
          <Pressable
            accessibilityLabel="Volver al inicio"
            onPress={() => router.replace("/inicio")}
          >
            <Text style={s.icon}>‹</Text>
          </Pressable>
          <View>
            <Text style={s.title}>Mi perfil</Text>
            <Text style={s.subtitle}>Editar perfil y preferencias</Text>
          </View>
          <Pressable
            accessibilityLabel="Cerrar sesión"
            onPress={() => {
              void clearToken()
                .then(() => router.replace("/iniciar-sesion"))
                .catch((e) => setMessage(e.message));
            }}
          >
            <Text style={s.menu}>Salir</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text accessibilityLiveRegion="polite" style={s.status}>
            {message}
          </Text>
          {!p ? (
            <View>
              <ActivityIndicator color="#e947ed" />
              {Boolean(message) && (
                <NeonButton onPress={() => void load()}>Reintentar</NeonButton>
              )}
            </View>
          ) : (
            <>
              <View style={s.avatarArea}>
                <View style={s.wave} accessibilityElementsHidden>
                  <Text style={s.waveText}>∿∿∿∿∿∿∿∿∿∿</Text>
                </View>
                <LinearGradient
                  colors={["#127cef", "#5c148d", "#e327b8"]}
                  style={s.avatar}
                >
                  <Text style={s.avatarText}>
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </LinearGradient>
                <Pressable
                  accessibilityLabel="Información sobre cambiar avatar"
                  style={s.camera}
                  onPress={() =>
                    setMessage(
                      "La carga de avatar requiere almacenamiento seguro; todavía no está disponible.",
                    )
                  }
                >
                  <Text style={s.cameraText}>▣</Text>
                </Pressable>
              </View>
              {(
                [
                  {
                    key: "displayName",
                    label: "Nombre para mostrar",
                    icon: "♙",
                  },
                  { key: "username", label: "Usuario", icon: "@" },
                  { key: "email", label: "Correo electrónico", icon: "✉" },
                  {
                    key: "biography",
                    label: "Biografía (máx. 300 caracteres)",
                    icon: "✎",
                  },
                ] as const
              ).map(({ key, label, icon }) => (
                <View style={s.field} key={key}>
                  <Text style={s.fieldIcon}>{icon}</Text>
                  <View style={s.flex}>
                    <Text style={s.label}>{label}</Text>
                    <TextInput
                      accessibilityLabel={label}
                      editable={
                        !busy && (key === "displayName" || key === "biography")
                      }
                      value={p[key]}
                      maxLength={key === "biography" ? 300 : 60}
                      multiline={key === "biography"}
                      style={[s.input, key === "biography" && s.bio]}
                      onChangeText={(value) => setP({ ...p, [key]: value })}
                    />
                    {key === "biography" && (
                      <Text style={s.counter}>{p.biography.length}/300</Text>
                    )}
                  </View>
                </View>
              ))}
              <Text style={s.sectionTitle}>Preferencias musicales</Text>
              <Text style={s.groupTitle}>♫ Géneros favoritos</Text>
              <View style={s.chips}>
                {genres.map((g) => (
                  <Chip
                    key={g.id}
                    label={g.nombre}
                    selected={p.genreIds.includes(g.id)}
                    disabled={busy}
                    onPress={() =>
                      setP({ ...p, genreIds: toggle(p.genreIds, g.id) })
                    }
                  />
                ))}
              </View>
              {!genres.length && (
                <Text style={s.muted}>
                  No hay géneros disponibles en el catálogo.
                </Text>
              )}
              <Text style={s.groupTitle}>ϟ Momentos favoritos</Text>
              <View style={s.chips}>
                {moods.map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    selected={p.moods.includes(m)}
                    disabled={busy}
                    onPress={() => setP({ ...p, moods: toggle(p.moods, m) })}
                  />
                ))}
              </View>
              <Text style={s.groupTitle}>♧ Artistas favoritos</Text>
              <View style={s.emptyArtists}>
                <Text style={s.artistPlaceholder}>＋</Text>
                <Text style={s.muted}>
                  La selección de artistas favoritos estará disponible cuando se
                  habilite ese módulo.
                </Text>
              </View>
              <Text style={s.groupTitle}>☷ Ajustes de recomendaciones</Text>
              {adjustments.map(([key, label]) => (
                <View style={s.adjustment} key={key}>
                  <Text style={s.label}>{label}</Text>
                  <View style={s.adjustRow}>
                    <Pressable
                      disabled={busy || p[key] === 0}
                      accessibilityLabel={"Reducir " + label}
                      onPress={() =>
                        setP({ ...p, [key]: Math.max(0, p[key] - 5) })
                      }
                      style={s.step}
                    >
                      <Text style={s.stepText}>−</Text>
                    </Pressable>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${p[key]}%` }]} />
                    </View>
                    <Text style={s.percent}>{p[key]}%</Text>
                    <Pressable
                      disabled={busy || p[key] === 100}
                      accessibilityLabel={"Aumentar " + label}
                      onPress={() =>
                        setP({ ...p, [key]: Math.min(100, p[key] + 5) })
                      }
                      style={s.step}
                    >
                      <Text style={s.stepText}>＋</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <NeonButton disabled={busy} onPress={() => void save()}>
                {busy ? "Guardando…" : "Guardar cambios  →"}
              </NeonButton>
              <NeonButton onPress={() => router.push('/estadisticas-musicales' as any)}>
                Ver mis estadísticas musicales 📊
              </NeonButton>
            </>
          )}
        </ScrollView>
        <View style={s.bottom}>
          {[
            ["⌂", "Inicio"],
            ["≋", "Música"],
            ["♡", "Favoritos"],
            ["♙", "Mi perfil"],
          ].map(([icon, label]) => (
            <Pressable
              key={label}
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected: label === "Mi perfil" }}
              onPress={
                label === "Mi perfil"
                  ? () => {}
                  : label === "Inicio"
                    ? () => router.replace("/inicio")
                    : unavailable
              }
              style={[s.navItem, label === "Mi perfil" && s.navSelected]}
            >
              <Text style={s.navIcon}>{icon}</Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
      style={[s.chip, selected && s.chipSelected]}
    >
      {selected && (
        <LinearGradient
          colors={["#852afa", "#d725c4"]}
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
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0618" },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: { color: "#d4c6e2", fontSize: 12, marginTop: 3 },
  icon: { fontSize: 36, color: "white" },
  menu: {
    color: "#e4c9f6",
    backgroundColor: "#29103e",
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
  },
  content: { paddingHorizontal: 22, paddingBottom: 28, gap: 10 },
  status: { color: "#f6a5e6", fontSize: 13 },
  avatarArea: {
    height: 146,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: "#f33feb",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#f2d6ff", fontSize: 60, fontWeight: "300" },
  camera: {
    position: "absolute",
    bottom: 1,
    left: "59%",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#8426bb",
    borderWidth: 1,
    borderColor: "#ef85ed",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraText: { color: "white", fontSize: 27 },
  wave: { position: "absolute", left: -22, right: -22, overflow: "hidden" },
  waveText: { fontSize: 55, color: "#9d36dc", letterSpacing: -7 },
  field: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#78528d",
    borderRadius: 12,
    backgroundColor: "#1c122a",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fieldIcon: { fontSize: 24, color: "#ee9bea", width: 24 },
  label: { color: "#c9b4d7", fontSize: 11 },
  input: { color: "white", fontSize: 14, paddingVertical: 3, minHeight: 26 },
  bio: { minHeight: 64, textAlignVertical: "top" },
  counter: { color: "#b9a2c9", fontSize: 10, textAlign: "right" },
  sectionTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 21,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#542568",
    paddingBottom: 12,
  },
  groupTitle: { color: "#fff", fontWeight: "600", fontSize: 14, marginTop: 9 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#7e648e",
    overflow: "hidden",
    paddingVertical: 9,
    paddingHorizontal: 17,
    justifyContent: "center",
    backgroundColor: "#150c22",
  },
  chipSelected: { borderColor: "#e151df" },
  chipText: { color: "white", fontSize: 12 },
  emptyArtists: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 8,
  },
  artistPlaceholder: {
    borderWidth: 1,
    borderColor: "#76368d",
    borderRadius: 24,
    color: "#ce8ee5",
    width: 48,
    height: 48,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 25,
  },
  muted: { color: "#ad99bf", fontSize: 12, flex: 1, lineHeight: 18 },
  adjustment: { marginBottom: 8 },
  adjustRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 8,
  },
  step: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#311344",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: "white", fontSize: 18 },
  track: {
    height: 7,
    backgroundColor: "#4e3c60",
    borderRadius: 8,
    flex: 1,
    overflow: "hidden",
  },
  fill: { height: 7, backgroundColor: "#c234e5" },
  percent: { color: "white", fontSize: 12, width: 35 },
  bottom: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#693b82",
    overflow: "hidden",
    backgroundColor: "#1b0e2c",
  },
  navItem: { flex: 1, alignItems: "center", padding: 7 },
  navSelected: { backgroundColor: "#7e168d" },
  navIcon: { fontSize: 26, color: "white" },
});

