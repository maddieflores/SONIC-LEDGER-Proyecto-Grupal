import { useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Brand, colors, HeroArt, NeonButton } from '../../components/Neon';
import { completeOnboarding } from '../../services/onboarding';

const slides = [
  { label: 'ENCUENTRA TU FRECUENCIA', title: 'Tu música,\ntu universo', text: 'Descubre canciones y artistas que conectan con tu estilo.' },
  { label: 'UNA SELECCIÓN TAN ÚNICA COMO TÚ', title: 'Tu DJ con\ninteligencia artificial', text: 'Crea sesiones musicales según tus gustos y el momento.' },
  { label: 'DEL PLAY AL ESCENARIO', title: 'Siente la música\nen vivo', text: 'Explora conciertos y lleva tus entradas en el móvil.' },
];
export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const list = useRef<FlatList>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const artSize = Math.min(width, height * .36, 420);
  function go(index: number) {
    list.current?.scrollToOffset({ offset: width * index, animated: true });
    setPage(index);
  }
  async function finish(destination: '/welcome' | '/registro' | '/iniciar-sesion') {
    setBusy(true); setError('');
    try { await completeOnboarding(); router.replace(destination); }
    catch { setError('No pudimos guardar tu bienvenida. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  function scrolled(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.max(0, Math.min(2, Math.round(event.nativeEvent.contentOffset.x / width))));
  }
  return <SafeAreaView style={styles.page}>
    <LinearGradient colors={['#33144c55', 'transparent', '#15102b33']} style={StyleSheet.absoluteFill} />
    <View style={styles.header}><Brand /><Pressable accessibilityRole="button" disabled={busy} onPress={() => void finish('/welcome')} hitSlop={12}><Text style={styles.skip}>Omitir</Text></Pressable></View>
    <FlatList key={width} ref={list} data={slides} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={scrolled} scrollEventThrottle={16} onMomentumScrollEnd={scrolled} initialScrollIndex={page} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} keyExtractor={item => item.label} style={styles.slider}
      renderItem={({ item, index }) => <ScrollView style={{ width }} contentContainerStyle={styles.slide} showsVerticalScrollIndicator={false}>
        <HeroArt page={index} size={artSize} />
        <View style={styles.copy}><Text style={styles.label}>{item.label}</Text><Text accessibilityRole="header" style={[styles.title, { fontSize: width < 360 ? 30 : 36 }]}>{item.title}</Text><Text style={styles.description}>{item.text}</Text></View>
      </ScrollView>} />
    <View style={styles.controls}>
      <View style={styles.progress} accessibilityLabel={`Pantalla ${page + 1} de 3`}>{slides.map((item, i) => <Pressable key={item.label} onPress={() => go(i)} accessibilityRole="button" accessibilityLabel={`Ir a pantalla ${i + 1}`} accessibilityState={{ selected: page === i }} hitSlop={10}><View style={[styles.dot, i === page && styles.activeDot]} /></Pressable>)}</View>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {page === 2 ? <View style={styles.finalButtons}><NeonButton disabled={busy} onPress={() => void finish('/registro')}>Registrarse  ↗</NeonButton><NeonButton secondary disabled={busy} onPress={() => void finish('/iniciar-sesion')}>Iniciar sesión</NeonButton><Pressable onPress={() => go(1)} accessibilityRole="button" hitSlop={10}><Text style={styles.back}>← Atrás</Text></Pressable></View> : <View style={styles.navigation}><Pressable disabled={page === 0} onPress={() => go(page - 1)} accessibilityRole="button" accessibilityState={{ disabled: page === 0 }} style={{ opacity: page === 0 ? .3 : 1 }} hitSlop={12}><Text style={styles.back}>← Atrás</Text></Pressable><View style={{ minWidth: 173 }}><NeonButton onPress={() => go(page + 1)}>Siguiente  →</NeonButton></View></View>}
      <Text style={styles.footer}>DESCUBRE. CONECTA. SIENTE.</Text>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 25, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { color: '#bfb0d2', fontSize: 13, paddingVertical: 10 },
  slider: { flex: 1 }, slide: { flexGrow: 1, justifyContent: 'center', paddingBottom: 10 },
  copy: { paddingHorizontal: 28, alignSelf: 'center', width: '100%', maxWidth: 540, marginTop: -10 },
  label: { color: '#bb8ee3', fontSize: 9, letterSpacing: 1.8, textAlign: 'center', marginBottom: 14, fontWeight: '600' },
  title: { color: colors.text, fontWeight: '700', textAlign: 'center', letterSpacing: -1.4, lineHeight: 42 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: 'center', maxWidth: 320, alignSelf: 'center', marginTop: 16 },
  controls: { width: '100%', maxWidth: 540, alignSelf: 'center', paddingHorizontal: 28, paddingBottom: 14, paddingTop: 12 },
  progress: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 4, backgroundColor: '#44334f' },
  activeDot: { width: 27, backgroundColor: '#ce83f5' },
  navigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: '#c4b5d8', fontSize: 13, paddingVertical: 10, textAlign: 'center' },
  finalButtons: { gap: 10 }, footer: { color: '#766482', fontSize: 8, letterSpacing: 2.5, textAlign: 'center', marginTop: 20 },
  error: { color: '#ffb5ce', fontSize: 12, textAlign: 'center', marginBottom: 14 },
});
