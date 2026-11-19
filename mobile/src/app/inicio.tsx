import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CatalogIcon } from '../components/CatalogIcon';
import { useNativePlayback } from '../features/playback/NativePlayback';
import { getToken } from '../services/session';
import { request, type User } from '../services/auth';
import {
  catalogCoverUrl,
  catalogDuration,
  catalogRequest,
  type CatalogPage,
  type CatalogSong,
} from '../../../shared/catalog';
import {
  fetchMusicRecommendations,
} from '../../../shared/recommendations-api';
import type {
  MusicRecommendationsResponse,
  RecommendedTrackItem,
} from '../../../shared/recommendations';
import {
  fetchUserPlaylists,
  fetchUserFavoriteIds,
  toggleFavorite,
} from '../../../shared/library-api';
import type { PlaylistSummary } from '../../../shared/library';
import type { Profile } from '../../../shared/profile';

const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

type FilterType = 'todo' | 'playlists' | 'canciones' | 'lanzamientos';

export default function MobileDashboard() {
  const insets = useSafeAreaInsets();
  const { play } = useNativePlayback();

  // Scroll ref
  const mainScrollRef = useRef<any>(null);

  // State
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todo');

  const [recommendations, setRecommendations] = useState<CatalogSong[]>([]);
  const [popularSongs, setPopularSongs] = useState<CatalogSong[]>([]);
  const [trendingSongs, setTrendingSongs] = useState<CatalogSong[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<PlaylistSummary[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isBannerFav, setIsBannerFav] = useState(false);

  // Load Initial Data
  const loadInitialData = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      router.replace('/iniciar-sesion');
      return;
    }
    setToken(t);

    // 1. User & Profile
    try {
      const me = await request<User>('me', undefined, t);
      setUser(me);
    } catch {
      // Ignorar fallback
    }

    try {
      const p = await request<Profile>('profile', undefined, t);
      setProfile(p);
    } catch {
      // Ignorar fallback
    }

    // 2. Favorites
    try {
      const favIds = await fetchUserFavoriteIds(base, t);
      setFavoriteIds(new Set(favIds));
    } catch {
      // Ignorar fallback
    }

    // 3. Recommendations (CU12)
    try {
      const recRes: MusicRecommendationsResponse = await fetchMusicRecommendations(base, t, 12);
      if (recRes && recRes.items && recRes.items.length > 0) {
        const mapped: CatalogSong[] = recRes.items.map((it: RecommendedTrackItem) => ({
          id: it.id,
          source: it.source,
          titulo: it.titulo,
          artista: { id: it.artista.id || '', nombre: it.artista.nombre },
          genero: it.genero,
          duracionSegundos: it.duracionSegundos,
          descripcion: 'Recomendación personalizada',
          coverUrl: it.coverUrl,
          playable: it.playable,
        }));
        setRecommendations(mapped);
      }
    } catch {
      // Fallback
    }

    // 4. Catalog Popular & Trending
    try {
      const catData = await catalogRequest<CatalogPage>(base, '?pageSize=16', t);
      if (catData && catData.items) {
        setPopularSongs(catData.items.slice(0, 8));
        setTrendingSongs(catData.items.slice(0, 3));
      }
    } catch {
      // Fallback
    }

    // 5. Releases
    try {
      const relData = await catalogRequest<any>(base, '/releases?pageSize=10', t);
      if (relData && relData.items && relData.items.length > 0) {
        setNewReleases(relData.items);
      }
    } catch {
      // Fallback
    }

    // 6. Playlists (CU09)
    try {
      const pls = await fetchUserPlaylists(base, t);
      setUserPlaylists(pls);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Toggle Favorite
  const handleToggleFavorite = async (song: CatalogSong) => {
    const isFav = favoriteIds.has(song.id);
    try {
      await toggleFavorite(base, song.id, isFav, song.source, token);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(song.id);
        else next.add(song.id);
        return next;
      });
    } catch {
      // Fallback silencioso
    }
  };

  // Play Discover Weekly
  const handlePlayDiscoverWeekly = () => {
    const queue = recommendations.length > 0 ? recommendations : popularSongs;
    if (queue.length > 0) {
      play(queue[0], queue);
    }
  };

  // Play Queue Helper
  const handlePlayQueue = (trackList: CatalogSong[]) => {
    if (trackList.length > 0) {
      play(trackList[0], trackList);
    }
  };

  // Filter selection handler
  const handleSelectFilter = (filter: FilterType) => {
    setActiveFilter(filter);
    if (mainScrollRef.current) {
      if (filter === 'todo') {
        mainScrollRef.current.scrollTo({ y: 0, animated: true });
      } else if (filter === 'canciones') {
        mainScrollRef.current.scrollTo({ y: 320, animated: true });
      } else if (filter === 'lanzamientos') {
        mainScrollRef.current.scrollTo({ y: 640, animated: true });
      } else if (filter === 'playlists') {
        mainScrollRef.current.scrollTo({ y: 880, animated: true });
      }
    }
  };

  const greetingName = profile?.displayName || user?.username || 'Addy';

  // Fallback playlists
  const topPlaylists = userPlaylists.length > 0
    ? userPlaylists.slice(0, 3).map((p) => ({
        id: p.id,
        titulo: p.nombre,
        sub: `Por Sonic Ledger • ${p.trackCount} ${p.trackCount === 1 ? 'canción' : 'canciones'}`,
        coverUrl: p.firstTrackId ? `/api/auth/catalog/${p.firstTrackId}/cover` : null,
        tracks: [] as CatalogSong[],
      }))
    : [
        {
          id: 'm-top-1',
          titulo: 'Starlit Reverie',
          sub: 'Por Sonic Ledger • 24 canciones',
          coverUrl: popularSongs[0]?.coverUrl || null,
          tracks: popularSongs,
        },
        {
          id: 'm-top-2',
          titulo: 'Midnight Confessions',
          sub: 'Por Sonic Ledger • 18 canciones',
          coverUrl: recommendations[1]?.coverUrl || popularSongs[1]?.coverUrl || null,
          tracks: recommendations.length > 0 ? recommendations : popularSongs,
        },
        {
          id: 'm-top-3',
          titulo: 'Vibes de Oficina',
          sub: 'Por Sonic Ledger • 30 canciones',
          coverUrl: popularSongs[2]?.coverUrl || null,
          tracks: popularSongs,
        },
      ];

  const mfyMix1 = recommendations.slice(0, 6);
  const mfyMix2 = popularSongs.slice(0, 6);

  // Bottom Navigation tabs: 4 options matching Image 2
  const bottomTabs = [
    { label: 'Inicio', icon: 'home' as const, route: '/inicio' },
    { label: 'Explorar', icon: 'compass' as const, route: '/explorar' },
    { label: 'Favoritos', icon: 'heart' as const, route: '/mi-musica?tab=favoritos' },
    { label: 'Perfil', icon: 'user' as const, route: '/perfil' },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {/* -----------------------------------------------------------
          A. CABECERA MÓVIL
          Logo Sonic Ledger, sonicledger., Buscar, Notificaciones, Avatar
         ----------------------------------------------------------- */}
      <View style={styles.header}>
        {/* Logo brand */}
        <View style={styles.brandGroup}>
          <LinearGradient
            colors={['#ff24e6', '#9d29ed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <View style={styles.waveBar1} />
            <View style={styles.waveBar2} />
            <View style={styles.waveBar3} />
            <View style={styles.waveBar4} />
          </LinearGradient>
          <Text style={styles.brandTitle}>
            sonic<Text style={styles.brandLight}>ledger.</Text>
          </Text>
        </View>

        {/* Action icons */}
        <View style={styles.headerTools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            onPress={() => router.push('/explorar')}
            style={styles.headerIconBtn}
          >
            <CatalogIcon name="search" size={20} color="#eadcf7" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notificaciones"
            style={styles.headerIconBtn}
          >
            <CatalogIcon name="bell" size={20} color="#eadcf7" />
            <View style={styles.notifDot} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            onPress={() => router.push('/perfil')}
            style={styles.avatarWrap}
          >
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: catalogCoverUrl(base, profile.avatarUrl) }}
                style={styles.avatarImg}
              />
            ) : (
              <LinearGradient
                colors={['#6e1596', '#ff24e6']}
                style={styles.avatarFallback}
              >
                <Text style={styles.avatarText}>
                  {greetingName.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={mainScrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
      >
        {/* -----------------------------------------------------------
            B. SALUDO
            Avatar, "Hola, [nombre]", "Tu música, tus playlists...", Ondas neón
           ----------------------------------------------------------- */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingAvatarRing}>
            {profile?.avatarUrl ? (
              <Image
                source={{ uri: catalogCoverUrl(base, profile.avatarUrl) }}
                style={styles.greetingAvatarImg}
              />
            ) : (
              <LinearGradient
                colors={['#240c3d', '#9d29ed']}
                style={styles.greetingAvatarImg}
              >
                <CatalogIcon name="user" size={22} color="#00f0ff" />
              </LinearGradient>
            )}
          </View>

          <View style={styles.greetingTextWrap}>
            <Text style={styles.greetingTitle}>Hola, {greetingName}</Text>
            <Text style={styles.greetingSubtitle}>
              Tu música, tus playlists, tus lanzamientos y más.
            </Text>
          </View>

          {/* Decorative neon ambient lines */}
          <View pointerEvents="none" style={styles.greetingWaveDecor}>
            <View style={styles.neonWaveLine1} />
            <View style={styles.neonWaveLine2} />
          </View>
        </View>

        {/* -----------------------------------------------------------
            C. FILTROS SUPERIORES
            Todo, Playlists, Canciones, Lanzamientos
           ----------------------------------------------------------- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}
        >
          {/* Pill Todo */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtro Todo"
            onPress={() => handleSelectFilter('todo')}
            style={[styles.filterPill, activeFilter === 'todo' && styles.filterPillActive]}
          >
            {activeFilter === 'todo' ? (
              <LinearGradient
                colors={['#ff24e6', '#9d29ed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text style={[styles.filterPillText, activeFilter === 'todo' && styles.filterPillTextActive]}>
              Todo
            </Text>
          </Pressable>

          {/* Pill Playlists */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtro Playlists"
            onPress={() => handleSelectFilter('playlists')}
            style={[styles.filterPill, activeFilter === 'playlists' && styles.filterPillActive]}
          >
            {activeFilter === 'playlists' ? (
              <LinearGradient
                colors={['#ff24e6', '#9d29ed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <CatalogIcon
              name="music"
              size={14}
              color={activeFilter === 'playlists' ? '#ffffff' : '#bfa9d6'}
            />
            <Text style={[styles.filterPillText, activeFilter === 'playlists' && styles.filterPillTextActive]}>
              Playlists
            </Text>
          </Pressable>

          {/* Pill Canciones */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtro Canciones"
            onPress={() => handleSelectFilter('canciones')}
            style={[styles.filterPill, activeFilter === 'canciones' && styles.filterPillActive]}
          >
            {activeFilter === 'canciones' ? (
              <LinearGradient
                colors={['#ff24e6', '#9d29ed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <CatalogIcon
              name="music"
              size={14}
              color={activeFilter === 'canciones' ? '#ffffff' : '#bfa9d6'}
            />
            <Text style={[styles.filterPillText, activeFilter === 'canciones' && styles.filterPillTextActive]}>
              Canciones
            </Text>
          </Pressable>

          {/* Pill Lanzamientos */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filtro Lanzamientos"
            onPress={() => handleSelectFilter('lanzamientos')}
            style={[styles.filterPill, activeFilter === 'lanzamientos' && styles.filterPillActive]}
          >
            {activeFilter === 'lanzamientos' ? (
              <LinearGradient
                colors={['#ff24e6', '#9d29ed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <CatalogIcon
              name="compass"
              size={14}
              color={activeFilter === 'lanzamientos' ? '#ffffff' : '#bfa9d6'}
            />
            <Text style={[styles.filterPillText, activeFilter === 'lanzamientos' && styles.filterPillTextActive]}>
              Lanzamientos
            </Text>
          </Pressable>
        </ScrollView>

        {/* -----------------------------------------------------------
            D. BANNER DISCOVER WEEKLY
            Texto superior, Título, Subtítulo, Botones, Chica audífonos, Dots
           ----------------------------------------------------------- */}
        <View style={styles.bannerWrap}>
          <LinearGradient
            colors={['#270b42', '#350d48', '#14082c', '#0c112e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bannerGradient}
          >
            <View style={styles.bannerLeftContent}>
              <Text style={styles.bannerTag}>TU MIX PERSONALIZADO</Text>
              <Text style={styles.bannerTitle}>Discover Weekly</Text>
              <Text style={styles.bannerSub}>Tu weekly mix</Text>

              <View style={styles.bannerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reproducir ahora"
                  onPress={handlePlayDiscoverWeekly}
                  style={styles.bannerPlayBtn}
                >
                  <LinearGradient
                    colors={['#ff24e6', '#9d29ed', '#16b9ff']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bannerPlayGradient}
                  >
                    <CatalogIcon name="play" size={13} color="#ffffff" />
                    <Text style={styles.bannerPlayText}>Reproducir ahora</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Favorito Discover Weekly"
                  onPress={() => setIsBannerFav((p) => !p)}
                  style={styles.bannerFavBtn}
                >
                  <CatalogIcon
                    name="heart"
                    size={17}
                    color={isBannerFav ? '#ff24e6' : '#ffffff'}
                  />
                </Pressable>
              </View>
            </View>

            {/* Futuristic Girl Artwork */}
            <View pointerEvents="none" style={styles.bannerArtWrap}>
              <Image
                source={require('../../assets/discover-weekly-girl.png')}
                style={styles.bannerArtImg}
                resizeMode="contain"
              />
            </View>

            {/* Carousel dots */}
            <View style={styles.bannerDotsWrap}>
              <View style={[styles.bannerDot, styles.bannerDotActive]} />
              <View style={styles.bannerDot} />
              <View style={styles.bannerDot} />
            </View>
          </LinearGradient>
        </View>

        {/* -----------------------------------------------------------
            E. SECCIONES MÓVILES EN ORDEN EXACTO
            1. Popular
            2. Hot & Trending 🔥
            3. Nuevos lanzamientos
            4. Made for You
            5. Top daily playlists
            (RECOMENDADO PARA TI: COMPLETAMENTE ELIMINADO)
           ----------------------------------------------------------- */}

        {/* 1. POPULAR */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todo Popular"
              onPress={() => router.push('/explorar')}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Text style={styles.seeAllArrow}>›</Text>
            </Pressable>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={popularSongs}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => {
              const cover = catalogCoverUrl(base, item.coverUrl);
              const isFav = favoriteIds.has(item.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reproducir ${item.titulo}`}
                  onPress={() => play(item, popularSongs)}
                  style={styles.popularCard}
                >
                  <View style={styles.popularCoverBox}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.popularCoverImg} />
                    ) : (
                      <LinearGradient
                        colors={['#240e3b', '#110620']}
                        style={styles.coverFallback}
                      >
                        <CatalogIcon name="music" size={24} color="#7c6396" />
                      </LinearGradient>
                    )}
                  </View>

                  <Text numberOfLines={1} style={styles.popularCardTitle}>
                    {item.titulo}
                  </Text>

                  <View style={styles.popularArtistRow}>
                    <Text numberOfLines={1} style={styles.popularCardArtist}>
                      {item.artista?.nombre || 'Artista'}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Favorito"
                      onPress={(e) => {
                        e.stopPropagation();
                        void handleToggleFavorite(item);
                      }}
                      hitSlop={6}
                    >
                      <CatalogIcon
                        name="heart"
                        size={12}
                        color={isFav ? '#ff24e6' : '#8d7c9f'}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        {/* 2. HOT & TRENDING 🔥 */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hot & Trending 🔥</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todo Hot & Trending"
              onPress={() => router.push('/explorar')}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Text style={styles.seeAllArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.listCardBox}>
            {trendingSongs.slice(0, 3).map((item, idx) => {
              const cover = catalogCoverUrl(base, item.coverUrl);
              return (
                <Pressable
                  key={item.id || idx}
                  accessibilityRole="button"
                  accessibilityLabel={`Reproducir ${item.titulo}`}
                  onPress={() => play(item, trendingSongs)}
                  style={[styles.listRow, idx < 2 && styles.listRowBorder]}
                >
                  <View style={styles.listThumbBox}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.listThumbImg} />
                    ) : (
                      <View style={styles.coverFallback}>
                        <CatalogIcon name="music" size={16} color="#7c6396" />
                      </View>
                    )}
                  </View>

                  <View style={styles.listMeta}>
                    <Text numberOfLines={1} style={styles.listTitle}>
                      {item.titulo}
                    </Text>
                    <Text numberOfLines={1} style={styles.listSubtitle}>
                      {item.duracionSegundos
                        ? `${catalogDuration(item.duracionSegundos)} • ${item.artista?.nombre}`
                        : item.artista?.nombre || 'Tendencia'}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${item.titulo}`}
                    onPress={() => play(item, trendingSongs)}
                    style={styles.circlePlayBtn}
                  >
                    <LinearGradient
                      colors={['#9d29ed', '#ff24e6']}
                      style={styles.circlePlayGradient}
                    >
                      <CatalogIcon name="play" size={12} color="#ffffff" />
                    </LinearGradient>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 3. NUEVOS LANZAMIENTOS */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nuevos lanzamientos</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todo Nuevos lanzamientos"
              onPress={() => router.push('/lanzamientos' as any)}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Text style={styles.seeAllArrow}>›</Text>
            </Pressable>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={newReleases.length > 0 ? newReleases : popularSongs.slice(2, 6)}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => {
              const cover = catalogCoverUrl(base, item.coverUrl);
              const title = item.titulo;
              const artist = item.artista?.nombre || 'Artista';
              const tracksToPlay =
                item.canciones && item.canciones.length > 0
                  ? item.canciones
                  : popularSongs;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Reproducir lanzamiento ${title}`}
                  onPress={() => handlePlayQueue(tracksToPlay)}
                  style={styles.releaseCard}
                >
                  <View style={styles.releaseCoverBox}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.popularCoverImg} />
                    ) : (
                      <LinearGradient
                        colors={['#1c0b31', '#0e0419']}
                        style={styles.coverFallback}
                      >
                        <CatalogIcon name="layers" size={24} color="#7c6396" />
                      </LinearGradient>
                    )}
                    {/* Dark gradient overlay on bottom of card */}
                    <LinearGradient
                      colors={['transparent', 'rgba(12, 6, 22, 0.95)']}
                      style={styles.releaseOverlay}
                    />

                    <View style={styles.releaseContentOverlay}>
                      <View style={styles.releaseTextWrap}>
                        <Text numberOfLines={1} style={styles.releaseTitle}>
                          {title}
                        </Text>
                        <Text numberOfLines={1} style={styles.releaseArtist}>
                          {artist}
                        </Text>
                      </View>

                      <View style={styles.releasePlayCircle}>
                        <CatalogIcon name="play" size={11} color="#ffffff" />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        </View>

        {/* 4. MADE FOR YOU */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Made for You</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {/* Card 1: Long Ride */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reproducir Long Ride"
              onPress={() => handlePlayQueue(mfyMix1.length > 0 ? mfyMix1 : popularSongs)}
              style={styles.mfyCard}
            >
              {mfyMix1[0]?.coverUrl ? (
                <Image
                  source={{ uri: catalogCoverUrl(base, mfyMix1[0].coverUrl) }}
                  style={styles.mfyBgImg}
                />
              ) : (
                <LinearGradient
                  colors={['#19082a', '#4a1154']}
                  style={styles.mfyBgImg}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(10, 5, 20, 0.95)']}
                style={styles.mfyOverlay}
              />
              <View style={styles.mfyBottomContent}>
                <View style={styles.mfyTextWrap}>
                  <Text numberOfLines={1} style={styles.mfyTitle}>
                    Long Ride
                  </Text>
                  <Text numberOfLines={1} style={styles.mfySub}>
                    Música para tus viajes
                  </Text>
                </View>
                <View style={styles.mfyPlayBtn}>
                  <CatalogIcon name="play" size={12} color="#ffffff" />
                </View>
              </View>
            </Pressable>

            {/* Card 2: Love */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reproducir Love"
              onPress={() => handlePlayQueue(mfyMix2.length > 0 ? mfyMix2 : popularSongs)}
              style={styles.mfyCard}
            >
              {mfyMix2[1]?.coverUrl ? (
                <Image
                  source={{ uri: catalogCoverUrl(base, mfyMix2[1].coverUrl) }}
                  style={styles.mfyBgImg}
                />
              ) : (
                <LinearGradient
                  colors={['#3e0836', '#1a0422']}
                  style={styles.mfyBgImg}
                />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(10, 5, 20, 0.95)']}
                style={styles.mfyOverlay}
              />
              <View style={styles.mfyBottomContent}>
                <View style={styles.mfyTextWrap}>
                  <Text numberOfLines={1} style={styles.mfyTitle}>
                    Love
                  </Text>
                  <Text numberOfLines={1} style={styles.mfySub}>
                    Tus canciones románticas
                  </Text>
                </View>
                <View style={styles.mfyPlayBtn}>
                  <CatalogIcon name="play" size={12} color="#ffffff" />
                </View>
              </View>
            </Pressable>
          </ScrollView>
        </View>

        {/* 5. TOP DAILY PLAYLISTS */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top daily playlists</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver todo Top daily playlists"
              onPress={() => router.push('/mi-musica' as any)}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>Ver todo</Text>
              <Text style={styles.seeAllArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.listCardBox}>
            {topPlaylists.map((pl, idx) => {
              const cover = catalogCoverUrl(base, pl.coverUrl);
              return (
                <Pressable
                  key={pl.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Reproducir playlist ${pl.titulo}`}
                  onPress={() => handlePlayQueue(pl.tracks)}
                  style={[styles.listRow, idx < topPlaylists.length - 1 && styles.listRowBorder]}
                >
                  <View style={styles.listThumbBox}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.listThumbImg} />
                    ) : (
                      <View style={styles.coverFallback}>
                        <CatalogIcon name="music" size={16} color="#7c6396" />
                      </View>
                    )}
                  </View>

                  <View style={styles.listMeta}>
                    <Text numberOfLines={1} style={styles.listTitle}>
                      {pl.titulo}
                    </Text>
                    <Text numberOfLines={1} style={styles.listSubtitle}>
                      {pl.sub}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Play ${pl.titulo}`}
                    onPress={() => handlePlayQueue(pl.tracks)}
                    style={styles.circlePlayBtn}
                  >
                    <LinearGradient
                      colors={['#9d29ed', '#ff24e6']}
                      style={styles.circlePlayGradient}
                    >
                      <CatalogIcon name="play" size={12} color="#ffffff" />
                    </LinearGradient>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* RECOMENDADO PARA TI: COMPLETAMENTE ELIMINADO */}
      </ScrollView>

      {/* -----------------------------------------------------------
          K. NAVEGACIÓN INFERIOR (4 OPCIONES)
          Inicio, Explorar, Favoritos, Perfil
          Inicio activo con degradado magenta/violeta
         ----------------------------------------------------------- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {bottomTabs.map((tab) => {
          const isSelected = tab.label === 'Inicio';
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                if (tab.route === '/inicio') {
                  mainScrollRef.current?.scrollTo({ y: 0, animated: true });
                } else {
                  router.push(tab.route as any);
                }
              }}
              style={styles.bottomTabItem}
            >
              {isSelected ? (
                <View style={styles.bottomActivePillWrap}>
                  <LinearGradient
                    colors={['#ff24e6', '#9d29ed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.bottomActivePill}
                  >
                    <CatalogIcon name={tab.icon} size={18} color="#ffffff" />
                    <Text style={styles.bottomActiveText}>{tab.label}</Text>
                  </LinearGradient>
                </View>
              ) : (
                <View style={styles.bottomInactiveTab}>
                  <CatalogIcon name={tab.icon} size={18} color="#bfa9d6" />
                  <Text style={styles.bottomInactiveText}>{tab.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#080511',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  waveBar1: { width: 2, height: 8, backgroundColor: '#ffffff', borderRadius: 1 },
  waveBar2: { width: 2, height: 16, backgroundColor: '#ffffff', borderRadius: 1 },
  waveBar3: { width: 2, height: 12, backgroundColor: '#ffffff', borderRadius: 1 },
  waveBar4: { width: 2, height: 6, backgroundColor: '#ffffff', borderRadius: 1 },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  brandLight: {
    fontWeight: '300',
    color: '#d0c2e0',
  },
  headerTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(25, 14, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff24e6',
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ff24e6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  /* GREETING */
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  greetingAvatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.8,
    borderColor: '#00f0ff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  greetingAvatarImg: {
    width: '100%',
    height: '100%',
  },
  greetingTextWrap: {
    flex: 1,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  greetingSubtitle: {
    fontSize: 12,
    color: '#baaec9',
  },
  greetingWaveDecor: {
    position: 'absolute',
    right: 0,
    width: 90,
    height: 36,
    justifyContent: 'center',
    opacity: 0.65,
  },
  neonWaveLine1: {
    height: 1.5,
    width: '100%',
    backgroundColor: '#ff24e6',
    borderRadius: 1,
    marginBottom: 6,
    transform: [{ rotate: '-8deg' }],
  },
  neonWaveLine2: {
    height: 1.5,
    width: '80%',
    backgroundColor: '#00f0ff',
    borderRadius: 1,
    transform: [{ rotate: '6deg' }],
  },

  /* FILTER PILLS */
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    paddingRight: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(25, 14, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.35)',
    overflow: 'hidden',
  },
  filterPillActive: {
    borderWidth: 0,
  },
  filterPillText: {
    fontSize: 12.5,
    color: '#baaec9',
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },

  /* BANNER DISCOVER WEEKLY */
  bannerWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(182, 61, 255, 0.45)',
    marginBottom: 22,
  },
  bannerGradient: {
    minHeight: 165,
    paddingHorizontal: 18,
    paddingVertical: 18,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeftContent: {
    flex: 1,
    zIndex: 2,
    maxWidth: '65%',
  },
  bannerTag: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#cca4f5',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  bannerSub: {
    fontSize: 12,
    color: '#d0c2e0',
    marginBottom: 14,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerPlayBtn: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  bannerPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  bannerPlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  bannerFavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerArtWrap: {
    position: 'absolute',
    right: -10,
    top: 0,
    bottom: 0,
    width: '45%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  bannerArtImg: {
    width: '100%',
    height: '100%',
  },
  bannerDotsWrap: {
    position: 'absolute',
    right: 14,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 3,
  },
  bannerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  bannerDotActive: {
    width: 14,
    backgroundColor: '#ffffff',
  },

  /* SECTION WRAPPERS */
  sectionWrap: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  seeAllText: {
    fontSize: 12,
    color: '#baaec9',
    fontWeight: '500',
  },
  seeAllArrow: {
    fontSize: 14,
    color: '#baaec9',
    fontWeight: '700',
  },

  /* HORIZONTAL LIST */
  horizontalList: {
    gap: 12,
    paddingRight: 16,
  },

  /* POPULAR CARD */
  popularCard: {
    width: 110,
  },
  popularCoverBox: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#160d24',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.25)',
    marginBottom: 6,
  },
  popularCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a0d2a',
  },
  popularCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 1,
  },
  popularArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularCardArtist: {
    fontSize: 10.5,
    color: '#9f91b3',
    flex: 1,
    marginRight: 4,
  },

  /* LIST BOX (Hot & Trending, Top daily playlists) */
  listCardBox: {
    backgroundColor: 'rgba(22, 14, 38, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.35)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(140, 80, 185, 0.25)',
  },
  listThumbBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1b1029',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.25)',
  },
  listThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  listMeta: {
    flex: 1,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  listSubtitle: {
    fontSize: 11,
    color: '#9f91b3',
  },
  circlePlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
  },
  circlePlayGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* NUEVOS LANZAMIENTOS */
  releaseCard: {
    width: 140,
  },
  releaseCoverBox: {
    width: 140,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#190d26',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.25)',
    position: 'relative',
  },
  releaseOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  releaseContentOverlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  releaseTextWrap: {
    flex: 1,
    marginRight: 6,
  },
  releaseTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 1,
  },
  releaseArtist: {
    fontSize: 10,
    color: '#d0c2e0',
  },
  releasePlayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 36, 230, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* MADE FOR YOU */
  mfyCard: {
    width: 165,
    height: 155,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(140, 80, 185, 0.35)',
    position: 'relative',
    justifyContent: 'flex-end',
    padding: 10,
  },
  mfyBgImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mfyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mfyBottomContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  mfyTextWrap: {
    flex: 1,
    marginRight: 6,
  },
  mfyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 1,
  },
  mfySub: {
    fontSize: 10.5,
    color: '#cfc2df',
  },
  mfyPlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#b818c8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* BOTTOM NAVIGATION BAR */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0c0717f2',
    borderTopWidth: 1,
    borderTopColor: 'rgba(140, 80, 185, 0.35)',
    paddingTop: 8,
    zIndex: 10,
  },
  bottomTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bottomActivePillWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  bottomActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  bottomActiveText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomInactiveTab: {
    alignItems: 'center',
    gap: 2,
  },
  bottomInactiveText: {
    fontSize: 10.5,
    color: '#bfa9d6',
    fontWeight: '500',
  },
});
