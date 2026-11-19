import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayback } from './PlaybackContext';
import { djRequest, djChips, type DjState, type DjSong } from '../../shared/dj-api';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import './Dj.css';
const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export function DjPage() {
  const player = usePlayback();
  const [session, setSession] = useState<DjState | null>(null), [sessions, setSessions] = useState<DjState[]>([]);
  const [prompt, setPrompt] = useState(''), [instruction, setInstruction] = useState(''), [name, setName] = useState('Mi sesión DJ');
  const [status, setStatus] = useState({ available: false, message: 'Consultando DJ local…' }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [candidates, setCandidates] = useState<DjSong[]>([]);
  useEffect(() => {
    let active = true;
    void Promise.all([djRequest<typeof status>(base, '/status'), djRequest<DjState[]>(base, '/sessions')]).then(([s, list]) => { if (active) { setStatus(s); setSessions(list); setSession(list[0] || null); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  async function run(path: string, body: unknown) {
    setBusy(true); setError('');
    try {
      const next = await djRequest<DjState>(base, path, undefined, body);
      setSession(next); setSessions(old => [next, ...old.filter(s => s.id !== next.id)]); setIndex(0);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function adjust(action: string, extra: object = {}) {
    if (session) void run('/sessions/' + session.id + '/adjust', { action, version: session.version, index, ...extra });
  }
  return <>
    <SonicSidebar mode="drawer" />
    <main className="dj-page">
      <nav>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
          <SidebarToggle />
          <Link to="/explorar">← Música</Link>
        </div>
        <Link to="/mi-musica">Mis playlists</Link>
      </nav>
      <header><span>SESIÓN LOCAL · TU FRECUENCIA</span><h1>DJ Sonic Ledger</h1><p>Describe tu música. Dale forma a tu sesión.</p></header>
    <p role="status">{status.message}</p>
    <form onSubmit={e => { e.preventDefault(); void run('/sessions', { prompt }); }}><label htmlFor="dj-prompt">Tu petición musical</label><textarea id="dj-prompt" maxLength={800} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Rock para entrenar, pop sin electrónica…" /><button disabled={busy || !status.available || prompt.trim().length < 2}>Generar sesión</button></form>
    {error && <p role="alert" className="dj-error">{error}</p>}
    {busy && <p role="status">Procesando sesión…</p>}
    <section><h2>Selección manual</h2><p>Elige canciones del catálogo sin usar el modelo.</p><button disabled={busy} onClick={() => { setBusy(true); void djRequest<DjSong[]>(base, '/candidates').then(setCandidates).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Ver canciones disponibles</button><div className="dj-actions">{candidates.map(t => <button disabled={busy} key={t.id} onClick={() => session ? adjust('append', { trackId: t.id }) : void run('/manual', { trackId: t.id })}>+ {t.titulo} · {t.artista.nombre}</button>)}</div><button disabled={busy || !session} onClick={() => setSession(null)}>Preparar otra sesión manual</button></section>
    <section><h2>Tus sesiones</h2><div className="dj-actions">{sessions.map(s => <button disabled={busy} key={s.id} onClick={() => { setSession(s); setIndex(0); }}>Sesión {s.id.slice(0, 6)} · {s.tracks.length} pistas</button>)}</div></section>
    {session ? <>
      <div className="dj-chips">{djChips(session).map((chip, i) => <span key={i}>{chip}</span>)}</div>
      {session.warnings.map(w => <p key={w}>{w}</p>)}
      <section><h2>Tu cola · {session.tracks.length} canciones</h2><button disabled={busy || !session.tracks.length} onClick={() => player.play(session.tracks[0], session.tracks)}>▶ Reproducir sesión</button>
      <ol>{session.tracks.map((song, i) => <li key={song.source + ':' + song.id}><label><input type="radio" name="dj-track" checked={index === i} onChange={() => setIndex(i)} /> <strong>{song.titulo}</strong> · {song.artista.nombre} <small>{song.source}</small></label><div className="dj-actions"><button disabled={busy} onClick={() => void run('/sessions/' + session.id + '/adjust', { action: 'remove', version: session.version, index: i })}>Quitar</button><button disabled={busy} onClick={() => void run('/sessions/' + session.id + '/adjust', { action: 'replace', version: session.version, index: i })}>Sustituir</button><button aria-label={'Subir ' + song.titulo} disabled={busy || !i} onClick={() => void run('/sessions/' + session.id + '/adjust', { action: 'move', version: session.version, index: i, to: i - 1 })}>↑</button><button aria-label={'Bajar ' + song.titulo} disabled={busy || i === session.tracks.length - 1} onClick={() => void run('/sessions/' + session.id + '/adjust', { action: 'move', version: session.version, index: i, to: i + 1 })}>↓</button></div></li>)}</ol></section>
      <section><h2>Ajustar sesión</h2><p>Para “cambia esta canción”, selecciona una pista de la cola.</p><div className="dj-actions">{['Más tranquilo', 'Más energético', 'Mantén el rock', 'Sin electrónica', 'Agrega cinco canciones'].map(text => <button key={text} disabled={busy || !status.available} onClick={() => adjust('instruction', { prompt: text })}>{text}</button>)}<button disabled={busy} onClick={() => adjust('deduplicate')}>Quita canciones repetidas</button></div><form onSubmit={e => { e.preventDefault(); adjust('instruction', { prompt: instruction }); }}><label htmlFor="dj-instruction">Instrucciones adicionales</label><input id="dj-instruction" maxLength={800} value={instruction} onChange={e => setInstruction(e.target.value)} /><button disabled={busy || !status.available || instruction.trim().length < 2}>Aplicar ajuste</button></form></section>
      <section><h2>Guardar como playlist</h2><label htmlFor="dj-name">Nombre de la sesión</label><input id="dj-name" maxLength={150} value={name} onChange={e => setName(e.target.value)} /><button disabled={busy || !name.trim() || !session.tracks.length || !!session.playlistId} onClick={() => void run('/sessions/' + session.id + '/playlist', { version: session.version, nombre: name })}>Guardar playlist</button>{session.playlistId && <p role="status">Playlist guardada. <Link to="/mi-musica">Abrir biblioteca</Link></p>}</section>
    </> : <p>Genera una sesión para comenzar. Las sesiones existentes se recuperan al volver a entrar.</p>}
  </main>
</>;
}
