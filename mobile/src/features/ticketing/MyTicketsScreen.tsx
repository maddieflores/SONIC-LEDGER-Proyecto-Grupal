import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { listarMisTickets } from '../../../../shared/ticketing-api';
import type { TicketDigital, TicketEstado } from '../../../../shared/ticketing';
import { getToken } from '../../services/session';

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function MyTicketsScreen() {
  const [tickets, setTickets] = useState<TicketDigital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketDigital | null>(null);

  const fetchTickets = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const token = await getToken();
      if (!token) {
        setError('Debes iniciar sesión para consultar tus entradas.');
        return;
      }
      const data = await listarMisTickets(token, BASE_API);
      setTickets(data);
    } catch (e: any) {
      setError(e.message || 'Error al obtener tus entradas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchTickets();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeStyle = (estado: TicketEstado, cancelado?: boolean) => {
    if (cancelado) {
      return {
        bg: 'rgba(239, 68, 68, 0.25)',
        border: '#ef4444',
        text: '#fca5a5',
        label: 'CANCELADO',
      };
    }
    switch (estado) {
      case 'VIGENTE':
        return {
          bg: 'rgba(34, 197, 94, 0.2)',
          border: '#22c55e',
          text: '#4ade80',
          label: 'VIGENTE',
        };
      case 'UTILIZADO':
        return {
          bg: 'rgba(148, 163, 184, 0.2)',
          border: '#64748b',
          text: '#94a3b8',
          label: 'UTILIZADO',
        };
      case 'INVALIDADO':
        return {
          bg: 'rgba(239, 68, 68, 0.2)',
          border: '#ef4444',
          text: '#f87171',
          label: 'INVALIDADO',
        };
      default:
        return {
          bg: 'rgba(168, 85, 247, 0.2)',
          border: '#a855f7',
          text: '#c084fc',
          label: estado,
        };
    }
  };

  const renderTicketCard = ({ item }: { item: TicketDigital }) => {
    const badge = getStatusBadgeStyle(item.estado, item.conciertoCancelado);
    const coverUri = item.conciertoPortadaUrl
      ? item.conciertoPortadaUrl.startsWith('http')
        ? item.conciertoPortadaUrl
        : `${BASE_API.replace(/\/api$/, '')}${item.conciertoPortadaUrl}`
      : null;

    return (
      <View style={styles.ticketCard}>
        {/* Cover header */}
        <View style={styles.ticketCoverContainer}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.ticketCover} />
          ) : (
            <View style={styles.ticketCoverFallback}>
              <Text style={styles.fallbackText}>SONIC LEDGER</Text>
            </View>
          )}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.ticketBody}>
          <Text style={styles.ticketCode}>{item.codigoPublico}</Text>
          <Text style={styles.ticketTitle} numberOfLines={2}>
            {item.conciertoTitulo}
          </Text>

          {item.conciertoCancelado && (
            <View style={styles.ticketCancelledNotice}>
              <Text style={styles.ticketCancelledNoticeText}>
                ⚠️ Evento cancelado
                {item.motivoCancelacion ? `: ${item.motivoCancelacion}` : ''}
              </Text>
              {item.reembolsoEstado === 'PENDIENTE_REEMBOLSO' && (
                <Text style={styles.ticketRefundText}>
                  • Pendiente de reembolso
                </Text>
              )}
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={styles.metaText}>{formatDate(item.fechaInicio)}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText}>
              {item.recinto} ({item.ciudad})
            </Text>
          </View>

          <View style={styles.categoryRow}>
            <Text style={styles.categoryName}>{item.categoriaNombre}</Text>
            <Text style={styles.categoryPrice}>
              {item.precio != null
                ? `Bs. ${Number(item.precio).toFixed(2)}`
                : 'Acceso'}
            </Text>
          </View>

          <Pressable
            style={styles.showQrBtn}
            onPress={() => setSelectedTicket(item)}
            accessibilityRole="button"
            accessibilityLabel={`Ver código QR para ${item.codigoPublico}`}
          >
            <Text style={styles.showQrBtnText}>📱 Mostrar QR de Ingreso</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Mis Entradas</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Main Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>Cargando entradas...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => fetchTickets()}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No tienes entradas adquiridas</Text>
          <Text style={styles.emptySubtitle}>
            Explora los conciertos disponibles y asegura tu acceso digital.
          </Text>
          <Pressable
            style={styles.exploreBtn}
            onPress={() => router.push('/conciertos' as any)}
          >
            <Text style={styles.exploreBtnText}>Explorar Conciertos</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          renderItem={renderTicketCard}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => fetchTickets(true)}
        />
      )}

      {/* Modal QR (CU21) */}
      <Modal
        visible={!!selectedTicket}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedTicket?.conciertoTitulo}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSelectedTicket(null)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              {selectedTicket?.categoriaNombre} • {selectedTicket?.ciudad}
            </Text>

            {/* Alerta si el evento o el ticket fue cancelado */}
            {(selectedTicket?.conciertoCancelado ||
              selectedTicket?.estado === 'INVALIDADO') && (
              <View style={styles.qrCancelledWarning}>
                <Text style={styles.qrCancelledWarningTitle}>
                  Concierto cancelado
                </Text>
                <Text style={styles.qrCancelledWarningText}>
                  El evento ha sido cancelado por el organizador. Este código
                  QR no autoriza el ingreso al recinto.
                </Text>
                <Text style={styles.qrRefundInfo}>
                  Estado de devolución:{' '}
                  {selectedTicket?.reembolsoEstado === 'REEMBOLSADO'
                    ? 'Devolución completada'
                    : selectedTicket?.reembolsoEstado === 'REEMBOLSO_PARCIAL'
                    ? 'Devolución parcial'
                    : 'Pendiente de procesamiento'}
                </Text>
              </View>
            )}

            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#c084fc', fontSize: 11, fontWeight: '600' }}>
                Modo demostración — Sin cargos ni devoluciones reales
              </Text>
            </View>

            {/* Contenedor QR de Alto Contraste */}
            <View style={styles.qrBox}>
              {selectedTicket?.qrCodeDataUrl ? (
                <Image
                  source={{ uri: selectedTicket.qrCodeDataUrl }}
                  style={[
                    styles.qrImage,
                    (selectedTicket?.conciertoCancelado ||
                      selectedTicket?.estado === 'INVALIDADO') && {
                      opacity: 0.35,
                    },
                  ]}
                />
              ) : (
                <View style={styles.qrFallback}>
                  <Text style={styles.qrFallbackText}>QR no disponible</Text>
                </View>
              )}
            </View>

            <Text style={styles.modalTicketCode}>
              {selectedTicket?.codigoPublico}
            </Text>

            <Text style={styles.modalNotice}>
              {selectedTicket?.conciertoCancelado ||
              selectedTicket?.estado === 'INVALIDADO'
                ? 'Ticket inhabilitado por cancelación del concierto.'
                : 'Presenta este código en la entrada del evento para su lectura y validación. Es único e intransferible.'}
            </Text>

            <Pressable
              style={styles.modalDoneBtn}
              onPress={() => setSelectedTicket(null)}
            >
              <Text style={styles.modalDoneText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080511',
  },
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
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  backBtnText: {
    color: '#c084fc',
    fontWeight: '700',
    fontSize: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  ticketCard: {
    backgroundColor: '#120c24',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  ticketCoverContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
    backgroundColor: '#1b1233',
  },
  ticketCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ticketCoverFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e113a',
  },
  fallbackText: {
    color: '#a855f7',
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 14,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  ticketBody: {
    padding: 16,
  },
  ticketCode: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  ticketTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  metaIcon: {
    fontSize: 12,
  },
  metaText: {
    color: '#cdbedb',
    fontSize: 13,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 5, 17, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  categoryName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  categoryPrice: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: 14,
  },
  showQrBtn: {
    backgroundColor: '#9333ea',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  showQrBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#cdbedb',
    marginTop: 12,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 15,
  },
  retryBtn: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#c084fc',
    fontWeight: '700',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#cdbedb',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 20,
  },
  exploreBtn: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#0f0a1d',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: '#cdbedb',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#cdbedb',
    fontSize: 13,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  qrBox: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  qrImage: {
    width: 220,
    height: 220,
    resizeMode: 'contain',
  },
  qrFallback: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f1f1',
  },
  qrFallbackText: {
    color: '#666',
    fontSize: 12,
  },
  modalTicketCode: {
    color: '#c084fc',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginVertical: 6,
  },
  modalNotice: {
    color: '#cdbedb',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 20,
  },
  modalDoneBtn: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    paddingVertical: 12,
    width: '100%',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  ticketCancelledNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  ticketCancelledNoticeText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  ticketRefundText: {
    color: '#fecaca',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  qrCancelledWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    width: '100%',
  },
  qrCancelledWarningTitle: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  qrCancelledWarningText: {
    color: '#fca5a5',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  qrRefundInfo: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
});
