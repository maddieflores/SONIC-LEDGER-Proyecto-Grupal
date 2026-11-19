import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Brand, colors, HeroArt, NeonButton } from './Neon';
export default function AccessPending({ register }: { register: boolean }) {
  const router = useRouter();
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><Brand /><HeroArt size={230} /><Text style={styles.title}>{register ? 'Registrarse' : 'Iniciar sesión'}</Text><Text style={styles.text}>{register ? 'El registro' : 'El inicio de sesión'} todavía no está disponible. Esta ruta está preparada para la próxima etapa.</Text><Text style={styles.note}>No se solicitan ni guardan credenciales.</Text><NeonButton onPress={() => router.replace('/welcome')}>Volver a la bienvenida</NeonButton></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, title: { color: colors.text, fontSize: 32, fontWeight: '700', marginBottom: 15 }, text: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 25, maxWidth: 360 }, note: { color: '#a58ab6', fontSize: 12, marginTop: 15, marginBottom: 30, textAlign: 'center' } });
