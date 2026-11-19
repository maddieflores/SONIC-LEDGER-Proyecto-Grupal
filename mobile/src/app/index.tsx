import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken } from '../services/session';
import { hasCompletedOnboarding } from '../services/onboarding';
export default function Entry() {
  const [authenticated, setAuthenticated] = useState(false);
  const [completed, setCompleted] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([hasCompletedOnboarding(), getToken()]).then(([value, token]) => { if (active) { setAuthenticated(Boolean(token)); setCompleted(value); } }).catch(() => { if (active) setCompleted(false); });
    return () => { active = false; };
  }, []);
  if (completed === null) return <View style={styles.loading}><ActivityIndicator color="#c17af3" accessibilityLabel="Cargando bienvenida" /></View>;
  return <Redirect href={authenticated ? '/inicio' : completed ? '/welcome' : '/onboarding'} />;
}
const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: '#070713', justifyContent: 'center', alignItems: 'center' } });
