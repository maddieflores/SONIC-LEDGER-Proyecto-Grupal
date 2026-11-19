import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Brand } from '../../components/Neon';
import { getToken } from '../../services/session';
import {
  fetchPublicConcerts,
  fetchRecommendedConcerts,
} from '../../../../shared/concerts-api';
import type {
  PublicConcertSummary,
  ConcertEstadoVenta,
  RecommendedConcertItem,
} from '../../../../shared/concerts';

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const BOLIVIA_CITIES = [
  'Todas',
  'La Paz',
  'Santa Cruz',
  'Cochabamba',
  'Tarija',
  'Sucre',
  'Oruro',
  'Potosí',
  'Beni',
  'Pando',
];

export default function ConcertsScreen() {
  const { width } = useWindowDimensions();
  const [token, setToken] = useState<string | null>(null);

  // Data
  const [featuredConcerts, setFeaturedConcerts] = useState<PublicConcertSummary[]>([]);
  const [concerts, setConcerts] = useState<PublicConcertSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('Todas');

  // CU19: Recomendaciones personalizadas
  const [recommendedConcerts, setRecommendedConcerts] = useState<RecommendedConcertItem[]>([]);
  const [isPersonalized, setIsPersonalized] = useState(false);

  useEffect(() => {
    let active = true;
    void getToken().then((val) => {
      if (active && val) setToken(val);
    });
    return () => {
      active = false;
    };
  }, []);

  // CU19: Cargar recomendaciones personalizadas si hay token
  useEffect(() => {
    let active = true;
    if (token) {
      void (async () => {
        try {
          const res = await fetchRecommendedConcerts(token, { limit: 6 }, BASE_API);
          if (active) {
            setRecommendedConcerts(res.items);
            setIsPersonalized(res.esPersonalizada);
          }
        } catch (e: any) {
          console.warn('Error loading recommended concerts:', e);
        }
      })();
    } else {
      setRecommendedConcerts([]);
      setIsPersonalized(false);
    }
    return () => {
      active = false;
    };
  }, [token]);

  // Cargar destacados
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetchPublicConcerts({ destacados: true, limit: 8 }, BASE_API);
        if (active) {
          if (res.items.length > 0) {
            setFeaturedConcerts(res.items);
          } else {
            const upcoming = await fetchPublicConcerts({ sort: 'fecha_asc', limit: 8 }, BASE_API);
            if (active) setFeaturedConcerts(upcoming.items);
          }
        }
      } catch (e: any) {
        console.warn('Error loading featured concerts:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cargar catálogo completo
  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchPublicConcerts(
          {
            q: searchQuery.trim() || undefined,
            ciudad: selectedCity !== 'Todas' ? selectedCity : undefined,
            sort: 'fecha_asc',
            limit: 20,
          },
          BASE_API,
        );
        if (active) {
          setConcerts(res.items);
          setError('');
        }
      } catch (e: any) {
        if (active) setError(e.message || 'Error al cargar los conciertos.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [searchQuery, selectedCity]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (status: ConcertEstadoVenta) => {
    switch (status) {
      case 'VENTA_INICIADA':
        return { label: 'Venta disponible', color: '#22c55e' };
      case 'VENTA_PENDIENTE':
        return { label: 'Próximamente', color: '#eab308' };
      case 'VENTA_CERRADA':
        return { label: 'Venta cerrada', color: '#94a3b8' };
      default:
        return { label: '', color: 'transparent' };
    }
  };

  const carouselCardWidth = Math.min(width * 0.78, 300);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Superior */}
        <View style={styles.headerRow}>
          <Brand />
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/explorar')}
              style={styles.navButton}
            >
              <Text style={styles.navButtonText}>Música</Text>
            </Pressable>
            {token ? (
              <Pressable
                onPress={() => router.push('/inicio')}
                style={styles.profileButton}
              >
                <Text style={styles.profileButtonText}>Mi cuenta</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/iniciar-sesion')}
                style={styles.loginButton}
              >
                <Text style={styles.loginButtonText}>Ingresar</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Título Principal */}
        <View style={styles.titleSection}>
          <Text style={styles.subBadge}>MÚSICA EN VIVO</Text>
          <Text style={styles.mainTitle}>Próximos Conciertos</Text>
          <Text style={styles.mainDesc}>
            Encuentra escenarios, fechas y precios de entradas oficiales en Bolivia.
          </Text>
        </View>

        {/* AJUSTE VISUAL CU18: Carrusel horizontal de conciertos destacados */}
        {featuredConcerts.length > 0 && (
          <View style={styles.carouselSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Eventos Destacados</Text>
              <Text style={styles.sectionSubtitle}>Desliza para explorar</Text>
            </View>

            <FlatList
              horizontal
              data={featuredConcerts}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselList}
              snapToInterval={carouselCardWidth + 16}
              decelerationRate="fast"
              renderItem={({ item }) => {
                const coverUri = item.portadaUrl
                  ? item.portadaUrl.startsWith('http')
                    ? item.portadaUrl
                    : `${BASE_API.replace(/\/api$/, '')}${item.portadaUrl}`
                  : null;

                return (
                  <Pressable
                    style={[styles.carouselCard, { width: carouselCardWidth }]}
                    onPress={() =>
                      router.push({
                        pathname: '/conciertos/[id]' as any,
                        params: { id: item.id },
                      })
                    }
                  >
                    <View style={styles.carouselCardCover}>
                      {coverUri ? (
                        <Image source={{ uri: coverUri }} style={styles.coverImage} />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <Text style={styles.placeholderText}>CONCIERTO</Text>
                        </View>
                      )}
                      <LinearGradient
                        colors={['transparent', 'rgba(18, 12, 36, 0.95)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.cityBadge}>
                        <Text style={styles.cityBadgeText}>{item.ciudad}</Text>
                      </View>
                    </View>

                    <View style={styles.carouselCardBody}>
                      <Text style={styles.carouselDate}>
                        {formatDate(item.fechaInicio)}
                      </Text>
                      <Text style={styles.carouselTitle} numberOfLines={2}>
                        {item.titulo}
                      </Text>
                      <Text style={styles.carouselVenue} numberOfLines={1}>
                        {item.recinto}
                      </Text>

                      <View style={styles.carouselFooter}>
                        <View>
                          <Text style={styles.priceLabel}>Desde</Text>
                          <Text style={styles.priceValue}>
                            {item.precioMinimo !== null
                              ? `Bs. ${item.precioMinimo}`
                              : 'Por definir'}
                          </Text>
                        </View>
                        <View style={styles.actionPill}>
                          <Text style={styles.actionPillText}>Ver concierto</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* CU19: Conciertos para ti (Recomendaciones Personalizadas o Próximos) */}
        {token && recommendedConcerts.length > 0 && (
          <View style={styles.carouselSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {isPersonalized ? 'Conciertos para ti ✨' : 'Descubre Conciertos'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {isPersonalized ? 'Según tus gustos' : 'Próximos eventos'}
              </Text>
            </View>

            <FlatList
              horizontal
              data={recommendedConcerts}
              keyExtractor={(item) => `rec-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselList}
              snapToInterval={carouselCardWidth + 16}
              decelerationRate="fast"
              renderItem={({ item }) => {
                const coverUri = item.portadaUrl
                  ? item.portadaUrl.startsWith('http')
                    ? item.portadaUrl
                    : `${BASE_API.replace(/\/api$/, '')}${item.portadaUrl}`
                  : null;

                return (
                  <Pressable
                    style={[styles.carouselCard, { width: carouselCardWidth }]}
                    onPress={() =>
                      router.push({
                        pathname: '/conciertos/[id]' as any,
                        params: { id: item.id },
                      })
                    }
                  >
                    <View style={styles.carouselCardCover}>
                      {coverUri ? (
                        <Image source={{ uri: coverUri }} style={styles.coverImage} />
                      ) : (
                        <View style={styles.coverPlaceholder}>
                          <Text style={styles.placeholderText}>SONIC</Text>
                        </View>
                      )}

                      {/* Motivo de recomendación */}
                      {item.motivosRecomendacion && item.motivosRecomendacion.length > 0 && (
                        <View style={styles.reasonBadge}>
                          <Text style={styles.reasonBadgeText} numberOfLines={1}>
                            ✨ {item.motivosRecomendacion[0]}
                          </Text>
                        </View>
                      )}

                      <View style={styles.cityBadge}>
                        <Text style={styles.cityBadgeText}>{item.ciudad}</Text>
                      </View>
                    </View>

                    <View style={styles.carouselCardBody}>
                      <Text style={styles.carouselDate}>{formatDate(item.fechaInicio)}</Text>
                      <Text style={styles.carouselTitle} numberOfLines={2}>
                        {item.titulo}
                      </Text>

                      {item.artistas && item.artistas.length > 0 && (
                        <Text style={styles.carouselArtists} numberOfLines={1}>
                          {item.artistas.map((a) => a.nombreArtista).join(', ')}
                        </Text>
                      )}

                      <Text style={styles.carouselVenue} numberOfLines={1}>
                        📍 {item.recinto}
                      </Text>

                      <View style={styles.carouselFooter}>
                        <View>
                          <Text style={styles.priceLabel}>Desde</Text>
                          <Text style={styles.priceValue}>
                            {item.precioMinimo !== null
                              ? `Bs. ${item.precioMinimo}`
                              : 'Por definir'}
                          </Text>
                        </View>
                        <View style={styles.actionPill}>
                          <Text style={styles.actionPillText}>Ver concierto</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Buscador y Filtros */}
        <View style={styles.filtersSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por concierto, artista, recinto..."
            placeholderTextColor="#867499"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityChipsList}
          >
            {BOLIVIA_CITIES.map((c) => {
              const active = selectedCity === c;
              return (
                <Pressable
                  key={c}
                  style={[styles.cityChip, active && styles.cityChipActive]}
                  onPress={() => setSelectedCity(c)}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                      active && styles.cityChipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Listado Vertical de Conciertos */}
        <View style={styles.catalogSection}>
          <Text style={styles.sectionTitle}>
            Cartelera de Conciertos {selectedCity !== 'Todas' ? `en ${selectedCity}` : ''}
          </Text>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#a855f7"
              style={{ marginVertical: 36 }}
            />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : concerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No hay conciertos programados</Text>
              <Text style={styles.emptyDesc}>
                No se encontraron eventos para los filtros seleccionados.
              </Text>
            </View>
          ) : (
            concerts.map((c) => {
              const statusInfo = getStatusLabel(c.estadoVenta);
              const coverUri = c.portadaUrl
                ? c.portadaUrl.startsWith('http')
                  ? c.portadaUrl
                  : `${BASE_API.replace(/\/api$/, '')}${c.portadaUrl}`
                : null;

              return (
                <Pressable
                  key={c.id}
                  style={styles.concertListItem}
                  onPress={() =>
                    router.push({
                      pathname: '/conciertos/[id]' as any,
                      params: { id: c.id },
                    })
                  }
                >
                  <View style={styles.listCover}>
                    {coverUri ? (
                      <Image source={{ uri: coverUri }} style={styles.coverImage} />
                    ) : (
                      <View style={styles.coverPlaceholder}>
                        <Text style={styles.placeholderSmallText}>LIVE</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.listBody}>
                    <View style={styles.listHeaderRow}>
                      <Text style={styles.listDate}>
                        {formatDate(c.fechaInicio)}
                      </Text>
                      {statusInfo.label ? (
                        <View
                          style={[
                            styles.statusTag,
                            { backgroundColor: statusInfo.color + '22' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusTagText,
                              { color: statusInfo.color },
                            ]}
                          >
                            {statusInfo.label}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.listTitle} numberOfLines={2}>
                      {c.titulo}
                    </Text>

                    <Text style={styles.listLocation} numberOfLines={1}>
                      {c.recinto} • {c.ciudad}
                    </Text>

                    <View style={styles.listFooter}>
                      <Text style={styles.listPrice}>
                        {c.precioMinimo !== null
                          ? `Desde Bs. ${c.precioMinimo}`
                          : 'Entradas por definir'}
                      </Text>
                      <Text style={styles.detailsLink}>Detalles →</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070713',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.15)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  navButtonText: {
    color: '#cdbedb',
    fontSize: 13,
    fontWeight: '600',
  },
  loginButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#a855f7',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  profileButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  profileButtonText: {
    color: '#f472b6',
    fontSize: 13,
    fontWeight: '600',
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  subBadge: {
    color: '#f472b6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  mainTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  mainDesc: {
    color: '#a797be',
    fontSize: 14,
    lineHeight: 20,
  },
  /* Carousel */
  carouselSection: {
    marginTop: 12,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#867499',
    fontSize: 12,
  },
  carouselList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  carouselCard: {
    backgroundColor: '#120c24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    overflow: 'hidden',
  },
  carouselCardCover: {
    width: '100%',
    height: 140,
    backgroundColor: '#1b1233',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#170f2b',
  },
  placeholderText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  placeholderSmallText: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '800',
  },
  cityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(8, 5, 17, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cityBadgeText: {
    color: '#cdbedb',
    fontSize: 11,
    fontWeight: '600',
  },
  reasonBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 80,
    backgroundColor: 'rgba(18, 12, 36, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  reasonBadgeText: {
    color: '#f1ecf7',
    fontSize: 10,
    fontWeight: '700',
  },
  carouselCardBody: {
    padding: 14,
  },
  carouselDate: {
    color: '#f472b6',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  carouselTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4,
  },
  carouselArtists: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  carouselVenue: {
    color: '#a797be',
    fontSize: 12,
    marginBottom: 12,
  },
  carouselFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.15)',
    paddingTop: 10,
  },
  priceLabel: {
    color: '#867499',
    fontSize: 10,
  },
  priceValue: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  actionPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  actionPillText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },
  /* Filters */
  filtersSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#120c24',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 12,
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  cityChipsList: {
    gap: 8,
    paddingVertical: 4,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#120c24',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  cityChipActive: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  cityChipText: {
    color: '#cdbedb',
    fontSize: 13,
    fontWeight: '500',
  },
  cityChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  /* Catalog List */
  catalogSection: {
    paddingHorizontal: 20,
  },
  concertListItem: {
    backgroundColor: '#120c24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 12,
  },
  listCover: {
    width: 100,
    backgroundColor: '#1b1233',
  },
  listBody: {
    flex: 1,
    padding: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listDate: {
    color: '#f472b6',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  listTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  listLocation: {
    color: '#a797be',
    fontSize: 12,
    marginBottom: 8,
  },
  listFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listPrice: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsLink: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#867499',
    fontSize: 13,
    textAlign: 'center',
  },
  errorText: {
    color: '#f87171',
    marginVertical: 12,
  },
});
