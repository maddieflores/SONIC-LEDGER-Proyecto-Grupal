import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const colors = { background: '#070713', text: '#faf6ff', muted: '#b1a6c7' };
export function Brand() {
  return <View style={styles.brand}><LinearGradient colors={['#9250ee', '#da48b6']} style={styles.mark}><Text style={styles.wave}>≋</Text></LinearGradient><Text style={styles.brandText}>sonic<Text style={styles.brandLight}>ledger</Text><Text style={{ color: '#e67bdc' }}>.</Text></Text></View>;
}
export function NeonButton({ children, onPress, secondary = false, disabled = false, label }: { children: ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, { opacity: disabled ? .5 : pressed ? .75 : 1 }]}>
    {!secondary && <LinearGradient colors={['#7542e6', '#b63ce0', '#e665bd']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
    <Text style={styles.buttonText}>{children}</Text>
  </Pressable>;
}
export function HeroArt({ page = 0, size }: { page?: number; size: number }) {
  const assets = [require('../../assets/sonic-headphones.webp'), require('../../assets/sonic-dj.webp'), require('../../assets/sonic-concert.webp')];
  return <View style={{ width: size, height: size, alignSelf: 'center', flexShrink: 0, overflow: 'hidden' }}>
    <Image source={assets[page]} style={{ position: 'absolute', top: 0, left: 0, width: size, height: size }} resizeMode="contain" accessibilityLabel={['Audífonos con iluminación neón', 'Consola de DJ iluminada en violeta', 'Concierto con luces neón'][page]} />
    <LinearGradient colors={['#070713', 'transparent', 'transparent', '#070713']} locations={[0, .16, .75, 1]} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={['#070713', 'transparent', 'transparent', '#070713']} locations={[0, .12, .88, 1]} start={{ x: 0, y: .5 }} end={{ x: 1, y: .5 }} style={StyleSheet.absoluteFill} />
  </View>;
}
const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 31, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  wave: { color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '700', transform: [{ rotate: '90deg' }] },
  brandText: { color: colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -1 },
  brandLight: { fontWeight: '300' },
  button: { minHeight: 54, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  secondary: { borderWidth: 1, borderColor: '#61516f', backgroundColor: '#ffffff03' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
