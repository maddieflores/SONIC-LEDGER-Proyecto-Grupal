import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, colors, HeroArt, NeonButton } from '../components/Neon';
export default function Welcome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Brand /><HeroArt size={Math.min(width, height * .44, 440)} />
    <Text style={styles.label}>TU PRÓXIMA CONEXIÓN EMPIEZA AQUÍ</Text>
    <Text style={styles.title}>Tu música,{'\n'}tu universo.</Text>
    <Text style={styles.text}>Descubre tu sonido, encuentra tu momento y siente la música en vivo.</Text>
    <View style={styles.buttons}><NeonButton onPress={() => router.push('/registro')}>Registrarse  ↗</NeonButton><NeonButton secondary onPress={() => router.push('/iniciar-sesion')}>Iniciar sesión</NeonButton></View>
    <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding')} hitSlop={12}><Text style={styles.replay}>Volver a ver la introducción</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, alignItems: 'center', padding: 25, justifyContent: 'center' },
  label: { fontSize: 8, letterSpacing: 1.5, color: '#be8ee0', textAlign: 'center' },
  title: { fontSize: 40, lineHeight: 45, fontWeight: '700', textAlign: 'center', color: colors.text, letterSpacing: -1.5, marginTop: 16 },
  text: { fontSize: 14, lineHeight: 23, color: colors.muted, textAlign: 'center', maxWidth: 330, marginTop: 15 },
  buttons: { gap: 12, width: '100%', maxWidth: 380, marginTop: 28 }, replay: { color: '#a88abb', fontSize: 12, paddingVertical: 23 },
});
