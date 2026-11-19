import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchPublicConcertDetail } from '../../../../shared/concerts-api';
import type { Concert, ConcertEstadoVenta } from '../../../../shared/concerts';
import {
  crearReservaOrden,
  procesarPagoPrueba,
} from '../../../../shared/ticketing-api';
import type { OrdenCompra } from '../../../../shared/ticketing';
import { getToken } from '../../services/session';

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function ConcertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [concert, setConcert] = useState<Concert | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados de Compra (CU20)
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('');
  const [cantidad, setCantidad] = useState<number>(1);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [activeOrder, setActiveOrder] = useState<OrdenCompra | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void getToken().then((val) => {
      if (active && val) setToken(val);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadConcert = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await fetchPublicConcertDetail(id, BASE_API);
      setConcert(data);
      if (data.categorias && data.categorias.length > 0) {
        setSelectedCategoriaId(data.categorias[0].id);
      }
      setError('');
    } catch (e: any) {
      setError(e.message || 'Error al cargar el concierto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConcert();
  }, [id]);

  // Temporizador de reserva de 15 minutos
  useEffect(() => {
    if (!activeOrder || !isModalOpen) return;
    const expiraMs = new Date(activeOrder.expiraEn).getTime();

    const interval = setInterval(() => {
      const diff = expiraMs - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00 - Expirada');
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(
          `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrder, isModalOpen]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusText = (status: ConcertEstadoVenta) => {
    if (concert?.estado === 'CANCELADO') {
      return 'Cancelado';
    }
    switch (status) {
      case 'VENTA_INICIADA':
        return 'Venta disponible';
      case 'VENTA_PENDIENTE':
        return 'Venta próximamente';
      case 'VENTA_CERRADA':
        return 'Venta cerrada';
      default:
        return '';
    }
  };

  const selectedCategory = concert?.categorias?.find(
    (c) => c.id === selectedCategoriaId,
  );

  const subtotal = selectedCategory
    ? Number(selectedCategory.precio) * cantidad
    : 0;

  const handleStartPurchase = async () => {
    if (!token) {
      router.push('/iniciar-sesion');
      return;
    }
    if (!selectedCategoriaId || !concert) return;

    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const orden = await crearReservaOrden(
        {
          conciertoId: concert.id,
          categoriaId: selectedCategoriaId,
          cantidad,
        },
        token,
        BASE_API,
      );
      setActiveOrder(orden);
      setIsModalOpen(true);
    } catch (e: any) {
      setCheckoutError(e.message || 'No se pudo iniciar la reserva.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSimulatePayment = async (
    resultado: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE',
  ) => {
    if (!activeOrder || !token) return;
    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const resp = await procesarPagoPrueba(
        {
          ordenId: activeOrder.id,
          simularResultado: resultado,
        },
        token,
        BASE_API,
      );

      if (resultado === 'APROBADO') {
        setPaymentSuccess(true);
        setTimeout(() => {
          setIsModalOpen(false);
          setPaymentSuccess(false);
          router.push('/mis-entradas' as any);
        }, 1500);
      } else if (resultado === 'RECHAZADO') {
        setCheckoutError('El pago de prueba fue RECHAZADO. El cupo reservado fue liberado.');
        setActiveOrder(resp.orden);
      } else {
        setCheckoutError('El pago quedó en estado PENDIENTE.');
        setActiveOrder(resp.orden);
      }
    } catch (e: any) {
      setCheckoutError(e.message || 'Error al procesar el pago.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>Cargando evento...</Text>
      </SafeAreaView>
    );
  }

  if (error || !concert) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>
          {error || 'El concierto no se encuentra disponible.'}
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Volver a Conciertos</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const coverUri = concert.portadaUrl
    ? concert.portadaUrl.startsWith('http')
      ? concert.portadaUrl
      : `${BASE_API.replace(/\/api$/, '')}${concert.portadaUrl}`
    : null;

  const isCancelado = concert.estado === 'CANCELADO';
  const isVentaIniciada = !isCancelado && concert.estadoVenta === 'VENTA_INICIADA';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner Panorámico */}
        <View style={styles.bannerContainer}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.bannerImage} />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Text style={styles.placeholderBannerText}>SONIC LEDGER</Text>
            </View>
          )}

          <LinearGradient
            colors={['rgba(7, 7, 19, 0.1)', '#070713']}
            style={styles.bannerGradient}
          />

          <Pressable style={styles.bannerBackButton} onPress={() => router.back()}>
            <Text style={styles.bannerBackText}>← Explorar</Text>
          </Pressable>

          <View style={styles.bannerContent}>
            <View style={styles.tagRow}>
              {concert.genero ? (
                <View style={styles.badgeGenre}>
                  <Text style={styles.badgeGenreText}>{concert.genero}</Text>
                </View>
              ) : null}
              <View style={styles.badgeStatus}>
                <Text style={styles.badgeStatusText}>
                  {getStatusText(concert.estadoVenta)}
                </Text>
              </View>
            </View>
            <Text style={styles.hugeTitle}>{concert.titulo}</Text>
          </View>
        </View>

        {/* Detalles Principales */}
        <View style={styles.mainContent}>
          {/* Banner de cancelación si corresponde */}
          {isCancelado && (
            <View style={styles.cancelledBanner}>
              <Text style={styles.cancelledBannerTitle}>⚠️ Concierto Cancelado</Text>
              <Text style={styles.cancelledBannerDesc}>
                Motivo: {concert.motivoCancelacion || 'Cancelado por el organizador.'}
              </Text>
              <Text style={styles.cancelledBannerSub}>
                La venta de entradas está cerrada y las entradas emitidas quedan sin validez de ingreso.
              </Text>
            </View>
          )}

          {/* Fila de Datos Clave */}
          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>FECHA Y HORA</Text>
              <Text style={styles.metaValue}>{formatDate(concert.fechaInicio)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>RECINTO Y CIUDAD</Text>
              <Text style={styles.metaValue}>
                {concert.recinto}, {concert.ciudad}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>ORGANIZADOR</Text>
              <Text style={styles.metaValue}>{concert.organizadorNombre}</Text>
            </View>
          </View>

          {/* Artistas Participantes */}
          {concert.artistas && concert.artistas.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.cardHeading}>Artistas Participantes</Text>
              <View style={styles.artistsList}>
                {concert.artistas.map((item, idx) => (
                  <View key={item.id || idx} style={styles.artistChip}>
                    <Text style={styles.artistChipText}>{item.nombreArtista}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Descripción */}
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeading}>Descripción</Text>
            <Text style={styles.descText}>
              {concert.descripcion || 'Sin descripción adicional para este concierto.'}
            </Text>
          </View>

          {/* Categorías de entradas y Compra (CU20) */}
          <View style={styles.sectionCard}>
            <Text style={styles.cardHeading}>Adquirir Entradas (CU20)</Text>

            {concert.categorias && concert.categorias.length > 0 ? (
              concert.categorias.map((cat) => {
                const isSelected = selectedCategoriaId === cat.id;
                const isSoldOut = cat.cupoDisponible <= 0;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.ticketRow,
                      isSelected && styles.ticketRowSelected,
                      isSoldOut && styles.ticketRowSoldOut,
                    ]}
                    onPress={() => {
                      if (!isSoldOut && isVentaIniciada) {
                        setSelectedCategoriaId(cat.id);
                      }
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketName}>{cat.nombre}</Text>
                      <Text style={styles.ticketQuota}>
                        Cupos: {cat.cupoDisponible} / {cat.cupoTotal}
                        {isSoldOut ? ' (Agotado)' : ''}
                      </Text>
                    </View>
                    <View style={styles.ticketPriceContainer}>
                      <Text style={styles.ticketPrice}>Bs. {cat.precio}</Text>
                      <Text style={styles.ticketMoneda}>{cat.moneda}</Text>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.noTicketsText}>
                No hay categorías de entrada publicadas aún.
              </Text>
            )}

            {isVentaIniciada && selectedCategory && (
              <View style={styles.purchaseControls}>
                {/* Selector de Cantidad */}
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>Cantidad:</Text>
                  <View style={styles.qtyControls}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() => setCantidad((q) => Math.max(1, q - 1))}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{cantidad}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={() =>
                        setCantidad((q) =>
                          Math.min(
                            10,
                            selectedCategory.cupoDisponible || 10,
                            q + 1,
                          ),
                        )
                      }
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Subtotal */}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Total a pagar:</Text>
                  <Text style={styles.subtotalValue}>
                    Bs. {subtotal.toFixed(2)} BOB
                  </Text>
                </View>

                {checkoutError ? (
                  <Text style={styles.checkoutErrorText}>{checkoutError}</Text>
                ) : null}

                {/* Botón Comprar */}
                <Pressable
                  style={[
                    styles.buyButton,
                    (checkoutLoading || selectedCategory.cupoDisponible <= 0) &&
                      styles.btnDisabled,
                  ]}
                  disabled={
                    checkoutLoading || selectedCategory.cupoDisponible <= 0
                  }
                  onPress={() => void handleStartPurchase()}
                >
                  {checkoutLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.buyButtonText}>
                      {token ? 'Comprar Entradas' : 'Iniciar sesión para comprar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            {!isVentaIniciada && (
              <View style={styles.cu20Box}>
                <Text style={styles.cu20Title}>
                  {isCancelado ? 'Concierto cancelado' : 'Venta no iniciada'}
                </Text>
                <Text style={styles.cu20Desc}>
                  {isCancelado
                    ? 'Este concierto ha sido cancelado por el organizador. No se permiten nuevas reservas ni compras.'
                    : 'Las entradas para este evento aún no están disponibles o la venta ha concluido.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal Checkout / Pago de Prueba (CU20) */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCheckoutCard}>
            <Text style={styles.modalCheckoutTitle}>Resumen de compra</Text>
            <Text style={styles.modalCheckoutSubtitle}>
              {concert.titulo}
            </Text>

            {/* Contador de Reserva */}
            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>Tiempo restante de reserva:</Text>
              <Text style={styles.timerValue}>{timeLeft || '15:00'}</Text>
            </View>

            {/* Detalle Orden */}
            <View style={styles.orderSummaryBox}>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.summaryLabel}>Categoría:</Text>
                <Text style={styles.summaryValue}>
                  {selectedCategory?.nombre}
                </Text>
              </View>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.summaryLabel}>Cantidad:</Text>
                <Text style={styles.summaryValue}>{cantidad} entradas</Text>
              </View>
              <View style={styles.orderSummaryRow}>
                <Text style={styles.summaryLabel}>Total:</Text>
                <Text style={[styles.summaryValue, { color: '#38bdf8' }]}>
                  Bs. {activeOrder?.total?.toFixed(2) || subtotal.toFixed(2)} BOB
                </Text>
              </View>
            </View>

            {/* Aviso informativo de demostración */}
            <View style={styles.warningDisclaimerBox}>
              <Text style={styles.disclaimerBold}>
                Modo demostración — Sin cargos ni devoluciones reales
              </Text>
              <Text style={styles.disclaimerSub}>
                Revisa el resumen de compra y confirma tus entradas.
              </Text>
            </View>

            {checkoutError ? (
              <Text style={styles.modalErrorText}>{checkoutError}</Text>
            ) : null}

            {paymentSuccess ? (
              <View style={styles.successBox}>
                <Text style={styles.successIcon}>🎉</Text>
                <Text style={styles.successText}>
                  Compra confirmada
                </Text>
                <Text style={styles.redirectText}>Redirigiendo a tus entradas...</Text>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.simBtn, styles.simBtnApprove]}
                  disabled={checkoutLoading}
                  onPress={() => void handleSimulatePayment('APROBADO')}
                >
                  <Text style={styles.simBtnText}>Comprar entradas</Text>
                </Pressable>

                <Pressable
                  style={[styles.simBtn, styles.simBtnReject]}
                  disabled={checkoutLoading}
                  onPress={() => void handleSimulatePayment('RECHAZADO')}
                >
                  <Text style={styles.simBtnText}>Probar con pago rechazado</Text>
                </Pressable>

                <Pressable
                  style={styles.cancelModalBtn}
                  onPress={() => setIsModalOpen(false)}
                >
                  <Text style={styles.cancelModalText}>Cerrar</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070713',
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
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
  },
  backButtonText: {
    color: '#c084fc',
    fontWeight: '700',
  },
  bannerContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
    backgroundColor: '#170f2b',
    justifyContent: 'flex-end',
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    resizeMode: 'cover',
  },
  bannerPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1b1233',
  },
  placeholderBannerText: {
    color: '#a855f7',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bannerGradient: {
    ...StyleSheet.absoluteFill,
  },
  bannerBackButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(8, 5, 17, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  bannerBackText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  bannerContent: {
    padding: 20,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  badgeGenre: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeGenreText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeStatus: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeStatusText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  hugeTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
  },
  mainContent: {
    padding: 16,
    gap: 16,
  },
  metaCard: {
    backgroundColor: '#120c24',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    gap: 12,
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    color: '#a797be',
    fontSize: 11,
    fontWeight: '700',
  },
  metaValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#120c24',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  cardHeading: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  artistsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  artistChip: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  artistChipText: {
    color: '#c084fc',
    fontWeight: '700',
    fontSize: 13,
  },
  descText: {
    color: '#cdbedb',
    fontSize: 14,
    lineHeight: 20,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(8, 5, 17, 0.6)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  ticketRowSelected: {
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  ticketRowSoldOut: {
    opacity: 0.5,
  },
  ticketName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ticketQuota: {
    color: '#a797be',
    fontSize: 12,
    marginTop: 2,
  },
  ticketPriceContainer: {
    alignItems: 'flex-end',
  },
  ticketPrice: {
    color: '#38bdf8',
    fontSize: 16,
    fontWeight: '800',
  },
  ticketMoneda: {
    color: '#cdbedb',
    fontSize: 11,
  },
  noTicketsText: {
    color: '#cdbedb',
    fontStyle: 'italic',
  },
  purchaseControls: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.15)',
  },
  qtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  qtyLabel: {
    color: '#cdbedb',
    fontSize: 14,
    fontWeight: '700',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  qtyValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subtotalLabel: {
    color: '#cdbedb',
    fontSize: 14,
  },
  subtotalValue: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '900',
  },
  checkoutErrorText: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 12,
  },
  buyButton: {
    backgroundColor: '#9333ea',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cu20Box: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  cu20Title: {
    color: '#c084fc',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  cu20Desc: {
    color: '#cdbedb',
    fontSize: 12,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCheckoutCard: {
    backgroundColor: '#0f0a1d',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalCheckoutTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalCheckoutSubtitle: {
    color: '#cdbedb',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
  timerBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  timerLabel: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '700',
  },
  timerValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  orderSummaryBox: {
    backgroundColor: '#120c24',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 6,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: '#a797be',
    fontSize: 13,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  warningDisclaimerBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  disclaimerBold: {
    color: '#f87171',
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  disclaimerSub: {
    color: '#fca5a5',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
  modalErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalActions: {
    gap: 8,
  },
  simBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  simBtnApprove: {
    backgroundColor: '#22c55e',
  },
  simBtnReject: {
    backgroundColor: '#ef4444',
  },
  simBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelModalText: {
    color: '#cdbedb',
    fontWeight: '700',
    fontSize: 13,
  },
  successBox: {
    alignItems: 'center',
    padding: 16,
  },
  successIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  successText: {
    color: '#4ade80',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  redirectText: {
    color: '#cdbedb',
    fontSize: 12,
    marginTop: 6,
  },
  cancelledBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cancelledBannerTitle: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  cancelledBannerDesc: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 6,
  },
  cancelledBannerSub: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
  },
});
