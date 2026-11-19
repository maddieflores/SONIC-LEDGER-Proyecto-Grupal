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
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { CatalogIcon } from "../components/CatalogIcon";
import { getToken, clearToken } from "../services/session";
import { BottomNav } from "../features/catalog/CatalogScreen";

const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

type Genre = { id: string; nombre: string };

export default function MobilePublishSongScreen() {
  const [token, setToken] = useState("");
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Audio file
  const [audioAsset, setAudioAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Cover file
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Status
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const authToken = await getToken();
      if (!authToken) {
        router.replace("/iniciar-sesion");
        return;
      }
      setToken(authToken);

      const r = await fetch(`${base}/auth/artist-songs/options`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await r.json();
      if (r.status === 401) {
        await clearToken();
        router.replace("/iniciar-sesion");
        return;
      }
      if (r.status === 403) {
        setErrorMsg(
          "Solo usuarios con perfil artístico autorizado pueden publicar canciones (CU04).",
        );
        return;
      }
      if (r.ok && data.genres) {
        setGenres(data.genres);
        if (data.genres.length > 0) {
          setSelectedGenreId(data.genres[0].id);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const pickAudio = async () => {
    try {
      setErrorMsg("");
      const res = await DocumentPicker.getDocumentAsync({
        type: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
        copyToCacheDirectory: true,
      });

      if (res.canceled) return;
      const file = res.assets[0];

      if (!file.name.toLowerCase().endsWith(".wav")) {
        setErrorMsg(
          "Formato no compatible. Selecciona un archivo de audio WAV PCM sin compresión.",
        );
        return;
      }

      if (file.size && file.size > 50 * 1024 * 1024) {
        setErrorMsg("El audio no puede superar los 50 MB.");
        return;
      }

      setAudioAsset(file);
    } catch {
      setErrorMsg("No se pudo abrir el selector de archivos del dispositivo.");
    }
  };

  const pickCover = async () => {
    try {
      setErrorMsg("");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (res.canceled) return;
      const file = res.assets[0];

      if (file.fileSize && file.fileSize > 2 * 1024 * 1024) {
        setErrorMsg("La portada no puede superar los 2 MB.");
        return;
      }

      const mime = file.mimeType || "";
      if (mime && !["image/png", "image/jpeg"].includes(mime)) {
        setErrorMsg("Formato no compatible. Selecciona una imagen PNG o JPG.");
        return;
      }

      setCoverAsset(file);
    } catch {
      setErrorMsg("No se pudo acceder a la galería del dispositivo.");
    }
  };

  const handleSubmit = async (publishImmediate: boolean) => {
    if (titulo.trim().length < 2) {
      setErrorMsg("El título de la canción debe tener al menos 2 caracteres.");
      return;
    }
    if (!selectedGenreId) {
      setErrorMsg("Selecciona un género para la canción.");
      return;
    }
    if (publishImmediate && !audioAsset) {
      setErrorMsg("Para publicar la canción es obligatorio seleccionar un archivo de audio WAV.");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Crear borrador de la canción
      setUploadProgressText("Registrando metadatos de la canción...");
      const createRes = await fetch(`${base}/auth/artist-songs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          generoId: selectedGenreId,
        }),
      });

      const songData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(
          Array.isArray(songData.message)
            ? songData.message.join(". ")
            : songData.message || "Error al crear la canción.",
        );
      }

      const songId = songData.id;

      // 2. Subir audio si existe
      if (audioAsset) {
        setUploadProgressText("Subiendo archivo de audio WAV (PCM)...");
        const audioForm = new FormData();
        const filename = audioAsset.name || "song.wav";

        if (Platform.OS === "web" && (audioAsset as any).file) {
          audioForm.append("file", (audioAsset as any).file);
        } else {
          audioForm.append("file", {
            uri: audioAsset.uri,
            name: filename,
            type: "audio/wav",
          } as unknown as Blob);
        }

        const audioRes = await fetch(`${base}/auth/artist-songs/${songId}/audio`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: audioForm,
        });

        const audioResData = await audioRes.json();
        if (!audioRes.ok) {
          throw new Error(
            Array.isArray(audioResData.message)
              ? audioResData.message.join(". ")
              : audioResData.message || "Error al subir el audio.",
          );
        }
      }

      // 3. Subir portada si existe
      if (coverAsset) {
        setUploadProgressText("Subiendo imagen de portada...");
        const coverForm = new FormData();
        const mime = coverAsset.mimeType || "image/jpeg";
        const coverName =
          coverAsset.fileName || `cover.${mime === "image/png" ? "png" : "jpg"}`;

        if (Platform.OS === "web" && (coverAsset as any).file) {
          coverForm.append("file", (coverAsset as any).file);
        } else {
          coverForm.append("file", {
            uri: coverAsset.uri,
            name: coverName,
            type: mime,
          } as unknown as Blob);
        }

        const coverRes = await fetch(`${base}/auth/artist-songs/${songId}/cover`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: coverForm,
        });

        const coverResData = await coverRes.json();
        if (!coverRes.ok) {
          throw new Error(
            Array.isArray(coverResData.message)
              ? coverResData.message.join(". ")
              : coverResData.message || "Error al subir la portada.",
          );
        }
      }

      // 4. Cambiar estado a publicado si fue solicitado
      if (publishImmediate) {
        setUploadProgressText("Publicando canción...");
        const stateRes = await fetch(`${base}/auth/artist-songs/${songId}/state`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ estado: "publicado" }),
        });

        const stateData = await stateRes.json();
        if (!stateRes.ok) {
          throw new Error(
            Array.isArray(stateData.message)
              ? stateData.message.join(". ")
              : stateData.message || "Error al publicar la canción.",
          );
        }
      }

      setSuccessMsg(
        publishImmediate
          ? "¡Canción publicada con éxito! Ya puedes seleccionarla en tus lanzamientos (CU06)."
          : "Canción guardada como borrador.",
      );

      // Redirigir a lanzamientos después de un breve instante
      setTimeout(() => {
        router.replace("/lanzamientos");
      }, 1500);
    } catch (e: any) {
      setErrorMsg(e.message || "Error al procesar la publicación.");
    } finally {
      setUploading(false);
      setUploadProgressText("");
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.container}>
      <LinearGradient
        colors={["#16072b", "#090314", "#06020e"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <CatalogIcon name="back" size={18} color="#ffffff" />
          </Pressable>

          <View style={{ alignItems: "center" }}>
            <Text style={s.headerTitle}>Publicar canción</Text>
            <Text style={s.headerSubtitle}>Gestión de catálogo musical (CU05)</Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {errorMsg ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {successMsg ? (
          <View style={s.successBox}>
            <Text style={s.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#e024ff" size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Título de la canción */}
            <View style={s.formGroup}>
              <Text style={s.label}>Título de la canción *</Text>
              <TextInput
                style={s.textInput}
                placeholder="Ej: Luz Intermitente"
                placeholderTextColor="#796791"
                maxLength={100}
                value={titulo}
                onChangeText={setTitulo}
              />
              <Text style={s.charCount}>{titulo.length}/100</Text>
            </View>

            {/* Selector de Género */}
            <View style={s.formGroup}>
              <Text style={s.label}>Género musical *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {genres.map((g) => {
                  const isSelected = selectedGenreId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      style={[s.genrePill, isSelected && s.genrePillSelected]}
                      onPress={() => setSelectedGenreId(g.id)}
                    >
                      <Text
                        style={[
                          s.genrePillText,
                          isSelected && s.genrePillTextSelected,
                        ]}
                      >
                        {g.nombre}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Descripción */}
            <View style={s.formGroup}>
              <Text style={s.label}>Descripción (opcional)</Text>
              <TextInput
                style={[s.textInput, { height: 70, textAlignVertical: "top" }]}
                placeholder="Créditos, letra o notas sobre la canción..."
                placeholderTextColor="#796791"
                multiline
                maxLength={2000}
                value={descripcion}
                onChangeText={setDescripcion}
              />
            </View>

            {/* Selector de Archivo de Audio WAV */}
            <View style={s.formGroup}>
              <Text style={s.label}>Archivo de audio (WAV PCM) *</Text>
              <Pressable style={s.filePickerBox} onPress={pickAudio}>
                <CatalogIcon name="music" size={28} color="#00f0ff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.filePickerTitle} numberOfLines={1}>
                    {audioAsset ? audioAsset.name : "Seleccionar archivo WAV"}
                  </Text>
                  <Text style={s.filePickerSub}>
                    {audioAsset
                      ? `${((audioAsset.size || 0) / 1024 / 1024).toFixed(2)} MB`
                      : "Formato WAV PCM sin compresión (hasta 50 MB)"}
                  </Text>
                </View>
                <CatalogIcon name="edit" size={16} color="#baa4d4" />
              </Pressable>
            </View>

            {/* Selector de Portada */}
            <View style={s.formGroup}>
              <Text style={s.label}>Portada de la canción (PNG / JPG)</Text>
              <Pressable style={s.coverPickerRow} onPress={pickCover}>
                <View style={s.coverMiniBox}>
                  {coverAsset ? (
                    <Image source={{ uri: coverAsset.uri }} style={s.coverMini} />
                  ) : (
                    <CatalogIcon name="layers" size={24} color="#795b9c" />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.filePickerTitle}>
                    {coverAsset ? "Portada seleccionada" : "Elegir portada de galería"}
                  </Text>
                  <Text style={s.filePickerSub}>
                    {coverAsset
                      ? "Toca para cambiar imagen"
                      : "JPG o PNG cuadrada, hasta 2 MB"}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Upload Progress Indicator */}
            {uploading ? (
              <View style={s.progressBox}>
                <ActivityIndicator color="#e024ff" size="small" />
                <Text style={s.progressText}>{uploadProgressText}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={{ gap: 12, marginTop: 14 }}>
              <Pressable
                style={s.publishBtn}
                disabled={uploading}
                onPress={() => handleSubmit(true)}
              >
                <LinearGradient
                  colors={["#d414a8", "#9d29ed"]}
                  style={s.publishBtnGrad}
                >
                  <Text style={s.publishBtnText}>
                    {uploading ? "Procesando..." : "Publicar canción"}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                style={s.draftBtn}
                disabled={uploading}
                onPress={() => handleSubmit(false)}
              >
                <Text style={s.draftBtnText}>Guardar como borrador</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <BottomNav current="Mi música" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080313",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#baa4d4",
    fontSize: 11.5,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  textInput: {
    backgroundColor: "rgba(20, 10, 38, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.35)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
  },
  charCount: {
    color: "#8c7b9e",
    fontSize: 11,
    textAlign: "right",
  },
  genrePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.3)",
  },
  genrePillSelected: {
    backgroundColor: "rgba(224, 36, 255, 0.2)",
    borderColor: "#e024ff",
  },
  genrePillText: {
    color: "#baa4d4",
    fontSize: 13,
  },
  genrePillTextSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },
  filePickerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(20, 10, 38, 0.85)",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(0, 240, 255, 0.4)",
    borderRadius: 16,
    padding: 14,
  },
  filePickerTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  filePickerSub: {
    color: "#baa4d4",
    fontSize: 11.5,
    marginTop: 2,
  },
  coverPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(20, 10, 38, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.35)",
    borderRadius: 16,
    padding: 12,
  },
  coverMiniBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#130724",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coverMini: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  publishBtn: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#d414a8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  publishBtnGrad: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  draftBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  draftBtnText: {
    color: "#baa4d4",
    fontSize: 14,
    fontWeight: "600",
  },
  progressBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 10,
  },
  progressText: {
    color: "#00f0ff",
    fontSize: 12.5,
  },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,23,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,23,68,0.4)",
  },
  errorText: {
    color: "#ff5252",
    fontSize: 12.5,
  },
  successBox: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,230,118,0.15)",
    borderWidth: 1,
    borderColor: "rgba(0,230,118,0.4)",
  },
  successText: {
    color: "#00e676",
    fontSize: 12.5,
  },
});
