import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { CatalogIcon } from "../../components/CatalogIcon";
import { BottomNav } from "../../features/catalog/CatalogScreen";
import { getToken, clearToken } from "../../services/session";
import {
  fetchArtistReleases,
  deleteRelease,
  publishRelease,
  releaseCoverUrl,
} from "../../../../shared/releases-api";
import {
  formatReleaseDate,
  releaseTypeLabel,
  validateReleaseTrackCount,
  type Release,
  type ReleaseTipo,
} from "../../../../shared/releases";

const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export default function MobileReleasesScreen() {
  const [token, setToken] = useState("");
  const [releases, setReleases] = useState<Release[]>([]);
  const [filterTipo, setFilterTipo] = useState<ReleaseTipo | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Options Sheet
  const [activeRelease, setActiveRelease] = useState<Release | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(
    async (t?: string) => {
      try {
        const authToken = t || (await getToken());
        if (!authToken) {
          router.replace("/iniciar-sesion");
          return;
        }
        setToken(authToken);
        const res = await fetchArtistReleases(
          base,
          {
            tipo: filterTipo === "ALL" ? undefined : filterTipo,
            pageSize: 50,
          },
          authToken,
        );
        setReleases(res.items);
        setErrorMsg("");
      } catch (e: any) {
        if (e.status === 401) {
          await clearToken();
          router.replace("/iniciar-sesion");
        } else if (e.status === 403) {
          setErrorMsg(
            "Esta sección es exclusiva para artistas autorizados. Habilita tu perfil en CU04.",
          );
        } else {
          setErrorMsg(e.message || "Error al cargar lanzamientos.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filterTipo],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(token);
  };

  const handlePublish = async (rel: Release) => {
    const err = validateReleaseTrackCount(rel.tipo, rel.cancionCount);
    if (err) {
      setErrorMsg(err);
      setActiveRelease(null);
      return;
    }
    if (!rel.portadaUrl) {
      setErrorMsg("El lanzamiento necesita una portada antes de publicarse.");
      setActiveRelease(null);
      return;
    }

    setBusyAction(true);
    try {
      await publishRelease(base, rel.id, token);
      setActiveRelease(null);
      await load(token);
    } catch (e: any) {
      setErrorMsg(e.message || "No se pudo publicar el lanzamiento.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleDelete = async () => {
    if (!activeRelease) return;
    setBusyAction(true);
    try {
      await deleteRelease(base, activeRelease.id, token);
      setActiveRelease(null);
      setConfirmDelete(false);
      await load(token);
    } catch (e: any) {
      setErrorMsg(e.message || "No se pudo eliminar el lanzamiento.");
    } finally {
      setBusyAction(false);
    }
  };

  const renderCard = ({ item }: { item: Release }) => {
    const isPublished = item.estado === "publicado";
    const coverUri = releaseCoverUrl(base, item.portadaUrl);

    return (
      <View style={s.card}>
        <View style={s.cardCoverBox}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={s.cardCover} />
          ) : (
            <View style={s.cardFallbackCover}>
              <CatalogIcon name="layers" size={24} color="#9d29ed" />
            </View>
          )}
        </View>

        <View style={s.cardInfo}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {item.titulo}
          </Text>

          <View style={s.cardMetaRow}>
            <CatalogIcon name="music" size={13} color="#d414a8" />
            <Text style={s.cardMetaText}>
              {releaseTypeLabel(item.tipo)} · {item.cancionCount}{" "}
              {item.cancionCount === 1 ? "canción" : "canciones"}
            </Text>
          </View>

          <View style={s.cardBottomRow}>
            <View
              style={isPublished ? s.badgePublicado : s.badgeBorrador}
            >
              <Text
                style={isPublished ? s.badgeTextPublicado : s.badgeTextBorrador}
              >
                {isPublished ? "Publicado" : "Borrador"}
              </Text>
            </View>

            <View style={s.dateRow}>
              <CatalogIcon name="calendar" size={12} color="#8c7b9e" />
              <Text style={s.dateText}>
                {formatReleaseDate(item.fechaLanzamiento || item.createdAt)}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Opciones de lanzamiento"
          style={s.dotsBtn}
          onPress={() => setActiveRelease(item)}
        >
          <CatalogIcon name="dots" size={16} color="#baa4d4" />
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.container}>
      <LinearGradient
        colors={["#16072b", "#090314", "#06020e"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top Header matching Image 1 */}
      <View style={s.header}>
        <View style={s.headerBrand}>
          <CatalogIcon name="music" size={20} color="#e024ff" />
          <Text style={s.headerBrandText}>Sonic Ledger®</Text>
        </View>

        <View style={s.headerActions}>
          <View style={s.headerBell}>
            <CatalogIcon name="disc" size={18} color="#baa4d4" />
          </View>
          <Image
            source={require("../../../assets/icon.png")}
            style={s.avatar}
          />
        </View>
      </View>

      {/* Title + Plus button matching Image 1 */}
      <View style={s.titleRow}>
        <View style={s.titleLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <CatalogIcon name="back" size={18} color="#ffffff" />
          </Pressable>
          <View>
            <Text style={s.title}>Mis lanzamientos</Text>
            <Text style={s.subtitle}>
              Organiza y gestiona tus sencillos, EP y álbumes.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo lanzamiento"
          style={s.createPlusBtn}
          onPress={() => router.push("/lanzamientos/crear")}
        >
          <LinearGradient
            colors={["#e024ff", "#9d29ed"]}
            style={s.plusGradient}
          >
            <CatalogIcon name="plus" size={20} color="#ffffff" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Filter Tabs matching Image 1 */}
      <View style={s.filtersRow}>
        {(["ALL", "SINGLE", "EP", "ALBUM"] as const).map((t) => {
          const isSelected = filterTipo === t;
          const label =
            t === "ALL"
              ? "Todos"
              : t === "SINGLE"
                ? "Sencillos"
                : t === "EP"
                  ? "EP"
                  : "Álbumes";

          return (
            <Pressable
              key={t}
              onPress={() => setFilterTipo(t)}
              style={[s.filterPill, isSelected && s.filterPillActive]}
            >
              {isSelected && (
                <LinearGradient
                  colors={["#d414a8", "#9d29ed"]}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <Text
                style={[
                  s.filterPillText,
                  isSelected && s.filterPillTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Error Notice */}
      {errorMsg ? (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* Releases List */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color="#e024ff" size="large" />
        </View>
      ) : releases.length === 0 ? (
        <View style={s.emptyBox}>
          <CatalogIcon name="layers" size={48} color="#795b9c" />
          <Text style={s.emptyTitle}>Sin lanzamientos</Text>
          <Text style={s.emptySub}>
            Organiza tus canciones publicadas creando tu primer sencillo, EP o
            álbum.
          </Text>
          <Pressable
            style={s.emptyBtn}
            onPress={() => router.push("/lanzamientos/crear")}
          >
            <LinearGradient
              colors={["#d414a8", "#9d29ed"]}
              style={s.emptyBtnGrad}
            >
              <Text style={s.emptyBtnText}>Crear primer lanzamiento</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={releases}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e024ff"
            />
          }
        />
      )}

      {/* Bottom Nav */}
      <BottomNav current="Lanzamientos" />

      {/* Options Modal */}
      <Modal
        visible={Boolean(activeRelease)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setActiveRelease(null);
          setConfirmDelete(false);
        }}
      >
        <Pressable
          style={s.modalOverlay}
          onPress={() => {
            setActiveRelease(null);
            setConfirmDelete(false);
          }}
        >
          <View style={s.modalSheet}>
            <Text style={s.sheetTitle} numberOfLines={1}>
              {activeRelease?.titulo}
            </Text>

            {!confirmDelete ? (
              <>
                <Pressable
                  style={s.sheetOption}
                  onPress={() => {
                    const id = activeRelease?.id;
                    setActiveRelease(null);
                    router.push({
                      pathname: "/lanzamientos/crear",
                      params: { id },
                    });
                  }}
                >
                  <CatalogIcon name="edit" size={18} color="#00f0ff" />
                  <Text style={s.sheetOptionText}>Editar lanzamiento</Text>
                </Pressable>

                {activeRelease?.estado === "borrador" && (
                  <Pressable
                    style={s.sheetOption}
                    disabled={busyAction}
                    onPress={() => activeRelease && handlePublish(activeRelease)}
                  >
                    <CatalogIcon name="play" size={18} color="#00e676" />
                    <Text style={s.sheetOptionText}>Publicar ahora</Text>
                  </Pressable>
                )}

                <Pressable
                  style={s.sheetOption}
                  onPress={() => setConfirmDelete(true)}
                >
                  <CatalogIcon name="trash" size={18} color="#ff5252" />
                  <Text style={[s.sheetOptionText, { color: "#ff5252" }]}>
                    Eliminar lanzamiento
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={{ gap: 14 }}>
                <Text style={{ color: "#d1c5e3", fontSize: 13, lineHeight: 18 }}>
                  ¿Estás seguro de eliminar este lanzamiento? Las canciones
                  asociadas continuarán disponibles en tu perfil sin borrarse.
                </Text>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={[s.sheetBtn, { backgroundColor: "rgba(255,255,255,0.1)" }]}
                    onPress={() => setConfirmDelete(false)}
                  >
                    <Text style={{ color: "white" }}>Cancelar</Text>
                  </Pressable>

                  <Pressable
                    style={[s.sheetBtn, { backgroundColor: "#d50000" }]}
                    disabled={busyAction}
                    onPress={handleDelete}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      {busyAction ? "Eliminando..." : "Confirmar"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
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
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBrandText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#e024ff",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a998c0",
    fontSize: 12,
    marginTop: 2,
  },
  createPlusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#e024ff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  plusGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginVertical: 14,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(157,41,237,0.3)",
    overflow: "hidden",
  },
  filterPillActive: {
    borderColor: "#d414a8",
  },
  filterPillText: {
    color: "#baa4d4",
    fontSize: 13,
    fontWeight: "500",
  },
  filterPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorBox: {
    marginHorizontal: 20,
    marginBottom: 10,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 10, 38, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.35)",
    borderRadius: 16,
    padding: 12,
    gap: 14,
  },
  cardCoverBox: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: "#130724",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardCover: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cardFallbackCover: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  cardMetaText: {
    color: "#cfc2df",
    fontSize: 12.5,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badgePublicado: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(0, 230, 118, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(0, 230, 118, 0.5)",
  },
  badgeTextPublicado: {
    color: "#00e676",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeBorrador: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255, 179, 0, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 179, 0, 0.5)",
  },
  badgeTextBorrador: {
    color: "#ffb300",
    fontSize: 11,
    fontWeight: "700",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    color: "#8c7b9e",
    fontSize: 11.5,
  },
  dotsBtn: {
    padding: 8,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    color: "#a998c0",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyBtn: {
    borderRadius: 24,
    overflow: "hidden",
    marginTop: 10,
  },
  emptyBtnGrad: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#16072b",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.4)",
    gap: 16,
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetOptionText: {
    color: "#f3ecff",
    fontSize: 15,
    fontWeight: "500",
  },
  sheetBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
});
