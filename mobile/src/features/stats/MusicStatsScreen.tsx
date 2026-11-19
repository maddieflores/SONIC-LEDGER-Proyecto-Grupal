import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { fetchMusicalStats } from '../../../../shared/history-api';
import type { MusicalStatsResponse, StatsPeriodo } from '../../../../shared/history';
import { getToken } from '../../services/session';

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function MusicStatsScreen() {
  const [periodo, setPeriodo] = useState<StatsPeriodo>('30d');
  const [stats, setStats] = useState<MusicalStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async (p: StatsPeriodo) => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        router.replace('/iniciar-sesion');
        return;
      }
      const data = await fetchMusicalStats(p, token, BASE_API);
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar estadísticas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats(periodo);
  }, [periodo]);

  const maxDailyPlays =
    stats && stats.actividadDiaria.length > 0
      ? Math.max(1, ...stats.actividadDiaria.map((d) => d.reproducciones))
      : 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Superior */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.backBtnText}>← Volver</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Mis Estadísticas</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Título y Period Selector */}
        <View style={styles.titleSection}>
          <Text style={styles.subBadge}>MÉTRICAS PERSONALES (CU23)</Text>
          <Text style={styles.mainTitle}>Actividad Sonora</Text>
          <Text style={styles.mainDesc}>
            Resumen de tu tiempo de escucha, géneros más frecuentes y rankings.
          </Text>

          <View style={styles.periodRow}>
            {(
              [
                ['7d', '7 Días'],
                ['30d', '30 Días'],
                ['all', 'Todo el tiempo'],
              ] as const
            ).map(([key, label]) => {
              const active = periodo === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.periodPill, active && styles.periodPillActive]}
                  onPress={() => setPeriodo(key)}
                >
                  <Text
                    style={[
                      styles.periodPillText,
                      active && styles.periodPillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>Calculando métricas musicales...</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void loadStats(periodo)}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty State */}
        {!loading && !error && stats && stats.totalReproduccionesValidas === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🎧</Text>
            <Text style={styles.emptyTitle}>Sin reproducciones en este periodo</Text>
            <Text style={styles.emptyDesc}>
              {stats.mensaje ||
                'No registraste escuchas válidas de más de 30 segundos. ¡Explora el catálogo y dale play a tus pistas favoritas!'}
            </Text>
            <Pressable
              style={styles.exploreBtn}
              onPress={() => router.push('/explorar')}
            >
              <Text style={styles.exploreBtnText}>Explorar Música</Text>
            </Pressable>
          </View>
        )}

        {/* Con Datos */}
        {!loading && !error && stats && stats.totalReproduccionesValidas > 0 && (
          <>
            {/* KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>TIEMPO ESCUCHADO</Text>
                <Text style={[styles.kpiValue, { color: '#38bdf8' }]}>
                  {stats.horasEscuchadas >= 1
                    ? `${stats.horasEscuchadas} h`
                    : `${stats.minutosEscuchados} m`}
                </Text>
                <Text style={styles.kpiSub}>
                  {stats.minutosEscuchados} minutos efectivos
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>REPRODUCCIONES</Text>
                <Text style={[styles.kpiValue, { color: '#4ade80' }]}>
                  {stats.totalReproduccionesValidas}
                </Text>
                <Text style={styles.kpiSub}>Escuchas válidas (≥ 30s)</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>CANCIONES ÚNICAS</Text>
                <Text style={[styles.kpiValue, { color: '#ec4899' }]}>
                  {stats.cancionesUnicas}
                </Text>
                <Text style={styles.kpiSub}>Pistas distintas</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>ARTISTAS ÚNICOS</Text>
                <Text style={[styles.kpiValue, { color: '#c084fc' }]}>
                  {stats.artistasUnicos}
                </Text>
                <Text style={styles.kpiSub}>Creadores escuchados</Text>
              </View>

              <View style={[styles.kpiCard, { width: '100%' }]}>
                <Text style={styles.kpiLabel}>GÉNERO PREDILECTO</Text>
                <Text style={[styles.kpiValue, { color: '#fef08a', fontSize: 22 }]}>
                  {stats.generoMasEscuchado || 'Varios'}
                </Text>
                <Text style={styles.kpiSub}>Mayor porcentaje de escuchas</Text>
              </View>
            </View>

            {/* Top 5 Canciones */}
            <View style={styles.sectionPanel}>
              <Text style={styles.panelTitle}>🏆 Top 5 Canciones</Text>
              <View style={styles.rankingList}>
                {stats.topCanciones.map((cancion, idx) => {
                  const coverUri = cancion.coverUrl
                    ? cancion.coverUrl.startsWith('http')
                      ? cancion.coverUrl
                      : `${BASE_API.replace(/\/api$/, '')}${cancion.coverUrl}`
                    : null;

                  return (
                    <View key={cancion.trackId} style={styles.rankingItem}>
                      <Text style={styles.rankBadge}>#{idx + 1}</Text>
                      <View style={styles.coverBox}>
                        {coverUri ? (
                          <Image source={{ uri: coverUri }} style={styles.coverImg} />
                        ) : (
                          <Text style={styles.coverFallbackText}>🎵</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rankTitle} numberOfLines={1}>
                          {cancion.titulo}
                        </Text>
                        <Text style={styles.rankSubtitle} numberOfLines={1}>
                          {cancion.artista}
                        </Text>
                      </View>
                      <View style={styles.metricBox}>
                        <Text style={styles.metricValue}>
                          {cancion.reproducciones}
                        </Text>
                        <Text style={styles.metricSub}>
                          {cancion.minutosEscuchados} min
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Top 5 Artistas */}
            <View style={styles.sectionPanel}>
              <Text style={styles.panelTitle}>🎤 Top 5 Artistas</Text>
              <View style={styles.rankingList}>
                {stats.topArtistas.map((art, idx) => (
                  <View key={art.nombre} style={styles.rankingItem}>
                    <Text style={styles.rankBadge}>#{idx + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankTitle}>{art.nombre}</Text>
                      <Text style={styles.rankSubtitle}>
                        {art.minutosEscuchados} min escuchados
                      </Text>
                    </View>
                    <View style={styles.metricBox}>
                      <Text style={styles.metricValue}>{art.reproducciones}</Text>
                      <Text style={styles.metricSub}>plays</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Top Géneros */}
            {stats.topGeneros.length > 0 && (
              <View style={styles.sectionPanel}>
                <Text style={styles.panelTitle}>✨ Distribución de Géneros</Text>
                {stats.topGeneros.map((gen) => (
                  <View key={gen.nombre} style={styles.genreRow}>
                    <View style={styles.genreHeader}>
                      <Text style={styles.genreName}>{gen.nombre}</Text>
                      <Text style={styles.genreCount}>
                        {gen.reproducciones} ({gen.porcentaje}%)
                      </Text>
                    </View>
                    <View style={styles.genreBarBg}>
                      <View
                        style={[
                          styles.genreBarFill,
                          { width: `${Math.min(100, Math.max(5, gen.porcentaje))}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Actividad Diaria */}
            <View style={styles.sectionPanel}>
              <Text style={styles.panelTitle}>📊 Actividad Diaria</Text>
              <Text style={styles.panelSubtitle}>
                Reproducciones por día en el periodo ({stats.periodoLabel})
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.activityBarsRow}>
                  {stats.actividadDiaria.map((d) => {
                    const barHeight =
                      d.reproducciones > 0
                        ? Math.max(12, Math.round((d.reproducciones / maxDailyPlays) * 80))
                        : 4;

                    return (
                      <View key={d.fecha} style={styles.activityCol}>
                        <Text style={styles.activityNum}>
                          {d.reproducciones > 0 ? d.reproducciones : ''}
                        </Text>
                        <View style={[styles.activityPillar, { height: barHeight }]} />
                        <Text style={styles.activityDay}>{d.diaSemana}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080511' },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.15)',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  backBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  titleSection: { padding: 20 },
  subBadge: {
    color: '#f472b6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  mainTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  mainDesc: { color: '#cdbedb', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: '#120c24',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  periodPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
  },
  periodPillActive: {
    backgroundColor: '#a855f7',
  },
  periodPillText: {
    color: '#cdbedb',
    fontSize: 12,
    fontWeight: '700',
  },
  periodPillTextActive: {
    color: '#fff',
  },
  centered: { padding: 40, alignItems: 'center' },
  loadingText: { color: '#cdbedb', marginTop: 12, fontSize: 13 },
  errorBox: {
    margin: 20,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 12,
  },
  errorText: { color: '#fca5a5', fontSize: 13, marginBottom: 8 },
  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  retryBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyBox: {
    margin: 20,
    padding: 36,
    backgroundColor: '#120c24',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 18,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyDesc: { color: '#a797be', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  exploreBtn: {
    backgroundColor: '#a855f7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  exploreBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#120c24',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 14,
    padding: 14,
  },
  kpiLabel: {
    color: '#867499',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValue: { fontSize: 24, fontWeight: '900', marginBottom: 2 },
  kpiSub: { color: '#a797be', fontSize: 10 },
  sectionPanel: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#120c24',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: 16,
    padding: 16,
  },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  panelSubtitle: { color: '#a797be', fontSize: 11, marginTop: -8, marginBottom: 14 },
  rankingList: { gap: 10 },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0a0515',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.1)',
  },
  rankBadge: { color: '#c084fc', fontSize: 13, fontWeight: '800', width: 22 },
  coverBox: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#1b1233',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverFallbackText: { fontSize: 16 },
  rankTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  rankSubtitle: { color: '#cdbedb', fontSize: 11 },
  metricBox: { alignItems: 'flex-end' },
  metricValue: { color: '#fff', fontSize: 13, fontWeight: '800' },
  metricSub: { color: '#867499', fontSize: 10 },
  genreRow: { marginBottom: 12 },
  genreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  genreName: { color: '#fff', fontSize: 12, fontWeight: '700' },
  genreCount: { color: '#c084fc', fontSize: 11, fontWeight: '700' },
  genreBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  genreBarFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 3,
  },
  activityBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 110,
    paddingVertical: 8,
  },
  activityCol: { alignItems: 'center', width: 26 },
  activityNum: { color: '#a797be', fontSize: 9, marginBottom: 2 },
  activityPillar: {
    width: 14,
    backgroundColor: '#38bdf8',
    borderRadius: 4,
  },
  activityDay: { color: '#867499', fontSize: 9, marginTop: 4 },
});
