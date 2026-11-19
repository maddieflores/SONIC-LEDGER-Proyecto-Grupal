import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import {
  ArrowLeft,
  AudioLines,
  BarChart3,
  Clock,
  Compass,
  Headphones,
  Music,
  Music2,
  Sparkles,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import { fetchMusicalStats } from '../../shared/history-api';
import type { MusicalStatsResponse, StatsPeriodo } from '../../shared/history';
import { request, type User } from './auth-api';
import './MusicStats.css';

export function MusicStatsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [periodo, setPeriodo] = useState<StatsPeriodo>('30d');
  const [stats, setStats] = useState<MusicalStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Verificar autenticación
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await request<User>('me');
        if (active && me) setCurrentUser(me);
      } catch {
        if (active) navigate('/iniciar-sesion?redirect=/estadisticas-musicales');
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  // 2. Cargar estadísticas musicales
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const data = await fetchMusicalStats(periodo);
        if (active) {
          setStats(data);
          setError('');
        }
      } catch (e: any) {
        if (active) setError(e.message || 'Error al obtener las estadísticas musicales.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [periodo]);

  const maxDailyPlays =
    stats && stats.actividadDiaria.length > 0
      ? Math.max(1, ...stats.actividadDiaria.map((d) => d.reproducciones))
      : 1;

  return (
    <div className="music-stats-page">
      <SonicSidebar mode="drawer" />
      {/* Header Bar */}
      <header className="concerts-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SidebarToggle />
          <Link className="concerts-brand" to="/estadisticas-musicales" aria-label="Sonic Ledger">
            <span className="concerts-brand-mark">
              <AudioLines size={22} />
            </span>
            <span>
              sonic<span>ledger</span>.
            </span>
          </Link>
        </div>

        <nav className="concerts-nav" aria-label="Navegación">
          <Link to="/explorar" className="concerts-nav-link">
            Música
          </Link>
          <Link to="/conciertos" className="concerts-nav-link">
            Conciertos
          </Link>
          <Link to="/mis-entradas" className="concerts-nav-link">
            Mis entradas
          </Link>
          <Link to="/estadisticas-musicales" className="concerts-nav-link active">
            Estadísticas
          </Link>
        </nav>

        <div className="concerts-user-actions">
          {currentUser && (
            <Link to="/perfil" className="concerts-nav-link" aria-label="Mi perfil">
              <UserRound size={18} /> {currentUser.username}
            </Link>
          )}
        </div>
      </header>

      <main className="stats-page-shell">
        {/* Fila Superior de Título y Selector de Periodo */}
        <div className="stats-header-row">
          <div className="stats-title-group">
            <Link
              to="/explorar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#c084fc',
                fontSize: '0.88rem',
                textDecoration: 'none',
                fontWeight: 600,
                marginBottom: '6px',
              }}
            >
              <ArrowLeft size={14} /> Volver al catálogo musical
            </Link>
            <h1>
              Mis <span>Estadísticas Musicales</span>
            </h1>
            <p>
              Análisis de tu actividad real de escucha, géneros más recurrentes y artistas predilectos.
            </p>
          </div>

          <div className="period-selector">
            <button
              className={`period-pill ${periodo === '7d' ? 'active' : ''}`}
              onClick={() => setPeriodo('7d')}
            >
              7 Días
            </button>
            <button
              className={`period-pill ${periodo === '30d' ? 'active' : ''}`}
              onClick={() => setPeriodo('30d')}
            >
              30 Días
            </button>
            <button
              className={`period-pill ${periodo === 'all' ? 'active' : ''}`}
              onClick={() => setPeriodo('all')}
            >
              Historial Completo
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#cdbedb' }}>
            <p>Calculando tus métricas y rankings musicales...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              padding: '20px',
              borderRadius: '16px',
              color: '#fca5a5',
              marginBottom: '24px',
            }}
          >
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && stats && stats.totalReproduccionesValidas === 0 && (
          <div className="stats-empty-box">
            <div className="stats-empty-icon">
              <Headphones size={32} />
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '0 0 8px' }}>
              Sin reproducciones en este periodo
            </h3>
            <p style={{ color: '#cdbedb', maxWidth: '440px', margin: '0 auto' }}>
              {stats.mensaje ||
                'No registraste escuchas válidas de más de 30 segundos en este periodo. Comienza a reproducir música para descubrir tus estadísticas.'}
            </p>
            <Link to="/explorar" className="btn-start-listening">
              <Sparkles size={16} /> Explorar Catálogo Musical
            </Link>
          </div>
        )}

        {/* Métricas con Datos */}
        {!loading && !error && stats && stats.totalReproduccionesValidas > 0 && (
          <>
            {/* KPI Cards Row */}
            <div className="stats-kpi-row">
              {/* KPI 1: Tiempo Total Escuchado */}
              <div className="kpi-card">
                <div className="kpi-icon-box">
                  <Clock size={20} />
                </div>
                <span className="kpi-label">Tiempo Escuchado</span>
                <div className="kpi-value" style={{ color: '#38bdf8' }}>
                  {stats.horasEscuchadas >= 1
                    ? `${stats.horasEscuchadas} h`
                    : `${stats.minutosEscuchados} min`}
                </div>
                <span className="kpi-sub">
                  {stats.segundosEscuchados.toLocaleString('es-BO')} segundos efectivos
                </span>
              </div>

              {/* KPI 2: Reproducciones Válidas */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ color: '#4ade80', background: 'rgba(74, 222, 128, 0.15)' }}>
                  <Headphones size={20} />
                </div>
                <span className="kpi-label">Reproducciones</span>
                <div className="kpi-value" style={{ color: '#4ade80' }}>
                  {stats.totalReproduccionesValidas}
                </div>
                <span className="kpi-sub">Solo reproducciones válidas (≥ 30s)</span>
              </div>

              {/* KPI 3: Canciones Únicas */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.15)' }}>
                  <Music2 size={20} />
                </div>
                <span className="kpi-label">Canciones Únicas</span>
                <div className="kpi-value" style={{ color: '#ec4899' }}>
                  {stats.cancionesUnicas}
                </div>
                <span className="kpi-sub">Pistas distintas reproducidas</span>
              </div>

              {/* KPI 4: Artistas Únicos */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)' }}>
                  <Users size={20} />
                </div>
                <span className="kpi-label">Artistas Únicos</span>
                <div className="kpi-value" style={{ color: '#c084fc' }}>
                  {stats.artistasUnicos}
                </div>
                <span className="kpi-sub">Creadores locales y de Audius</span>
              </div>

              {/* KPI 5: Género Favorito */}
              <div className="kpi-card">
                <div className="kpi-icon-box" style={{ color: '#fef08a', background: 'rgba(254, 240, 138, 0.15)' }}>
                  <Compass size={20} />
                </div>
                <span className="kpi-label">Género Predilecto</span>
                <div
                  className="kpi-value"
                  style={{
                    color: '#fef08a',
                    fontSize: stats.generoMasEscuchado && stats.generoMasEscuchado.length > 10 ? '1.4rem' : '1.85rem',
                  }}
                >
                  {stats.generoMasEscuchado || 'Varios'}
                </div>
                <span className="kpi-sub">Mayor porcentaje de escuchas</span>
              </div>
            </div>

            {/* Dos Columnas: Top Canciones y Top Artistas */}
            <div className="stats-columns-grid">
              {/* Columna Izquierda: Top 5 Canciones */}
              <div className="stats-card-panel">
                <div className="panel-header">
                  <h3 className="panel-title">
                    <Trophy size={18} color="#fef08a" /> Top 5 Canciones
                  </h3>
                  <span style={{ color: '#a797be', fontSize: '0.8rem' }}>Más escuchadas</span>
                </div>

                <div className="ranking-list">
                  {stats.topCanciones.map((cancion, idx) => (
                    <div key={cancion.trackId} className="ranking-item">
                      <span className="rank-badge">#{idx + 1}</span>

                      {cancion.coverUrl ? (
                        <img
                          src={cancion.coverUrl}
                          alt={cancion.titulo}
                          className="ranking-cover"
                        />
                      ) : (
                        <div className="ranking-cover-placeholder">
                          <Music size={18} />
                        </div>
                      )}

                      <div className="ranking-info">
                        <div className="ranking-title" title={cancion.titulo}>
                          {cancion.titulo}
                        </div>
                        <div className="ranking-subtitle">{cancion.artista}</div>
                      </div>

                      <div className="ranking-metric">
                        {cancion.reproducciones}
                        <span>{cancion.minutosEscuchados} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Columna Derecha: Top 5 Artistas y Top Géneros */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Top Artistas */}
                <div className="stats-card-panel">
                  <div className="panel-header">
                    <h3 className="panel-title">
                      <Users size={18} color="#a855f7" /> Top 5 Artistas
                    </h3>
                    <span style={{ color: '#a797be', fontSize: '0.8rem' }}>Por reproducciones</span>
                  </div>

                  <div className="ranking-list">
                    {stats.topArtistas.map((art, idx) => (
                      <div key={art.nombre} className="ranking-item">
                        <span className="rank-badge">#{idx + 1}</span>
                        <div className="ranking-info">
                          <div className="ranking-title">{art.nombre}</div>
                          <div className="ranking-subtitle">{art.minutosEscuchados} min escuchados</div>
                        </div>
                        <div className="ranking-metric">
                          {art.reproducciones}
                          <span>reproducciones</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Géneros con Barras de Progreso */}
                <div className="stats-card-panel">
                  <div className="panel-header">
                    <h3 className="panel-title">
                      <Sparkles size={18} color="#ec4899" /> Distribución de Géneros
                    </h3>
                  </div>

                  {stats.topGeneros.length === 0 ? (
                    <p style={{ color: '#cdbedb', margin: 0, fontSize: '0.9rem' }}>
                      Metadatos de género no disponibles para este periodo.
                    </p>
                  ) : (
                    stats.topGeneros.map((gen) => (
                      <div key={gen.nombre} className="genre-row">
                        <div className="genre-header">
                          <strong>{gen.nombre}</strong>
                          <span>
                            {gen.reproducciones} ({gen.porcentaje}%)
                          </span>
                        </div>
                        <div className="genre-bar-bg">
                          <div
                            className="genre-bar-fill"
                            style={{ width: `${Math.min(100, Math.max(5, gen.porcentaje))}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Gráfico de Actividad Diaria Continua */}
            <div className="activity-chart-panel">
              <div className="panel-header">
                <h3 className="panel-title">
                  <BarChart3 size={18} color="#38bdf8" /> Actividad Musical Diaria
                </h3>
                <span style={{ color: '#cdbedb', fontSize: '0.85rem' }}>
                  Reproducciones por día en el periodo seleccionado ({stats.periodoLabel})
                </span>
              </div>

              <div className="activity-bars-container">
                {stats.actividadDiaria.map((dia) => {
                  const barHeightPct =
                    dia.reproducciones > 0
                      ? Math.max(10, Math.round((dia.reproducciones / maxDailyPlays) * 100))
                      : 4;

                  return (
                    <div
                      key={dia.fecha}
                      className="activity-bar-col"
                      title={`${dia.fecha} (${dia.diaSemana}): ${dia.reproducciones} reproducciones, ${dia.minutosEscuchados} min`}
                    >
                      <div
                        className="activity-bar-pillar"
                        style={{ height: `${barHeightPct}%` }}
                      />
                      <span className="activity-bar-label">{dia.diaSemana}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
