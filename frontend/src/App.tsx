import { useState, useEffect } from 'react'
import { DjPage } from './Dj'
import { PlayerProvider, MiniPlayerWeb, FullPlayerWeb } from './Playback'
import { PublicArtistPage } from './PublicArtist'
import { ArtistReleases } from './ArtistReleases'
import { Catalog, SongDetail } from './Catalog'
import { UserLibrary } from './UserLibrary'
import { ArtistMusicLayout, ArtistDashboard, SongEditor, ArtistSongs } from './ArtistMusic'
import { ArtistEntry, ArtistProfilePage } from './ArtistProfile'
import { ProfilePage } from './Profile'
import { Dashboard } from './Dashboard'
import { Recovery } from './Recovery'
import { Auth } from './Auth'
import { ConcertsPage } from './Concerts'
import { ConcertDetailPage } from './ConcertDetail'
import { OrganizerConcertsPage } from './OrganizerConcerts'
import { MyTicketsPage } from './MyTickets'
import { MusicStatsPage } from './MusicStats'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, AudioLines, Calendar, Headphones, MapPin, Sparkles, Ticket, MoveUpRight } from 'lucide-react'
import { fetchPublicConcerts } from '../../shared/concerts-api'
import type { PublicConcertSummary } from '../../shared/concerts'
import { SidebarProvider } from './SidebarContext'
import './App.css'

const currentYear = new Date().getFullYear()

function Brand() {
  return <Link className="brand" to="/" aria-label="Sonic Ledger, inicio"><span className="brand-mark"><AudioLines size={23} /></span><span>sonic<span className="brand-light">ledger</span><span className="brand-dot">.</span></span></Link>
}
const features = [
  { id: 'musica', n: '01', icon: Headphones, title: 'Encuentra tu frecuencia', tag: 'MÚSICA', text: 'Canciones y artistas que conectan contigo. Un universo por descubrir, a tu ritmo.' },
  { id: 'dj', n: '02', icon: Sparkles, title: 'Un DJ que te entiende', tag: 'INTELIGENCIA ARTIFICIAL', text: 'Tus gustos, tu momento. Sesiones musicales con una selección tan única como tú.' },
  { id: 'experiencia', n: '03', icon: Ticket, title: 'Del play al escenario', tag: 'CONCIERTOS', text: 'Descubre tu próximo concierto y lleva la emoción de la música en vivo en tu móvil.' },
]
function Landing() {
  const [landingConcerts, setLandingConcerts] = useState<PublicConcertSummary[]>([])
  const [loadingConcerts, setLoadingConcerts] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetchPublicConcerts({ limit: 3, sort: 'fecha_asc' })
        if (active && res && res.items) {
          setLandingConcerts(res.items)
        }
      } catch (err) {
        console.warn('No se pudieron cargar conciertos en landing:', err)
      } finally {
        if (active) setLoadingConcerts(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return <div className="landing">
    <header className="header shell"><Brand /><nav aria-label="Navegación principal"><a href="#musica">Música</a><a href="#dj">DJ con IA</a><a href="#conciertos">Conciertos</a></nav><Link className="header-login" to="/iniciar-sesion">Iniciar sesión <MoveUpRight size={15} /></Link></header>
    <main>
      <section className="hero shell" aria-labelledby="hero-title">
        <div className="hero-copy"><div className="pill"><span /> CONECTA CON LO QUE SIENTES</div>
          <h1 id="hero-title">Tu música,<br /><span>tu universo.</span></h1>
          <p className="hero-description">Hay una canción para cada versión de ti. Descubre tu sonido, crea con tu DJ de IA y vive tus próximos conciertos con Sonic Ledger.</p>
          <div className="hero-actions"><Link className="button primary" to="/registro">Crear cuenta <ArrowRight size={19} /></Link><Link className="button secondary" to="/iniciar-sesion">Iniciar sesión</Link></div>
          <div className="hero-note"><span className="mini-wave">▂ ▅ ▃ ▇ ▄</span> Descubre. Conecta. Siente.</div>
        </div>
        <div className="hero-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <img className="headphone-image" src="/images/sonic-headphones.webp" alt="Audífonos negros premium iluminados en violeta, rosa y azul neón" fetchPriority="high" />
          <div className="art-chip chip-top"><span className="chip-icon"><Sparkles size={17} /></span><div><small>A TU RITMO</small><strong>Tu próximo descubrimiento</strong></div></div>
          <div className="art-chip chip-bottom"><AudioLines size={25} /><div><strong>Una conexión diferente.</strong><small>LA MÚSICA EMPIEZA CONTIGO</small></div><span className="live-dot" /></div>
          <span className="art-caption">EL SONIDO DE SER TÚ</span>
        </div>
      </section>
      <section className="discover shell" aria-labelledby="discover-title"><div className="section-heading"><div><span className="eyebrow">TODO LO QUE TE MUEVE</span><h2 id="discover-title">Más que escuchar. <span>Sentir.</span></h2></div><span className="section-aside">Un solo lugar. Tu propio universo.</span></div>
        <div className="feature-grid">{features.map(({ id,n,icon:Icon,title,tag,text })=><article className={`feature feature-${id}`} id={id} key={id}><div className="feature-top"><span className="feature-icon"><Icon size={22} /></span><span className="feature-number">{n}</span></div><span className="feature-label">{tag}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      {/* Sección dinámica de conciertos disponibles */}
      <section className="landing-concerts shell" id="conciertos" aria-labelledby="concerts-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MÚSICA EN VIVO</span>
            <h2 id="concerts-title">Próximos <span>conciertos</span></h2>
          </div>
          <Link className="see-all-link" to="/conciertos">
            Ver cartelera completa <ArrowRight size={15} />
          </Link>
        </div>

        <div className="landing-concerts-grid">
          {landingConcerts.map((c) => (
            <article className="landing-concert-card" key={c.id}>
              <div className="landing-concert-cover-wrap">
                <img
                  src={c.portadaUrl || '/images/sonic-concert.webp'}
                  alt={c.titulo}
                  className="landing-concert-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/images/sonic-concert.webp';
                  }}
                />
                <span className="landing-concert-city">{c.ciudad}</span>
              </div>
              <div className="landing-concert-content">
                <div className="landing-concert-date">
                  <Calendar size={13} />
                  {new Date(c.fechaInicio).toLocaleDateString('es-BO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <h3 className="landing-concert-title">{c.titulo}</h3>
                <p className="landing-concert-venue">
                  <MapPin size={13} /> {c.recinto}
                </p>
                <div className="landing-concert-footer">
                  <div className="landing-concert-price">
                    {c.precioMinimo ? (
                      <>
                        <small>Desde</small> <strong>{c.precioMinimo} BOB</strong>
                      </>
                    ) : (
                      <span>Próximamente</span>
                    )}
                  </div>
                  <Link to={`/conciertos/${c.id}`} className="landing-concert-btn">
                    Ver entradas
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        {landingConcerts.length === 0 && !loadingConcerts && (
          <div className="landing-concerts-empty">
            <p>No hay conciertos disponibles por el momento. ¡Vuelve pronto!</p>
          </div>
        )}
      </section>
    </main>
    <footer className="footer shell"><Brand /><span>Hecho para quienes sienten la música.</span><span>© {currentYear} Sonic Ledger</span></footer>
  </div>
}
export default function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <PlayerProvider>
          <ArtistEntry />
          <Routes>
            <Route path="/dj" element={<DjPage />} />
            <Route path="/mi-musica" element={<UserLibrary />} />
            <Route path="/playlists" element={<UserLibrary />} />
            <Route path="/favoritos" element={<UserLibrary />} />
            <Route path="/historial" element={<UserLibrary />} />
            <Route path="/artista/lanzamientos" element={<ArtistReleases />} />
            <Route path="/lanzamientos" element={<ArtistReleases />} />
            <Route path="/artistas/:id" element={<PublicArtistPage />} />
            <Route path="/reproduciendo" element={<FullPlayerWeb />} />
            <Route path="/explorar" element={<Catalog />} />
            <Route path="/explorar/cancion/:id" element={<SongDetail />} />
            <Route path="/conciertos" element={<ConcertsPage />} />
            <Route path="/conciertos/:id" element={<ConcertDetailPage />} />
            <Route path="/organizador/conciertos" element={<OrganizerConcertsPage />} />
            <Route path="/mis-entradas" element={<MyTicketsPage />} />
            <Route path="/estadisticas-musicales" element={<MusicStatsPage />} />
            <Route path="/artista" element={<ArtistMusicLayout />}>
              <Route index element={<ArtistDashboard />} />
              <Route path="publicar" element={<SongEditor key="new-song" />} />
              <Route path="canciones" element={<ArtistSongs />} />
              <Route path="canciones/:id/editar" element={<SongEditor key="edit-song" />} />
            </Route>
            <Route path="/" element={<Landing />} />
            <Route path="/registro" element={<Auth register />} />
            <Route path="/iniciar-sesion" element={<Auth />} />
            <Route path="/recuperar-contrasena" element={<Recovery />} />
            <Route path="/restablecer-contrasena" element={<Recovery reset />} />
            <Route path="/perfil-artistico" element={<ArtistProfilePage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/inicio" element={<Dashboard />} />
            <Route path="*" element={<Auth />} />
          </Routes>
          <MiniPlayerWeb />
        </PlayerProvider>
      </SidebarProvider>
    </BrowserRouter>
  );
}
