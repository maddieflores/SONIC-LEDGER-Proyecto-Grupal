import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import {
  listarConciertosAsignadosVerificador,
  validarIngresoQR,
} from '../../../../shared/ticketing-api';
import type {
  ConciertoAsignadoVerificador,
  ResultadoValidacion,
} from '../../../../shared/ticketing';
import { getToken } from '../../services/session';

const BASE_API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export default function VerifierScanScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [conciertos, setConciertos] = useState<ConciertoAsignadoVerificador[]>([]);
  const [selectedConcierto, setSelectedConcierto] = useState<ConciertoAsignadoVerificador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Permisos de cámara
  const [permission, requestPermission] = useCameraPermissions();

  // Estado del escáner
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<ResultadoValidacion | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [scanCooldown, setScanCooldown] = useState(false);
  const lastScannedTokenRef = useRef<string>('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const userToken = await getToken();
        if (!userToken) {
          setError('Debes iniciar sesión con rol de VERIFICADOR.');
          setLoading(false);
          return;
        }
        if (active) setToken(userToken);

        const data = await listarConciertosAsignadosVerificador(userToken, BASE_API);
        if (active) {
          setConciertos(data);
          if (data.length > 0) {
            setSelectedConcierto(data[0]);
          }
        }
      } catch (e: any) {
        if (active) setError(e.message || 'Error al obtener conciertos asignados.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleBarcodeScanned = async (scanningResult: BarcodeScanningResult) => {
    if (isProcessing || scanCooldown) return;
    const qrData = scanningResult.data;
    if (!qrData || qrData === lastScannedTokenRef.current) return;

    await procesarValidacion(qrData);
  };

  const procesarValidacion = async (qrInput: string) => {
    if (!selectedConcierto) {
      alert('Por favor selecciona primero el concierto en el que estás validando accesos.');
      return;
    }
    if (!token) return;

    setIsProcessing(true);
    setScanCooldown(true);
    lastScannedTokenRef.current = qrInput.trim();

    try {
      const res = await validarIngresoQR(
        {
          conciertoId: selectedConcierto.conciertoId,
          qrToken: qrInput.trim(),
        },
        token,
        BASE_API,
      );
      setLastScannedResult(res);
    } catch (e: any) {
      setLastScannedResult({
        valido: false,
        resultado: 'NO_AUTORIZADO',
        mensaje: e.message || 'Error inesperado de comunicación.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScanner = () => {
    setLastScannedResult(null);
    setManualCode('');
    lastScannedTokenRef.current = '';
    setScanCooldown(false);
  };

  const renderResultBanner = (res: ResultadoValidacion) => {
    const isSuccess = res.valido && res.resultado === 'EXITOSO';
    const isAlreadyUsed = res.resultado === 'YA_UTILIZADO';
    const isWrongEvent = res.resultado === 'EVENTO_INCORRECTO';

    let bgColor = 'rgba(239, 68, 68, 0.95)';
    let title = 'ACCESO DENEGADO';
    let icon = '❌';

    if (isSuccess) {
      bgColor = 'rgba(34, 197, 94, 0.95)';
      title = 'ACCESO PERMITIDO';
      icon = '✅';
    } else if (isAlreadyUsed) {
      bgColor = 'rgba(234, 88, 12, 0.95)';
      title = 'ENTRADA YA UTILIZADA';
      icon = '⚠️';
    } else if (isWrongEvent) {
      bgColor = 'rgba(234, 179, 8, 0.95)';
      title = 'EVENTO INCORRECTO';
      icon = '🚫';
    }

    return (
      <View style={[styles.resultBanner, { backgroundColor: bgColor }]}>
        <Text style={styles.resultIcon}>{icon}</Text>
        <Text style={styles.resultTitle}>{title}</Text>
        <Text style={styles.resultMessage}>{res.mensaje}</Text>

        {res.ticket && (
          <View style={styles.resultTicketBox}>
            <Text style={styles.resultTicketCode}>{res.ticket.codigoPublico}</Text>
            <Text style={styles.resultTicketCategory}>{res.ticket.categoriaNombre}</Text>
            <Text style={styles.resultTicketConcert}>{res.ticket.conciertoTitulo}</Text>
            {res.ticket.fechaUtilizado && (
              <Text style={styles.resultTicketUsedAt}>
                Validado anteriormente: {new Date(res.ticket.fechaUtilizado).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}

        <Pressable style={styles.nextScanBtn} onPress={resetScanner}>
          <Text style={styles.nextScanBtnText}>Escanear Siguiente Entrada</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Salir</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Control de Acceso QR</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>Cargando eventos asignados...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Volver al inicio</Text>
          </Pressable>
        </View>
      ) : conciertos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Sin conciertos asignados</Text>
          <Text style={styles.emptySubtitle}>
            Tu usuario no está asignado como verificador a ningún concierto activo. Contacta al organizador.
          </Text>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Selector de Concierto */}
          <View style={styles.selectorContainer}>
            <Text style={styles.selectorLabel}>Concierto en verificación:</Text>
            <FlatList
              data={conciertos}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(c) => c.conciertoId}
              contentContainerStyle={styles.concertList}
              renderItem={({ item }) => {
                const isSelected = selectedConcierto?.conciertoId === item.conciertoId;
                return (
                  <Pressable
                    style={[
                      styles.concertChip,
                      isSelected && styles.concertChipSelected,
                    ]}
                    onPress={() => {
                      setSelectedConcierto(item);
                      resetScanner();
                    }}
                  >
                    <Text
                      style={[
                        styles.concertChipText,
                        isSelected && styles.concertChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.titulo} ({item.ciudad})
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          {/* Cámara / Escáner */}
          <View style={styles.cameraFrameWrapper}>
            {permission?.granted ? (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={lastScannedResult ? undefined : handleBarcodeScanned}
                />
                {/* Marco de enfoque neón */}
                <View style={styles.scannerOverlay}>
                  <View style={styles.targetBox}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                  <Text style={styles.scannerTip}>
                    Alinea el código QR de la entrada dentro del marco
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.permissionFallback}>
                <Text style={styles.permissionText}>
                  Se requiere permiso de cámara para escanear tickets QR.
                </Text>
                <Pressable
                  style={styles.permissionBtn}
                  onPress={() => void requestPermission()}
                >
                  <Text style={styles.permissionBtnText}>Conceder Permiso</Text>
                </Pressable>
              </View>
            )}

            {/* Spinner de procesamiento */}
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.processingText}>Validando en servidor...</Text>
              </View>
            )}

            {/* Resultado de validación superpuesto */}
            {lastScannedResult && renderResultBanner(lastScannedResult)}
          </View>

          {/* Ingreso manual alternativo */}
          <View style={styles.manualInputSection}>
            <Text style={styles.manualTitle}>Ingreso manual o de prueba:</Text>
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="Pegar token QR o SLQR_..."
                placeholderTextColor="#666"
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
              />
              <Pressable
                style={[
                  styles.manualSubmitBtn,
                  (!manualCode.trim() || isProcessing) && styles.btnDisabled,
                ]}
                disabled={!manualCode.trim() || isProcessing}
                onPress={() => void procesarValidacion(manualCode)}
              >
                <Text style={styles.manualSubmitText}>Validar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
    fontSize: 17,
    fontWeight: '800',
  },
  mainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  selectorContainer: {
    padding: 12,
    backgroundColor: '#120c24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  selectorLabel: {
    color: '#a797be',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  concertList: {
    gap: 8,
  },
  concertChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginRight: 8,
  },
  concertChipSelected: {
    backgroundColor: '#9333ea',
    borderColor: '#c084fc',
  },
  concertChipText: {
    color: '#cdbedb',
    fontSize: 13,
    fontWeight: '600',
  },
  concertChipTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  cameraFrameWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  cameraContainer: {
    ...StyleSheet.absoluteFill,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  targetBox: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38bdf8',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scannerTip: {
    color: '#fff',
    fontSize: 13,
    marginTop: 20,
    fontWeight: '600',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  permissionFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#cdbedb',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  permissionBtn: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 5, 17, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: '#38bdf8',
    marginTop: 12,
    fontWeight: '700',
  },
  resultBanner: {
    ...StyleSheet.absoluteFill,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: {
    fontSize: 54,
    marginBottom: 8,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  resultMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  resultTicketBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 16,
    borderRadius: 14,
    width: '100%',
    maxWidth: 320,
    marginBottom: 24,
    alignItems: 'center',
  },
  resultTicketCode: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  resultTicketCategory: {
    color: '#fef08a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  resultTicketConcert: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  resultTicketUsedAt: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  nextScanBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nextScanBtnText: {
    color: '#080511',
    fontWeight: '900',
    fontSize: 16,
  },
  manualInputSection: {
    padding: 16,
    backgroundColor: '#120c24',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  manualTitle: {
    color: '#a797be',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#080511',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 13,
  },
  manualSubmitBtn: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualSubmitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
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
  },
});
