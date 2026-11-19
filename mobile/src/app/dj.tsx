import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, Pressable, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getToken } from '../services/session';
import { useNativePlayback } from '../features/playback/NativePlayback';
import { djRequest, djChips, type DjState, type DjSong } from '../../../shared/dj-api';
const base = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
export default function DjScreen() {
  const player = useNativePlayback();
  const [session, setSession] = useState<DjState | null>(null), [sessions, setSessions] = useState<DjState[]>([]), [candidates, setCandidates] = useState<DjSong[]>([]);
  const [prompt, setPrompt] = useState(''), [instruction, setInstruction] = useState(''), [name, setName] = useState('Mi sesión DJ');
  const [status, setStatus] = useState({ available: false, message: 'Consultando DJ local…' }), [busy, setBusy] = useState(false), [error, setError] = useState(''), [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true;
    void getToken().then(async token => {
      const [s, list] = await Promise.all([djRequest<typeof status>(base, '/status', token), djRequest<DjState[]>(base, '/sessions', token)]);
      if (active) { setStatus(s); setSessions(list); setSession(list[0] || null); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function run(path: string, body: unknown) {
    setBusy(true); setError('');
    try {
      const next = await djRequest<DjState>(base, path, await getToken(), body);
      setSession(next); setSessions(old => [next, ...old.filter(s => s.id !== next.id)]); setIndex(0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function adjust(action: string, extra: object = {}) {
    if (session) void run('/sessions/' + session.id + '/adjust', { action, version: session.version, index, ...extra });
  }
  function button(label: string, onPress: () => void, disabled = false) {
    return <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={onPress} style={[styles.button, (busy || disabled) && { opacity: .4 }]}><Text style={styles.text}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    {button('← Música', () => router.push('/explorar'))}
    <Text style={styles.eyebrow}>TU FRECUENCIA · DJ LOCAL</Text><Text style={styles.title}>DJ Sonic Ledger</Text><Text style={styles.text}>{status.message}</Text>
    <Text style={styles.text}>Tu petición musical</Text><TextInput accessibilityLabel="Tu petición musical" placeholder="Pop sin electrónica…" placeholderTextColor="#b8a9c9" style={styles.input} value={prompt} onChangeText={setPrompt} maxLength={800} multiline />
    {button('Generar sesión', () => void run('/sessions', { prompt }), !status.available || prompt.trim().length < 2)}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{busy && <Text accessibilityLiveRegion="polite" style={styles.text}>Procesando sesión…</Text>}
    <View style={styles.card}><Text style={styles.heading}>Selección manual</Text><Text style={styles.text}>Elige canciones del catálogo sin usar el modelo.</Text>
    {button('Ver canciones disponibles', () => { setBusy(true); void getToken().then(token => djRequest<DjSong[]>(base, '/candidates', token)).then(setCandidates).catch(e => setError(e.message)).finally(() => setBusy(false)); })}
    {candidates.map(t => button('+ ' + t.titulo + ' · ' + t.artista.nombre, () => session ? adjust('append', { trackId: t.id }) : void run('/manual', { trackId: t.id })))}
    {button('Preparar otra sesión manual', () => setSession(null), !session)}</View>
    <Text style={styles.heading}>Tus sesiones</Text>{sessions.map(s => button('Sesión ' + s.id.slice(0, 6) + ' · ' + s.tracks.length + ' pistas', () => { setSession(s); setIndex(0); }))}
    {session && <>
      <View style={styles.chips}>{djChips(session).map((chip, i) => <Text key={i} style={styles.chip}>{chip}</Text>)}</View>
      {session.warnings.map(w => <Text key={w} style={styles.text}>{w}</Text>)}
      <View style={styles.card}><Text style={styles.heading}>Tu cola · {session.tracks.length} canciones</Text>{button('▶ Reproducir sesión', () => player.play(session.tracks[0], session.tracks), !session.tracks.length)}
      {session.tracks.map((song, i) => <View style={styles.track} key={song.id}><Pressable accessibilityRole="radio" accessibilityState={{ checked: index === i }} onPress={() => setIndex(i)}><Text style={styles.text}>{index === i ? '◉' : '○'} {i + 1}. {song.titulo}</Text><Text style={styles.muted}>{song.artista.nombre} · {song.source}</Text></Pressable><View style={styles.chips}>{button('Quitar ' + (i + 1), () => adjust('remove', { index: i }))}{button('Sustituir ' + (i + 1), () => adjust('replace', { index: i }))}{button('↑ ' + (i + 1), () => adjust('move', { index: i, to: i - 1 }), !i)}{button('↓ ' + (i + 1), () => adjust('move', { index: i, to: i + 1 }), i === session.tracks.length - 1)}</View></View>)}</View>
      <View style={styles.card}><Text style={styles.heading}>Ajustar sesión</Text><Text style={styles.text}>Selecciona una pista para “cambia esta canción”.</Text>{['Más tranquilo', 'Más energético', 'Mantén el rock', 'Sin electrónica', 'Agrega cinco canciones'].map(text => button(text, () => adjust('instruction', { prompt: text }), !status.available))}{button('Quita canciones repetidas', () => adjust('deduplicate'))}<TextInput accessibilityLabel="Instrucciones adicionales" placeholder="Instrucciones adicionales" placeholderTextColor="#b8a9c9" style={styles.input} value={instruction} onChangeText={setInstruction} maxLength={800} />{button('Aplicar ajuste', () => adjust('instruction', { prompt: instruction }), !status.available || instruction.trim().length < 2)}</View>
      <View style={styles.card}><Text style={styles.heading}>Guardar como playlist</Text><TextInput accessibilityLabel="Nombre de la sesión" style={styles.input} value={name} onChangeText={setName} maxLength={150} />{button('Guardar playlist', () => void run('/sessions/' + session.id + '/playlist', { version: session.version, nombre: name }), !name.trim() || !session.tracks.length || !!session.playlistId)}{session.playlistId && <Text accessibilityLiveRegion="polite" style={styles.text}>Playlist guardada en tu biblioteca.</Text>}</View>
    </>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0c0815' }, content: { padding: 22, paddingBottom: 170, gap: 16 },
  title: { color: 'white', fontSize: 34, fontWeight: '800' }, eyebrow: { color: '#c89aff', letterSpacing: 2, fontSize: 12 }, heading: { color: 'white', fontSize: 21, fontWeight: '700' }, text: { color: '#eee6fa', lineHeight: 23 }, muted: { color: '#bba7cf' }, error: { color: '#ffb0d4' },
  input: { color: 'white', backgroundColor: '#161021', borderColor: '#8254ac', borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 48 }, button: { backgroundColor: '#633398', borderRadius: 12, padding: 13, marginVertical: 4, borderWidth: 1, borderColor: '#b985f0' }, card: { padding: 18, backgroundColor: '#1b1228', borderRadius: 20, borderWidth: 1, borderColor: '#654281', gap: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { color: '#a9fff2', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#428e90' }, track: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#543369', gap: 8 },
});
