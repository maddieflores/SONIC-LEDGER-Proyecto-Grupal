import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { CatalogIcon } from "../components/CatalogIcon";
import { BottomNav } from "../features/catalog/CatalogScreen";
import { useNativePlayback } from "../features/playback/NativePlayback";
import { getToken, clearToken } from "../services/session";
import {
  fetchUserPlaylists,
  fetchUserPlaylist,
  createUserPlaylist,
  updateUserPlaylist,
  deleteUserPlaylist,
  addTrackToUserPlaylist,
  removeTrackFromUserPlaylist,
  reorderUserPlaylistTracks,
  fetchUserFavorites,
  toggleFavorite,
} from "../../../shared/library-api";
import {
  fetchUserHistory,
  deleteHistoryEntry,
  clearUserHistory,
} from "../../../shared/history-api";
import { type ListeningHistoryItem } from "../../../shared/history";
import {
  type PlaylistSummary,
  type PlaylistDetail,
  type FavoriteResponse,
} from "../../../shared/library";
import { type CatalogSong } from "../../../shared/catalog";

const base = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

function formatSeconds(secs?: number | null): string {
  if (!secs) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatHistoryDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "";
  }
}

export default function MobileLibraryScreen() {
  const playback = useNativePlayback();
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<"playlists" | "favoritos" | "historial">("playlists");

  // Playlists
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistDesc, setPlaylistDesc] = useState("");

  // Favorites
  const [favorites, setFavorites] = useState<CatalogSong[]>([]);

  // History
  const [historyItems, setHistoryItems] = useState<ListeningHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "PLAYED" | "SKIPPED">("ALL");

  // Add to playlist modal
  const [songForPlaylist, setSongForPlaylist] = useState<CatalogSong | null>(null);
  const [targetPlaylistId, setTargetPlaylistId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = useCallback(
    async (t?: string) => {
      try {
        const authToken = t || (await getToken());
        if (!authToken) {
          router.replace("/iniciar-sesion");
          return;
        }
        setToken(authToken);

        const [pls, favs, hist] = await Promise.all([
          fetchUserPlaylists(base, authToken),
          fetchUserFavorites(base, authToken),
          fetchUserHistory(base, { pageSize: 50 }, authToken),
        ]);
        setPlaylists(pls);
        setFavorites(favs);
        setHistoryItems(hist.items);
        setErrorMsg("");
      } catch (e: any) {
        if (e.status === 401) {
          await clearToken();
          router.replace("/iniciar-sesion");
        } else {
          setErrorMsg(e.message || "Error al cargar la biblioteca.");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Open playlist detail
  const handleOpenPlaylist = async (id: string) => {
    setLoading(true);
    try {
      const detail = await fetchUserPlaylist(base, id, token);
      setSelectedPlaylist(detail);
    } catch (e: any) {
      Alert.alert("Error", "No se pudo cargar la playlist.");
    } finally {
      setLoading(false);
    }
  };

  // Create playlist
  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) {
      Alert.alert("Campo requerido", "Introduce un nombre para la playlist.");
      return;
    }
    try {
      const created = await createUserPlaylist(
        base,
        {
          nombre: playlistName.trim(),
          descripcion: playlistDesc.trim() || undefined,
        },
        token,
      );
      setShowCreateModal(false);
      setPlaylistName("");
      setPlaylistDesc("");
      setSuccessMsg(`Playlist "${created.nombre}" creada.`);
      await loadData(token);
      await handleOpenPlaylist(created.id);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo crear la playlist.");
    }
  };

  // Edit playlist
  const handleUpdatePlaylist = async () => {
    if (!selectedPlaylist || !playlistName.trim()) return;
    try {
      const updated = await updateUserPlaylist(
        base,
        selectedPlaylist.id,
        {
          nombre: playlistName.trim(),
          descripcion: playlistDesc.trim() || undefined,
        },
        token,
      );
      setShowEditModal(false);
      setSelectedPlaylist(updated);
      setSuccessMsg("Playlist actualizada.");
      await loadData(token);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo actualizar la playlist.");
    }
  };

  // Delete playlist
  const handleDeletePlaylist = () => {
    if (!selectedPlaylist) return;
    Alert.alert(
      "Eliminar playlist",
      `¿Seguro que deseas eliminar "${selectedPlaylist.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUserPlaylist(base, selectedPlaylist.id, token);
              setSelectedPlaylist(null);
              setSuccessMsg("Playlist eliminada.");
              await loadData(token);
            } catch (e: any) {
              Alert.alert("Error", e.message || "No se pudo eliminar.");
            }
          },
        },
      ],
    );
  };

  // Remove track
  const handleRemoveTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;
    try {
      const updated = await removeTrackFromUserPlaylist(base, selectedPlaylist.id, trackId, token);
      setSelectedPlaylist(updated);
      await loadData(token);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo quitar la canción.");
    }
  };

  // Reorder track
  const handleMoveTrack = async (index: number, direction: "up" | "down") => {
    if (!selectedPlaylist) return;
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= selectedPlaylist.tracks.length) return;

    const copy = [...selectedPlaylist.tracks];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;

    const trackIds = copy.map((c) => c.id);
    try {
      const updated = await reorderUserPlaylistTracks(base, selectedPlaylist.id, trackIds, token);
      setSelectedPlaylist(updated);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo reordenar canciones.");
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (song: CatalogSong) => {
    try {
      const res: FavoriteResponse = await toggleFavorite(base, song.id, true, song.source, token);
      if (!res.favorited) {
        setFavorites((prev) => prev.filter((s) => s.id !== song.id));
        setSuccessMsg(`"${song.titulo}" quitada de tus favoritas.`);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo actualizar favorita.");
    }
  };

  // Delete history entry
  const handleDeleteHistory = async (id: string) => {
    try {
      await deleteHistoryEntry(base, id, token);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo eliminar la entrada del historial.");
    }
  };

  // Clear all history
  const handleClearHistory = () => {
    Alert.alert(
      "Limpiar historial",
      "¿Seguro que deseas borrar todo tu historial de reproducción? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar todo",
          style: "destructive",
          onPress: async () => {
            try {
              await clearUserHistory(base, token);
              setHistoryItems([]);
              setSuccessMsg("Historial de reproducción vaciado.");
            } catch (e: any) {
              Alert.alert("Error", e.message || "No se pudo limpiar el historial.");
            }
          },
        },
      ],
    );
  };

  // Add song to playlist
  const handleAddSongToPlaylist = async () => {
    if (!songForPlaylist || !targetPlaylistId) return;
    try {
      await addTrackToUserPlaylist(base, targetPlaylistId, songForPlaylist.id, songForPlaylist.source, token);
      const pl = playlists.find((p) => p.id === targetPlaylistId);
      setSongForPlaylist(null);
      setSuccessMsg(`"${songForPlaylist.titulo}" agregada a "${pl?.nombre || "la playlist"}".`);
      await loadData(token);
    } catch (e: any) {
      Alert.alert("Error", e.message || "No se pudo agregar a la playlist.");
    }
  };

  const playedCount = historyItems.filter((h) => h.eventType === "PLAYED").length;
  const skippedCount = historyItems.filter((h) => h.eventType === "SKIPPED").length;
  const filteredHistory = historyItems.filter((item) => {
    if (historyFilter === "PLAYED") return item.eventType === "PLAYED";
    if (historyFilter === "SKIPPED") return item.eventType === "SKIPPED";
    return true;
  });

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.brandLogo}>Sonic Ledger®</Text>
          <Text style={s.screenTitle}>Mi música</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Crear playlist"
          onPress={() => {
            setPlaylistName("");
            setPlaylistDesc("");
            setShowCreateModal(true);
          }}
          style={s.createBtn}
        >
          <LinearGradient
            colors={["#d414a8", "#9d29ed"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.createBtnGrad}
          >
            <CatalogIcon name="plus" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabsRow}>
        <Pressable
          onPress={() => {
            setTab("playlists");
            setSelectedPlaylist(null);
          }}
          style={[s.tabPill, tab === "playlists" && s.tabPillActive]}
        >
          <Text style={[s.tabText, tab === "playlists" && s.tabTextActive]}>
            Playlists ({playlists.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setTab("favoritos");
            setSelectedPlaylist(null);
          }}
          style={[s.tabPill, tab === "favoritos" && s.tabPillActive]}
        >
          <Text style={[s.tabText, tab === "favoritos" && s.tabTextActive]}>
            Favoritos ({favorites.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setTab("historial");
            setSelectedPlaylist(null);
          }}
          style={[s.tabPill, tab === "historial" && s.tabPillActive]}
        >
          <Text style={[s.tabText, tab === "historial" && s.tabTextActive]}>
            Historial ({historyItems.length})
          </Text>
        </Pressable>
      </View>

      {/* Notification Banner */}
      {Boolean(successMsg) && (
        <View style={s.noticeBanner}>
          <Text style={s.noticeText}>{successMsg}</Text>
          <Pressable onPress={() => setSuccessMsg("")}>
            <CatalogIcon name="close" size={16} color="#00f0ff" />
          </Pressable>
        </View>
      )}

      {/* Content Area */}
      {loading ? (
        <View style={s.loaderWrap}>
          <ActivityIndicator size="large" color="#d414a8" />
        </View>
      ) : selectedPlaylist ? (
        /* PLAYLIST DETAIL SCREEN */
        <ScrollView
          style={s.content}
          contentContainerStyle={{ paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => handleOpenPlaylist(selectedPlaylist.id)}
              tintColor="#d414a8"
            />
          }
        >
          <Pressable
            onPress={() => setSelectedPlaylist(null)}
            style={s.backBtnRow}
          >
            <CatalogIcon name="back" size={18} color="#baa4d4" />
            <Text style={s.backBtnText}>Volver a mis playlists</Text>
          </Pressable>

          <View style={s.detailHeaderCard}>
            <View style={s.detailArt}>
              {selectedPlaylist.tracks[0]?.coverUrl ? (
                <Image
                  source={{ uri: selectedPlaylist.tracks[0].coverUrl }}
                  style={s.detailArtImg}
                />
              ) : (
                <CatalogIcon name="music" size={36} color="#9d29ed" />
              )}
            </View>
            <View style={s.detailInfo}>
              <Text style={s.detailTag}>PLAYLIST</Text>
              <Text style={s.detailTitle}>{selectedPlaylist.nombre}</Text>
              <Text style={s.detailDesc} numberOfLines={2}>
                {selectedPlaylist.descripcion || "Sin descripción"}
              </Text>
              <Text style={s.detailMeta}>
                {selectedPlaylist.tracks.length} canciones
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={s.detailActionsRow}>
            <Pressable
              onPress={() => {
                if (selectedPlaylist.tracks.length > 0) {
                  playback.play(selectedPlaylist.tracks[0], selectedPlaylist.tracks);
                  router.push("/reproduciendo");
                }
              }}
              disabled={selectedPlaylist.tracks.length === 0}
              style={[
                s.playAllBtn,
                selectedPlaylist.tracks.length === 0 && { opacity: 0.4 },
              ]}
            >
              <LinearGradient
                colors={["#d414a8", "#9d29ed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.playAllBtnGrad}
              >
                <CatalogIcon name="play" size={18} color="#fff" />
                <Text style={s.playAllText}>Reproducir</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => {
                setPlaylistName(selectedPlaylist.nombre);
                setPlaylistDesc(selectedPlaylist.descripcion || "");
                setShowEditModal(true);
              }}
              style={s.actionIconBtn}
            >
              <CatalogIcon name="edit" size={18} color="#baa4d4" />
            </Pressable>

            <Pressable
              onPress={handleDeletePlaylist}
              style={s.actionIconBtn}
            >
              <CatalogIcon name="trash" size={18} color="#ff2d6a" />
            </Pressable>
          </View>

          {/* Tracks List */}
          <Text style={s.sectionHeader}>Canciones</Text>
          {selectedPlaylist.tracks.length === 0 ? (
            <View style={s.emptyTracks}>
              <Text style={s.emptyTracksText}>Esta playlist no tiene canciones aún.</Text>
              <Pressable
                onPress={() => router.push("/explorar")}
                style={s.exploreLinkBtn}
              >
                <Text style={s.exploreLinkText}>Explorar canciones</Text>
              </Pressable>
            </View>
          ) : (
            selectedPlaylist.tracks.map((track, idx) => (
              <View key={track.id} style={s.trackRow}>
                <Text style={s.trackIdx}>{idx + 1}</Text>
                <Pressable
                  onPress={() => {
                    playback.play(track, selectedPlaylist.tracks);
                    router.push("/reproduciendo");
                  }}
                  style={s.trackMain}
                >
                  <Text numberOfLines={1} style={s.trackTitle}>
                    {track.titulo}
                  </Text>
                  <Text numberOfLines={1} style={s.trackArtist}>
                    {track.artista.nombre} · {track.source || "LOCAL"}
                  </Text>
                </Pressable>

                <View style={s.trackControls}>
                  <Pressable
                    disabled={idx === 0}
                    onPress={() => handleMoveTrack(idx, "up")}
                    style={[s.iconAction, idx === 0 && { opacity: 0.25 }]}
                  >
                    <CatalogIcon name="up" size={16} color="#baa4d4" />
                  </Pressable>
                  <Pressable
                    disabled={idx === selectedPlaylist.tracks.length - 1}
                    onPress={() => handleMoveTrack(idx, "down")}
                    style={[
                      s.iconAction,
                      idx === selectedPlaylist.tracks.length - 1 && { opacity: 0.25 },
                    ]}
                  >
                    <CatalogIcon name="down" size={16} color="#baa4d4" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveTrack(track.id)}
                    style={s.iconAction}
                  >
                    <CatalogIcon name="trash" size={16} color="#ff2d6a" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      ) : tab === "playlists" ? (
        /* PLAYLISTS LIST */
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(token)}
              tintColor="#d414a8"
            />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <CatalogIcon name="music" size={48} color="#452766" />
              <Text style={s.emptyTitle}>No tienes playlists aún</Text>
              <Text style={s.emptySub}>
                Crea listas personalizadas con canciones de Sonic Ledger y Audius.
              </Text>
              <Pressable
                onPress={() => {
                  setPlaylistName("");
                  setPlaylistDesc("");
                  setShowCreateModal(true);
                }}
                style={s.emptyActionBtn}
              >
                <Text style={s.emptyActionText}>+ Crear mi primera playlist</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleOpenPlaylist(item.id)}
              style={s.playlistCard}
            >
              <View style={s.cardArt}>
                <CatalogIcon name="music" size={26} color="#9d29ed" />
              </View>
              <View style={s.cardInfo}>
                <Text numberOfLines={1} style={s.cardTitle}>
                  {item.nombre}
                </Text>
                <Text numberOfLines={1} style={s.cardDesc}>
                  {item.descripcion || "Sin descripción"}
                </Text>
                <Text style={s.cardMeta}>{item.trackCount} canciones</Text>
              </View>
              <CatalogIcon name="play" size={18} color="#00f0ff" />
            </Pressable>
          )}
        />
      ) : tab === "favoritos" ? (
        /* FAVORITES LIST */
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(token)}
              tintColor="#d414a8"
            />
          }
          ListHeaderComponent={
            favorites.length > 0 ? (
              <View style={s.favHeaderRow}>
                <Pressable
                  onPress={() => {
                    playback.play(favorites[0], favorites);
                    router.push("/reproduciendo");
                  }}
                  style={s.playAllFavsBtn}
                >
                  <LinearGradient
                    colors={["#ff2d6a", "#b818c8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.playAllBtnGrad}
                  >
                    <CatalogIcon name="play" size={18} color="#fff" />
                    <Text style={s.playAllText}>Reproducir favoritas</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <CatalogIcon name="heart" size={48} color="#ff2d6a" />
              <Text style={s.emptyTitle}>Sin favoritas todavía</Text>
              <Text style={s.emptySub}>
                Explora el catálogo y pulsa el corazón en las canciones que te encanten.
              </Text>
              <Pressable
                onPress={() => router.push("/explorar")}
                style={s.emptyActionBtn}
              >
                <Text style={s.emptyActionText}>Ir a Explorar</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.favoriteRow}>
              <Pressable
                onPress={() => {
                  playback.play(item, favorites);
                  router.push("/reproduciendo");
                }}
                style={s.favSongInfo}
              >
                <View style={s.favArt}>
                  {item.coverUrl ? (
                    <Image source={{ uri: item.coverUrl }} style={s.favArtImg} />
                  ) : (
                    <CatalogIcon name="music" size={20} color="#9d29ed" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={s.trackTitle}>
                    {item.titulo}
                  </Text>
                  <Text numberOfLines={1} style={s.trackArtist}>
                    {item.artista.nombre} · {item.source || "LOCAL"}
                  </Text>
                </View>
              </Pressable>

              <View style={s.favControls}>
                <Pressable
                  onPress={() => {
                    setSongForPlaylist(item);
                    setTargetPlaylistId(playlists[0]?.id || "");
                  }}
                  style={s.iconAction}
                  accessibilityLabel="Agregar a playlist"
                >
                  <CatalogIcon name="plus" size={18} color="#baa4d4" />
                </Pressable>

                <Pressable
                  onPress={() => handleToggleFavorite(item)}
                  style={s.iconAction}
                  accessibilityLabel="Quitar de favoritas"
                >
                  <CatalogIcon name="heart" size={18} color="#ff2d6a" />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        /* HISTORIAL LIST */
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(token)}
              tintColor="#d414a8"
            />
          }
          ListHeaderComponent={
            historyItems.length > 0 ? (
              <View style={{ marginBottom: 14 }}>
                <View style={s.histHeaderRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CatalogIcon name="clock" size={16} color="#00f0ff" />
                    <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>
                      Actividad reciente
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearHistory}
                    style={s.clearHistBtn}
                    accessibilityLabel="Limpiar historial"
                  >
                    <CatalogIcon name="trash" size={14} color="#ff2d6a" />
                    <Text style={s.clearHistText}>Limpiar</Text>
                  </Pressable>
                </View>

                {/* Filter pills */}
                <View style={s.histFilterRow}>
                  <Pressable
                    onPress={() => setHistoryFilter("ALL")}
                    style={[s.histFilterPill, historyFilter === "ALL" && s.histFilterPillActive]}
                  >
                    <Text style={[s.histFilterText, historyFilter === "ALL" && s.histFilterTextActive]}>
                      Todas ({historyItems.length})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setHistoryFilter("PLAYED")}
                    style={[s.histFilterPill, historyFilter === "PLAYED" && s.histFilterPillActive]}
                  >
                    <Text style={[s.histFilterText, historyFilter === "PLAYED" && s.histFilterTextActive]}>
                      Reproducidas ({playedCount})
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setHistoryFilter("SKIPPED")}
                    style={[s.histFilterPill, historyFilter === "SKIPPED" && s.histFilterPillActive]}
                  >
                    <Text style={[s.histFilterText, historyFilter === "SKIPPED" && s.histFilterTextActive]}>
                      Omitidas ({skippedCount})
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <CatalogIcon name="clock" size={48} color="#452766" />
              <Text style={s.emptyTitle}>Sin reproducciones registradas</Text>
              <Text style={s.emptySub}>
                Las canciones que escuches se registrarán aquí automáticamente con su tiempo reproducido y estado.
              </Text>
              <Pressable
                onPress={() => router.push("/explorar")}
                style={s.emptyActionBtn}
              >
                <Text style={s.emptyActionText}>Explorar música</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.historyRow}>
              <Pressable
                onPress={() => {
                  playback.play(item.song, filteredHistory.map((h) => h.song));
                  router.push("/reproduciendo");
                }}
                style={s.favSongInfo}
              >
                <View style={s.historyArt}>
                  {item.song.coverUrl ? (
                    <Image source={{ uri: item.song.coverUrl }} style={s.historyArtImg} />
                  ) : (
                    <CatalogIcon name="music" size={20} color="#9d29ed" />
                  )}
                </View>
                <View style={s.historyInfo}>
                  <Text numberOfLines={1} style={s.historyTitle}>
                    {item.song.titulo}
                  </Text>
                  <Text numberOfLines={1} style={s.historyArtist}>
                    {item.song.artista.nombre}
                  </Text>
                  <View style={s.historyMetaRow}>
                    <View
                      style={
                        item.eventType === "PLAYED"
                          ? s.historyBadgePlayed
                          : s.historyBadgeSkipped
                      }
                    >
                      <Text
                        style={
                          item.eventType === "PLAYED"
                            ? s.historyBadgePlayedText
                            : s.historyBadgeSkippedText
                        }
                      >
                        {item.eventType === "PLAYED" ? "Reproducida" : "Omitida"}
                      </Text>
                    </View>
                    <View style={s.historySourceBadge}>
                      <Text style={s.historySourceBadgeText}>
                        {item.song.source || "LOCAL"}
                      </Text>
                    </View>
                    <Text style={s.historyTimeText}>
                      {Math.round(item.listenedSeconds)}s · {formatHistoryDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </Pressable>

              <View style={s.historyActions}>
                <Pressable
                  onPress={() => {
                    playback.play(item.song, filteredHistory.map((h) => h.song));
                    router.push("/reproduciendo");
                  }}
                  style={s.iconAction}
                  accessibilityLabel="Volver a reproducir"
                >
                  <CatalogIcon name="play" size={16} color="#00f0ff" />
                </Pressable>

                <Pressable
                  onPress={() => handleDeleteHistory(item.id)}
                  style={s.iconAction}
                  accessibilityLabel="Eliminar del historial"
                >
                  <CatalogIcon name="trash" size={16} color="#ff2d6a" />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* CREATE PLAYLIST MODAL */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nueva playlist</Text>
              <Pressable onPress={() => setShowCreateModal(false)}>
                <CatalogIcon name="close" size={20} color="#baa4d4" />
              </Pressable>
            </View>

            <Text style={s.inputLabel}>Nombre de la playlist *</Text>
            <TextInput
              style={s.input}
              placeholder="Ej: Synthwave Night..."
              placeholderTextColor="#6f5d84"
              value={playlistName}
              onChangeText={setPlaylistName}
              autoFocus
            />

            <Text style={s.inputLabel}>Descripción (opcional)</Text>
            <TextInput
              style={[s.input, { height: 75, textAlignVertical: "top" }]}
              placeholder="¿Qué vibra tiene esta playlist?"
              placeholderTextColor="#6f5d84"
              value={playlistDesc}
              onChangeText={setPlaylistDesc}
              multiline
            />

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setShowCreateModal(false)}
                style={s.cancelBtn}
              >
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleCreatePlaylist} style={s.confirmBtn}>
                <LinearGradient
                  colors={["#d414a8", "#9d29ed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.confirmBtnGrad}
                >
                  <Text style={s.confirmBtnText}>Crear</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT PLAYLIST MODAL */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar playlist</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <CatalogIcon name="close" size={20} color="#baa4d4" />
              </Pressable>
            </View>

            <Text style={s.inputLabel}>Nombre de la playlist *</Text>
            <TextInput
              style={s.input}
              value={playlistName}
              onChangeText={setPlaylistName}
              autoFocus
            />

            <Text style={s.inputLabel}>Descripción (opcional)</Text>
            <TextInput
              style={[s.input, { height: 75, textAlignVertical: "top" }]}
              value={playlistDesc}
              onChangeText={setPlaylistDesc}
              multiline
            />

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={s.cancelBtn}
              >
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleUpdatePlaylist} style={s.confirmBtn}>
                <LinearGradient
                  colors={["#d414a8", "#9d29ed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.confirmBtnGrad}
                >
                  <Text style={s.confirmBtnText}>Guardar</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ADD TO PLAYLIST MODAL */}
      <Modal visible={Boolean(songForPlaylist)} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Añadir a playlist</Text>
              <Pressable onPress={() => setSongForPlaylist(null)}>
                <CatalogIcon name="close" size={20} color="#baa4d4" />
              </Pressable>
            </View>

            <Text style={s.inputLabel}>
              Selecciona la playlist para "{songForPlaylist?.titulo}":
            </Text>

            {playlists.length === 0 ? (
              <Text style={{ color: "#baa4d4", marginVertical: 12 }}>
                No tienes playlists creadas. Primero crea una playlist.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 180, marginVertical: 10 }}>
                {playlists.map((pl) => (
                  <Pressable
                    key={pl.id}
                    onPress={() => setTargetPlaylistId(pl.id)}
                    style={[
                      s.plSelectItem,
                      targetPlaylistId === pl.id && s.plSelectItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.plSelectText,
                        targetPlaylistId === pl.id && s.plSelectTextActive,
                      ]}
                    >
                      {pl.nombre} ({pl.trackCount} canciones)
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={s.modalActions}>
              <Pressable
                onPress={() => setSongForPlaylist(null)}
                style={s.cancelBtn}
              >
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={playlists.length === 0 || !targetPlaylistId}
                onPress={handleAddSongToPlaylist}
                style={[
                  s.confirmBtn,
                  (!targetPlaylistId || playlists.length === 0) && { opacity: 0.4 },
                ]}
              >
                <LinearGradient
                  colors={["#d414a8", "#9d29ed"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.confirmBtnGrad}
                >
                  <Text style={s.confirmBtnText}>Añadir</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <BottomNav current="Mi música" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#080516",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  brandLogo: {
    color: "#baa4d4",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  screenTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  createBtnGrad: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(35, 17, 60, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.3)",
  },
  tabPillActive: {
    backgroundColor: "#9d29ed",
    borderColor: "#d414a8",
  },
  tabText: {
    color: "#baa4d4",
    fontSize: 13.5,
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  noticeBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0, 240, 255, 0.15)",
    borderWidth: 1,
    borderColor: "#00f0ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noticeText: {
    color: "#fff",
    fontSize: 13,
    flex: 1,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playlistCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 11, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.25)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 14,
  },
  cardArt: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#130728",
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardDesc: {
    color: "#baa4d4",
    fontSize: 12.5,
    marginBottom: 4,
  },
  cardMeta: {
    color: "#8c7b9e",
    fontSize: 11.5,
  },
  favHeaderRow: {
    marginBottom: 14,
  },
  playAllFavsBtn: {
    borderRadius: 22,
    overflow: "hidden",
  },
  playAllBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 8,
  },
  playAllText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  favoriteRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 11, 42, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.2)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  favSongInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  favArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#130728",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  favArtImg: {
    width: "100%",
    height: "100%",
  },
  favControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconAction: {
    padding: 8,
  },
  backBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  backBtnText: {
    color: "#baa4d4",
    fontSize: 14,
  },
  detailHeaderCard: {
    flexDirection: "row",
    backgroundColor: "rgba(25, 12, 48, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.35)",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 14,
  },
  detailArt: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#130728",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  detailArtImg: {
    width: "100%",
    height: "100%",
  },
  detailInfo: {
    flex: 1,
  },
  detailTag: {
    color: "#00f0ff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  detailTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  detailDesc: {
    color: "#baa4d4",
    fontSize: 12,
    marginBottom: 6,
  },
  detailMeta: {
    color: "#8c7b9e",
    fontSize: 11,
  },
  detailActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  playAllBtn: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
  },
  actionIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(35, 17, 60, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyTracks: {
    padding: 24,
    alignItems: "center",
  },
  emptyTracksText: {
    color: "#baa4d4",
    fontSize: 13,
    marginBottom: 10,
  },
  exploreLinkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "rgba(157, 41, 237, 0.3)",
    borderWidth: 1,
    borderColor: "#9d29ed",
  },
  exploreLinkText: {
    color: "#00f0ff",
    fontSize: 13,
    fontWeight: "600",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 11, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.15)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 10,
  },
  trackIdx: {
    color: "#8c7b9e",
    fontSize: 12,
    width: 20,
    textAlign: "center",
  },
  trackMain: {
    flex: 1,
  },
  trackTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  trackArtist: {
    color: "#baa4d4",
    fontSize: 12,
    marginTop: 2,
  },
  trackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  emptySub: {
    color: "#baa4d4",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(157, 41, 237, 0.35)",
    borderWidth: 1,
    borderColor: "#9d29ed",
  },
  emptyActionText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#160a2c",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.4)",
    padding: 22,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  inputLabel: {
    color: "#baa4d4",
    fontSize: 12.5,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "rgba(25, 12, 48, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.35)",
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    color: "#baa4d4",
    fontSize: 13.5,
  },
  confirmBtn: {
    borderRadius: 18,
    overflow: "hidden",
  },
  confirmBtnGrad: {
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  confirmBtnText: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "700",
  },
  plSelectItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "rgba(25, 12, 48, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.2)",
    marginBottom: 8,
  },
  plSelectItemActive: {
    borderColor: "#00f0ff",
    backgroundColor: "rgba(0, 240, 255, 0.15)",
  },
  plSelectText: {
    color: "#baa4d4",
    fontSize: 13,
  },
  plSelectTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  histHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  histFilterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  histFilterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.25)",
  },
  histFilterPillActive: {
    backgroundColor: "rgba(0, 240, 255, 0.15)",
    borderColor: "#00f0ff",
  },
  histFilterText: {
    color: "#baa4d4",
    fontSize: 12,
    fontWeight: "600",
  },
  histFilterTextActive: {
    color: "#00f0ff",
    fontWeight: "700",
  },
  clearHistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255, 45, 106, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 45, 106, 0.3)",
  },
  clearHistText: {
    color: "#ff2d6a",
    fontSize: 11.5,
    fontWeight: "600",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(25, 12, 48, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(157, 41, 237, 0.25)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  historyArt: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: "rgba(157, 41, 237, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  historyArtImg: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  historyInfo: {
    flex: 1,
    marginRight: 8,
  },
  historyTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  historyArtist: {
    color: "#baa4d4",
    fontSize: 12,
    marginBottom: 4,
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  historyBadgePlayed: {
    backgroundColor: "rgba(0, 240, 255, 0.15)",
    borderColor: "#00f0ff",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyBadgePlayedText: {
    color: "#00f0ff",
    fontSize: 10,
    fontWeight: "700",
  },
  historyBadgeSkipped: {
    backgroundColor: "rgba(255, 170, 0, 0.15)",
    borderColor: "#ffaa00",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historyBadgeSkippedText: {
    color: "#ffaa00",
    fontSize: 10,
    fontWeight: "700",
  },
  historySourceBadge: {
    backgroundColor: "rgba(157, 41, 237, 0.25)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  historySourceBadgeText: {
    color: "#baa4d4",
    fontSize: 10,
    fontWeight: "600",
  },
  historyTimeText: {
    color: "#8f7aab",
    fontSize: 11,
  },
  historyActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
