import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { router, useLocalSearchParams } from "expo-router";
import { CatalogIcon } from "../../components/CatalogIcon";
import { getToken, clearToken } from "../../services/session";
import { useNativePlayback } from "../../features/playback/NativePlayback";
import {
  createReleaseDraft,
  fetchAvailableSongs,
  fetchReleaseDetail,
  publishRelease,
  releaseCoverUrl,
  setReleaseTracks,
  updateReleaseDraft,
  uploadReleaseCover,
} from "../../../../shared/releases-api";
import {
  formatDuration,
  releaseTypeLabel,
  validateReleaseTrackCount,
  type AvailableSong,
  type ReleaseTipo,
} from "../../../../shared/releases";

const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export default function MobileCreateReleaseScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const releaseId = params.id;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState("");
  const [tipo, setTipo] = useState<ReleaseTipo>("SINGLE");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Cover image
  const [coverAsset, setCoverAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  // Songs
  const [availableSongs, setAvailableSongs] = useState<AvailableSong[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

  // States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const playback = useNativePlayback();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const authToken = await getToken();
      if (!authToken) {
        router.replace("/iniciar-sesion");
        return;
      }
      setToken(authToken);

      const songs = await fetchAvailableSongs(base, authToken);
      setAvailableSongs(songs);

      if (releaseId) {
        const rel = await fetchReleaseDetail(base, releaseId, authToken);
        setTitulo(rel.titulo);
        setTipo(rel.tipo);
        setDescripcion(rel.descripcion || "");
        if (rel.portadaUrl) {
          setExistingCoverUrl(releaseCoverUrl(base, rel.portadaUrl) || null);
        }
        setSelectedTrackIds(rel.canciones.map((c) => c.id));
      }
    } catch (e: any) {
      if (e.status === 401) {
        await clearToken();
        router.replace("/iniciar-sesion");
      } else {
        setErrorMsg(e.message || "Error al inicializar formulario.");
      }
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Image picker
  const pickCover = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;
      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        setErrorMsg("La portada no puede superar los 2 MB.");
        return;
      }

      const mime = asset.mimeType || "";
      if (mime && !["image/png", "image/jpeg"].includes(mime)) {
        setErrorMsg("Formato no compatible. Selecciona una imagen PNG o JPG.");
        return;
      }

      setErrorMsg("");
      setCoverAsset(asset);
    } catch {
      setErrorMsg("No se pudo acceder a la galería del dispositivo.");
    }
  };

  const toggleSong = (songId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId],
    );
  };

  const moveTrack = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= selectedTrackIds.length) return;
    const copy = [...selectedTrackIds];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setSelectedTrackIds(copy);
  };

  const previewSong = (song: AvailableSong) => {
    if (!song.audioUrl) return;
    playback.play({
      id: song.id,
      titulo: song.titulo,
      artista: { id: "", nombre: "" },
      genero: song.genero ? { id: song.generoId || "", nombre: song.genero } : null,
      duracionSegundos: song.duracionSegundos,
      descripcion: "",
      coverUrl: song.coverUrl,
      playable: true,
      source: "LOCAL",
    });
  };

  const handleNextStep1 = () => {
    if (titulo.trim().length < 2) {
      setErrorMsg("El título del lanzamiento debe tener al menos 2 caracteres.");
      return;
    }
    setErrorMsg("");
    setStep(2);
  };

  const handleNextStep2 = () => {
    setErrorMsg("");
    setStep(3);
  };

  const handleSaveDraft = async () => {
    if (titulo.trim().length < 2) {
      setErrorMsg("Introduce un título de al menos 2 caracteres.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      let targetId = releaseId;
      if (!targetId) {
        const created = await createReleaseDraft(
          base,
          {
            titulo: titulo.trim(),
            tipo,
            descripcion: descripcion.trim(),
          },
          token,
        );
        targetId = created.id;
      } else {
        await updateReleaseDraft(
          base,
          targetId,
          {
            titulo: titulo.trim(),
            tipo,
            descripcion: descripcion.trim(),
          },
          token,
        );
      }

      if (targetId) {
        await setReleaseTracks(base, targetId, selectedTrackIds, token);

        if (coverAsset) {
          const form = new FormData();
          const mime = coverAsset.mimeType || "image/jpeg";
          const filename =
            coverAsset.fileName ||
            `cover.${mime === "image/png" ? "png" : "jpg"}`;

          if (Platform.OS === "web" && (coverAsset as any).file) {
            form.append("file", (coverAsset as any).file);
          } else {
            form.append("file", {
              uri: coverAsset.uri,
              name: filename,
              type: mime,
            } as unknown as Blob);
          }
          await uploadReleaseCover(base, targetId, form, token);
        }
      }

      router.replace("/lanzamientos");
    } catch (e: any) {
      setErrorMsg(e.message || "Error al guardar borrador.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (titulo.trim().length < 2) {
      setErrorMsg("Introduce un título válido.");
      return;
    }
    const countErr = validateReleaseTrackCount(tipo, selectedTrackIds.length);
    if (countErr) {
      setErrorMsg(countErr);
      return;
    }
    if (!coverAsset && !existingCoverUrl) {
      setErrorMsg("Debes cargar una portada para poder publicar el lanzamiento.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      let targetId = releaseId;
      if (!targetId) {
        const created = await createReleaseDraft(
          base,
          {
            titulo: titulo.trim(),
            tipo,
            descripcion: descripcion.trim(),
          },
          token,
        );
        targetId = created.id;
      } else {
        await updateReleaseDraft(
          base,
          targetId,
          {
            titulo: titulo.trim(),
            tipo,
            descripcion: descripcion.trim(),
          },
          token,
        );
      }

      if (targetId) {
        await setReleaseTracks(base, targetId, selectedTrackIds, token);

        if (coverAsset) {
          const form = new FormData();
          const mime = coverAsset.mimeType || "image/jpeg";
          const filename =
            coverAsset.fileName ||
            `cover.${mime === "image/png" ? "png" : "jpg"}`;

          if (Platform.OS === "web" && (coverAsset as any).file) {
            form.append("file", (coverAsset as any).file);
          } else {
            form.append("file", {
              uri: coverAsset.uri,
              name: filename,
              type: mime,
            } as unknown as Blob);
          }
          await uploadReleaseCover(base, targetId, form, token);
        }

        await publishRelease(base, targetId, token);
      }

      router.replace("/lanzamientos");
    } catch (e: any) {
      setErrorMsg(e.message || "Error al publicar lanzamiento.");
    } finally {
      setSaving(false);
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
        {/* Header matching Image 1 */}
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Regresar"
            style={s.backBtn}
            onPress={() => {
              if (step > 1) setStep((s) => (s - 1) as any);
              else router.back();
            }}
          >
            <CatalogIcon name="back" size={18} color="#ffffff" />
          </Pressable>

          <View style={{ alignItems: "center" }}>
            <Text style={s.headerTitle}>Crear lanzamiento</Text>
            <Text style={s.headerSubtitle}>Paso {step} de 3</Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* Stepper indicator matching Image 1 */}
        <View style={s.stepperRow}>
          <View style={[s.stepDot, step >= 1 && s.stepDotActive]}>
            {step === 1 && <View style={s.stepDotGlow} />}
          </View>
          <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />
          <View style={[s.stepDot, step >= 2 && s.stepDotActive]}>
            {step === 2 && <View style={s.stepDotGlow} />}
          </View>
          <View style={[s.stepLine, step >= 3 && s.stepLineActive]} />
          <View style={[s.stepDot, step >= 3 && s.stepDotActive]}>
            {step === 3 && <View style={s.stepDotGlow} />}
          </View>
        </View>

        {errorMsg ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
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
            {/* ===================== PASO 1 DE 3 ===================== */}
            {step === 1 && (
              <View style={{ gap: 24 }}>
                {/* Tipo de lanzamiento */}
                <View>
                  <Text style={s.sectionTitle}>Tipo de lanzamiento</Text>
                  <View style={s.typeCardsRow}>
                    {/* Sencillo */}
                    <Pressable
                      style={[
                        s.typeCard,
                        tipo === "SINGLE" && s.typeCardSelected,
                      ]}
                      onPress={() => setTipo("SINGLE")}
                    >
                      {tipo === "SINGLE" && (
                        <View style={s.typeCheckBadge}>
                          <CatalogIcon name="check" size={10} color="#ffffff" />
                        </View>
                      )}
                      <CatalogIcon name="music" size={26} color="#e024ff" />
                      <Text style={s.typeCardTitle}>Sencillo</Text>
                      <Text style={s.typeCardSub}>1 canción</Text>
                    </Pressable>

                    {/* EP */}
                    <Pressable
                      style={[s.typeCard, tipo === "EP" && s.typeCardSelected]}
                      onPress={() => setTipo("EP")}
                    >
                      {tipo === "EP" && (
                        <View style={s.typeCheckBadge}>
                          <CatalogIcon name="check" size={10} color="#ffffff" />
                        </View>
                      )}
                      <CatalogIcon name="layers" size={26} color="#e024ff" />
                      <Text style={s.typeCardTitle}>EP</Text>
                      <Text style={s.typeCardSub}>2 – 6 canciones</Text>
                    </Pressable>

                    {/* Álbum */}
                    <Pressable
                      style={[
                        s.typeCard,
                        tipo === "ALBUM" && s.typeCardSelected,
                      ]}
                      onPress={() => setTipo("ALBUM")}
                    >
                      {tipo === "ALBUM" && (
                        <View style={s.typeCheckBadge}>
                          <CatalogIcon name="check" size={10} color="#ffffff" />
                        </View>
                      )}
                      <CatalogIcon name="disc" size={26} color="#e024ff" />
                      <Text style={s.typeCardTitle}>Álbum</Text>
                      <Text style={s.typeCardSub}>7 o más canciones</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Título del lanzamiento */}
                <View>
                  <Text style={s.sectionTitle}>Título del lanzamiento *</Text>
                  <TextInput
                    style={s.textInput}
                    placeholder="Ej: Luz Intermitente"
                    placeholderTextColor="#796791"
                    maxLength={100}
                    value={titulo}
                    onChangeText={setTitulo}
                  />
                  <Text style={s.counterText}>{titulo.length}/100</Text>
                </View>

                {/* Descripción */}
                <View>
                  <Text style={s.sectionTitle}>Descripción (opcional)</Text>
                  <TextInput
                    style={[s.textInput, { height: 80, textAlignVertical: "top" }]}
                    placeholder="Detalles del lanzamiento..."
                    placeholderTextColor="#796791"
                    multiline
                    maxLength={2000}
                    value={descripcion}
                    onChangeText={setDescripcion}
                  />
                </View>

                {/* Ambient Wave */}
                <View style={s.waveContainer}>
                  <View style={s.waveLine} />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Siguiente paso"
                  style={s.nextBtn}
                  onPress={handleNextStep1}
                >
                  <LinearGradient
                    colors={["#d414a8", "#9d29ed"]}
                    style={s.nextBtnGrad}
                  >
                    <Text style={s.nextBtnText}>Siguiente →</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {/* ===================== PASO 2 DE 3 ===================== */}
            {step === 2 && (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={s.sectionTitle}>Portada del lanzamiento</Text>
                  <Text style={s.sectionSubtitle}>
                    Elige una imagen cuadrada desde la galería (PNG o JPG, hasta 2 MB).
                  </Text>
                </View>

                <View style={s.coverPickerContainer}>
                  <Pressable style={s.coverBox} onPress={pickCover}>
                    {coverAsset ? (
                      <Image
                        source={{ uri: coverAsset.uri }}
                        style={s.coverImage}
                      />
                    ) : existingCoverUrl ? (
                      <Image
                        source={{ uri: existingCoverUrl }}
                        style={s.coverImage}
                      />
                    ) : (
                      <View style={{ alignItems: "center", gap: 10 }}>
                        <CatalogIcon name="layers" size={38} color="#e024ff" />
                        <Text style={{ color: "#baa4d4", fontSize: 13 }}>
                          Toca para seleccionar imagen
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {(coverAsset || existingCoverUrl) && (
                    <Pressable
                      style={s.changeCoverBtn}
                      onPress={pickCover}
                    >
                      <CatalogIcon name="edit" size={14} color="#ffffff" />
                      <Text style={s.changeCoverText}>Reemplazar portada</Text>
                    </Pressable>
                  )}
                </View>

                {/* Resumen de paso 1 */}
                <View style={s.summaryCard}>
                  <Text style={s.summaryLabel}>RESUMEN DE INFORMACIÓN</Text>
                  <Text style={s.summaryTitle}>{titulo || "Sin título"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <CatalogIcon name="disc" size={14} color="#00f0ff" />
                    <Text style={{ color: "#00f0ff", fontSize: 13, fontWeight: "600" }}>
                      {releaseTypeLabel(tipo)}
                    </Text>
                  </View>
                </View>

                <View style={s.twoButtonsRow}>
                  <Pressable
                    style={s.prevBtn}
                    onPress={() => setStep(1)}
                  >
                    <Text style={s.prevBtnText}>← Anterior</Text>
                  </Pressable>

                  <Pressable
                    style={[s.nextBtn, { flex: 1 }]}
                    onPress={handleNextStep2}
                  >
                    <LinearGradient
                      colors={["#d414a8", "#9d29ed"]}
                      style={s.nextBtnGrad}
                    >
                      <Text style={s.nextBtnText}>Siguiente →</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ===================== PASO 3 DE 3 ===================== */}
            {step === 3 && (
              <View style={{ gap: 20 }}>
                {/* Header Card Summary matching Image 1 Right */}
                <View style={s.step3SummaryCard}>
                  <View style={s.step3CoverBox}>
                    {coverAsset ? (
                      <Image
                        source={{ uri: coverAsset.uri }}
                        style={s.step3Cover}
                      />
                    ) : existingCoverUrl ? (
                      <Image
                        source={{ uri: existingCoverUrl }}
                        style={s.step3Cover}
                      />
                    ) : (
                      <View style={{ alignItems: "center", justifyContent: "center" }}>
                        <CatalogIcon name="layers" size={24} color="#9d29ed" />
                      </View>
                    )}
                    <Pressable style={s.step3EditPencil} onPress={() => setStep(2)}>
                      <CatalogIcon name="edit" size={12} color="#ffffff" />
                    </Pressable>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={s.step3Title} numberOfLines={1}>
                      {titulo}
                    </Text>
                    <View style={s.step3TypeBadge}>
                      <CatalogIcon name="disc" size={12} color="#baa4d4" />
                      <Text style={s.step3TypeText}>{releaseTypeLabel(tipo)}</Text>
                    </View>

                    <View style={s.step3CoverLoadedBadge}>
                      <Text style={s.step3CoverLoadedText}>
                        {coverAsset || existingCoverUrl
                          ? "Portada cargada ✓"
                          : "Sin portada"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Canciones del lanzamiento Section */}
                <View>
                  <Text style={s.sectionTitle}>Canciones del lanzamiento *</Text>
                  <Text style={s.sectionSubtitle}>
                    Selecciona tus canciones publicadas. ({selectedTrackIds.length} seleccionadas)
                  </Text>
                </View>

                {availableSongs.length === 0 ? (
                  <View style={s.noSongsBox}>
                    <Text style={s.noSongsText}>
                      Todavía no tienes canciones disponibles para este lanzamiento.
                    </Text>
                    <Pressable
                      style={s.uploadSongRedirectBtn}
                      onPress={() => router.push("/publicar-cancion")}
                    >
                      <LinearGradient
                        colors={["#d414a8", "#9d29ed"]}
                        style={s.uploadSongRedirectGrad}
                      >
                        <Text style={s.uploadSongRedirectText}>
                          + Publicar una canción ahora
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {/* Selected songs first, in order */}
                    {selectedTrackIds.map((id, index) => {
                      const song = availableSongs.find((s) => s.id === id);
                      if (!song) return null;
                      const coverUri = releaseCoverUrl(base, song.coverUrl);

                      return (
                        <View
                          key={song.id}
                          style={[s.songRow, { borderColor: "#d414a8" }]}
                        >
                          <Pressable
                            style={s.checkboxChecked}
                            onPress={() => toggleSong(song.id)}
                          >
                            <CatalogIcon name="check" size={12} color="#ffffff" />
                          </Pressable>

                          <View style={s.songMiniCoverBox}>
                            {coverUri ? (
                              <Image
                                source={{ uri: coverUri }}
                                style={s.songMiniCover}
                              />
                            ) : (
                              <CatalogIcon name="music" size={14} color="#795b9c" />
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={s.songTitle} numberOfLines={1}>
                              {song.titulo}
                            </Text>
                            <Text style={s.songDuration}>
                              {formatDuration(song.duracionSegundos)}
                            </Text>
                          </View>

                          {song.audioUrl && (
                            <Pressable
                              style={s.songPlayBtn}
                              onPress={() => previewSong(song)}
                            >
                              <CatalogIcon name="play" size={14} color="#ffffff" />
                            </Pressable>
                          )}

                          <View style={{ flexDirection: "column", gap: 4 }}>
                            <Pressable
                              disabled={index === 0}
                              onPress={() => moveTrack(index, "up")}
                              style={[s.reorderBtn, index === 0 && { opacity: 0.2 }]}
                            >
                              <CatalogIcon name="up" size={12} color="#cfc2df" />
                            </Pressable>
                            <Pressable
                              disabled={index === selectedTrackIds.length - 1}
                              onPress={() => moveTrack(index, "down")}
                              style={[
                                s.reorderBtn,
                                index === selectedTrackIds.length - 1 && {
                                  opacity: 0.2,
                                },
                              ]}
                            >
                              <CatalogIcon name="down" size={12} color="#cfc2df" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}

                    {/* Unselected available songs */}
                    {availableSongs
                      .filter((s) => !selectedTrackIds.includes(s.id))
                      .map((song) => {
                        const coverUri = releaseCoverUrl(base, song.coverUrl);

                        return (
                          <View key={song.id} style={s.songRow}>
                            <Pressable
                              style={s.checkboxUnchecked}
                              onPress={() => toggleSong(song.id)}
                            />

                            <View style={s.songMiniCoverBox}>
                              {coverUri ? (
                                <Image
                                  source={{ uri: coverUri }}
                                  style={s.songMiniCover}
                                />
                              ) : (
                                <CatalogIcon name="music" size={14} color="#795b9c" />
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={s.songTitle} numberOfLines={1}>
                                {song.titulo}
                              </Text>
                              <Text style={s.songDuration}>
                                {formatDuration(song.duracionSegundos)}
                              </Text>
                            </View>

                            {song.audioUrl && (
                              <Pressable
                                style={s.songPlayBtn}
                                onPress={() => previewSong(song)}
                              >
                                <CatalogIcon name="play" size={14} color="#ffffff" />
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                  </View>
                )}

                {/* Footer Actions */}
                <View style={[s.twoButtonsRow, { marginTop: 16 }]}>
                  <Pressable
                    style={s.prevBtn}
                    onPress={() => setStep(2)}
                  >
                    <Text style={s.prevBtnText}>← Anterior</Text>
                  </Pressable>

                  <Pressable
                    style={[s.nextBtn, { flex: 1 }]}
                    disabled={saving}
                    onPress={handlePublish}
                  >
                    <LinearGradient
                      colors={["#e024ff", "#9d29ed"]}
                      style={s.nextBtnGrad}
                    >
                      <Text style={s.nextBtnText}>
                        {saving ? "Publicando..." : "Crear lanzamiento ✓"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                <Pressable
                  style={{ alignSelf: "center", paddingVertical: 10 }}
                  disabled={saving}
                  onPress={handleSaveDraft}
                >
                  <Text style={{ color: "#baa4d4", fontSize: 13, textDecorationLine: "underline" }}>
                    Guardar como borrador y salir
                  </Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
    fontSize: 12,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  stepDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    backgroundColor: "#e024ff",
  },
  stepDotGlow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#00f0ff",
    position: "absolute",
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  stepLineActive: {
    backgroundColor: "#e024ff",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionSubtitle: {
    color: "#baa4d4",
    fontSize: 12.5,
    marginBottom: 12,
  },
  typeCardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeCard: {
    flex: 1,
    backgroundColor: "rgba(20, 10, 38, 0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(157, 41, 237, 0.3)",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  typeCardSelected: {
    borderColor: "#e024ff",
    backgroundColor: "rgba(224, 36, 255, 0.12)",
    shadowColor: "#e024ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  typeCheckBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#e024ff",
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  typeCardSub: {
    color: "#baa4d4",
    fontSize: 11,
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
  counterText: {
    color: "#8c7b9e",
    fontSize: 11.5,
    textAlign: "right",
    marginTop: 4,
  },
  waveContainer: {
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
  },
  waveLine: {
    height: 2,
    backgroundColor: "#00f0ff",
    shadowColor: "#00f0ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  nextBtn: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#e024ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnGrad: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  prevBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  prevBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  twoButtonsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  coverPickerContainer: {
    alignItems: "center",
    gap: 14,
  },
  coverBox: {
    width: 220,
    height: 220,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(157, 41, 237, 0.5)",
    borderStyle: "dashed",
    backgroundColor: "rgba(20, 10, 38, 0.7)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  changeCoverBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  changeCoverText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "rgba(20, 10, 38, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.3)",
    borderRadius: 14,
    padding: 16,
  },
  summaryLabel: {
    color: "#8c7b9e",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  step3SummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(20, 10, 38, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(0, 240, 255, 0.35)",
    borderRadius: 18,
    padding: 14,
  },
  step3CoverBox: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: "#130724",
    overflow: "hidden",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  step3Cover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  step3EditPencil: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  step3Title: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  step3TypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginVertical: 4,
  },
  step3TypeText: {
    color: "#baa4d4",
    fontSize: 12.5,
  },
  step3CoverLoadedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.4)",
    alignSelf: "flex-start",
  },
  step3CoverLoadedText: {
    color: "#00e676",
    fontSize: 11,
    fontWeight: "600",
  },
  noSongsBox: {
    backgroundColor: "rgba(20, 10, 38, 0.6)",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  noSongsText: {
    color: "#baa4d4",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  uploadSongRedirectBtn: {
    borderRadius: 20,
    overflow: "hidden",
  },
  uploadSongRedirectGrad: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  uploadSongRedirectText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(20, 10, 38, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.2)",
    borderRadius: 14,
    padding: 10,
  },
  checkboxChecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#d414a8",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxUnchecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#796791",
  },
  songMiniCoverBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#130724",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  songMiniCover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  songTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  songDuration: {
    color: "#baa4d4",
    fontSize: 12,
    marginTop: 2,
  },
  songPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtn: {
    width: 26,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
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
});
