import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import {
  AudioLines,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MoveUpRight,
  Search,
  Sparkles,
  Ticket,
  UserRound,
} from 'lucide-react';
import {
  fetchPublicConcerts,
  fetchRecommendedConcerts,
} from '../../shared/concerts-api';
import type {
  PublicConcertSummary,
  ConcertEstadoVenta,
  RecommendedConcertItem,
} from '../../shared/concerts';
import { request, type User } from './auth-api';
import './Concerts.css';

const BOLIVIA_CITIES = [
  'Todas las ciudades',
  'La Paz',
  'Santa Cruz',
  'Cochabamba',
  'Tarija',
  'Chuquisaca / Sucre',
  'Oruro',
  'Potosí',
  'Beni',
  'Pando',
];

export function ConcertsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // Conciertos
  const [featuredConcerts, setFeaturedConcerts] = useState<PublicConcertSummary[]>([]);
  const [concerts, setConcerts] = useState<PublicConcertSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');

  // CU19: Recomendaciones personalizadas para usuario autenticado
  const [recommendedConcerts, setRecommendedConcerts] = useState<RecommendedConcertItem[]>([]);
  const [isPersonalized, setIsPersonalized] = useState(false);

  // Carrusel ref
  const carouselTrackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Cargar usuario para mostrar botón de organizador si corresponde
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await request<User & { roles?: string[] }>('me');
        if (active && me) {
          setCurrentUser(me);
          if (Array.isArray(me.roles)) {
            setUserRoles(me.roles);
          } else if (me.role) {
            setUserRoles([me.role]);
          }
        }
      } catch {
        // Visitante sin autenticación; se mantiene como visitante
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cargar carrusel de destacados
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // Primero intentamos destacados
        const res = await fetchPublicConcerts({ destacados: true, limit: 8 });
        if (active) {
          if (res.items.length > 0) {
            setFeaturedConcerts(res.items);
          } else {
            // Si no hay marcados como destacados, usamos los próximos publicados
            const upcoming = await fetchPublicConcerts({ sort: 'fecha_asc', limit: 8 });
            if (active) setFeaturedConcerts(upcoming.items);
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar el carrusel de destacados:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // CU19: Cargar recomendaciones personalizadas si el usuario está autenticado
  useEffect(() => {
    let active = true;
    if (currentUser) {
      void (async () => {
        try {
          const res = await fetchRecommendedConcerts();
          if (active) {
            setRecommendedConcerts(res.items);
            setIsPersonalized(res.esPersonalizada);
          }
        } catch (e) {
          console.warn('No se pudieron cargar recomendaciones personalizadas:', e);
        }
      })();
    } else {
      setRecommendedConcerts([]);
      setIsPersonalized(false);
    }
    return () => {
      active = false;
    };
  }, [currentUser]);

  // Cargar catálogo según filtros y paginación
  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchPublicConcerts({
          q: searchQuery.trim() || undefined,
          ciudad: selectedCity && selectedCity !== 'Todas las ciudades' ? selectedCity : undefined,
          genero: selectedGenre.trim() || undefined,
          page,
          limit: 12,
          sort: 'fecha_asc',
        });
        if (active) {
          setConcerts(res.items);
          setTotal(res.total);
          setTotalPages(res.totalPages);
          setError('');
        }
      } catch (e: any) {
        if (active) setError(e.message || 'Error al cargar los conciertos.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [searchQuery, selectedCity, selectedGenre, page]);

  // Manejadores de carrusel
  const updateScrollButtons = () => {
    if (!carouselTrackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselTrackRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = carouselTrackRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [featuredConcerts]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!carouselTrackRef.current) return;
    const cardWidth = 340;
    carouselTrackRef.current.scrollBy({
      left: direction === 'left' ? -cardWidth : cardWidth,
      behavior: 'smooth',
    });
  };

  const handleCarouselKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handleScroll('left');
    } else if (e.key === 'ArrowRight') {
      handleScroll('right');
    }
  };

  const formatConcertDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderStatusBadge = (status: ConcertEstadoVenta) => {
    switch (status) {
      case 'VENTA_INICIADA':
        return <span className="concert-status-badge venta-disponible">Venta disponible</span>;
      case 'VENTA_PENDIENTE':
        return <span className="concert-status-badge venta-pendiente">Venta próximamente</span>;
      case 'VENTA_CERRADA':
        return <span className="concert-status-badge venta-cerrada">Venta cerrada</span>;
      default:
        return null;
    }
  };

  const isOrganizador = userRoles.includes('ORGANIZADOR');

  return (
    <div className="concerts-page">
      <SonicSidebar mode="drawer" />
      {/* Header */}
      <header className="concerts-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SidebarToggle />
          <Link className="concerts-brand" to="/conciertos" aria-label="Sonic Ledger">
            <span className="concerts-brand-mark">
              <AudioLines size={22} />
            </span>
            <span>
              sonic<span>ledger</span>.
            </span>
          </Link>
        </div>

        <nav className="concerts-nav" aria-label="Navegación de conciertos">
          <Link to="/explorar" className="concerts-nav-link">
            Música
          </Link>
          <Link to="/conciertos" className="concerts-nav-link active">
            Conciertos
          </Link>
          {currentUser && (
            <>
              <Link to="/mis-entradas" className="concerts-nav-link">
                Mis entradas
              </Link>
              <Link to="/estadisticas-musicales" className="concerts-nav-link">
                Estadísticas
              </Link>
            </>
          )}
          {isOrganizador && (
            <Link to="/organizador/conciertos" className="btn-organizer-panel">
              <Ticket size={16} /> Mis Conciertos
            </Link>
          )}
        </nav>

        <div className="concerts-user-actions">
          {currentUser ? (
            <Link to="/perfil" className="concerts-nav-link" aria-label="Mi perfil">
              <UserRound size={18} /> {currentUser.username}
            </Link>
          ) : (
            <Link to="/iniciar-sesion" className="btn-auth-link">
              Iniciar sesión <MoveUpRight size={14} />
            </Link>
          )}
        </div>
      </header>

      <main className="concerts-shell">
        {/* Hero */}
        <section className="concerts-hero">
          <div className="concerts-badge">
            <span /> EN VIVO Y EN ESCENA
          </div>
          <h1 className="concerts-hero-title">
            Vive tus próximos <span>conciertos</span>.
          </h1>
          <p className="concerts-hero-desc">
            Descubre los mejores festivales y presentaciones en Bolivia. Revisa recintos, artistas y precios reales en un solo lugar.
          </p>
        </section>

        {/* AJUSTE VISUAL CU18: Carrusel horizontal de conciertos destacados */}
        {featuredConcerts.length > 0 && (
          <section
            className="carousel-section"
            aria-label="Conciertos destacados"
            tabIndex={0}
            onKeyDown={handleCarouselKeyDown}
          >
            <div className="carousel-header">
              <div className="carousel-title-group">
                <h2>
                  <Sparkles size={20} color="#ec4899" /> Conciertos destacados
                </h2>
                <p>Eventos imperdibles seleccionados para ti</p>
              </div>
              <div className="carousel-controls">
                <button
                  className="carousel-arrow"
                  onClick={() => handleScroll('left')}
                  disabled={!canScrollLeft}
                  aria-label="Desplazar conciertos hacia la izquierda"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="carousel-arrow"
                  onClick={() => handleScroll('right')}
                  disabled={!canScrollRight}
                  aria-label="Desplazar conciertos hacia la derecha"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="carousel-track-wrapper" ref={carouselTrackRef}>
              <div className="carousel-track">
                {featuredConcerts.map((c) => (
                  <Link
                    to={`/conciertos/${c.id}`}
                    key={c.id}
                    className="carousel-card"
                    aria-label={`Ver concierto ${c.titulo}`}
                  >
                    <div className="carousel-card-cover">
                      <img
                        src={c.portadaUrl || '/images/sonic-concert.webp'}
                        alt={`Portada de ${c.titulo}`}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/sonic-concert.webp';
                        }}
                      />
                      <div className="carousel-card-overlay" />
                      {c.destacado && (
                        <span className="carousel-badge-featured">Destacado</span>
                      )}
                      <span className="carousel-badge-city">
                        <MapPin size={12} /> {c.ciudad}
                      </span>
                    </div>

                    <div className="carousel-card-body">
                      <div className="carousel-card-date">
                        <Calendar size={13} /> {formatConcertDate(c.fechaInicio)}
                      </div>
                      <h3 className="carousel-card-title">{c.titulo}</h3>
                      <div className="carousel-card-venue">
                        <MapPin size={13} /> {c.recinto}
                      </div>

                      <div className="carousel-card-footer">
                        <div className="carousel-price">
                          {c.precioMinimo !== null ? (
                            <>
                              Desde <strong>Bs. {c.precioMinimo}</strong>
                            </>
                          ) : (
                            <span>Entradas por definir</span>
                          )}
                        </div>
                        <span className="carousel-action-btn">Ver concierto</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CU19: Conciertos para ti (Recomendaciones Personalizadas o Próximos Eventos) */}
        {currentUser && recommendedConcerts.length > 0 && (
          <section className="recommendations-section" aria-label="Conciertos recomendados">
            <div className="recommendations-header">
              <div className="recommendations-title-group">
                <h2>
                  <Sparkles size={20} color="#a855f7" />{' '}
                  {isPersonalized ? 'Conciertos para ti' : 'Descubre próximos conciertos'}
                </h2>
                <p>
                  {isPersonalized
                    ? 'Recomendaciones personalizadas según tus preferencias musicales y reproducciones'
                    : 'Explora los eventos en cartelera según las fechas más cercanas'}
                </p>
              </div>
            </div>

            <div className="recommendations-track-wrapper">
              <div className="recommendations-track">
                {recommendedConcerts.map((c) => (
                  <div key={c.id} className="recommendation-card">
                    <div className="recommendation-cover-box">
                      <img
                        src={c.portadaUrl || '/images/sonic-concert.webp'}
                        alt={c.titulo}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/sonic-concert.webp';
                        }}
                      />
                      <span className="carousel-badge-city">
                        <MapPin size={12} /> {c.ciudad}
                      </span>
                      {c.motivosRecomendacion && c.motivosRecomendacion.length > 0 && (
                        <div
                          className="recommendation-reason-chip"
                          title={c.motivosRecomendacion[0]}
                        >
                          <Sparkles size={12} color="#ec4899" />
                          <span>{c.motivosRecomendacion[0]}</span>
                        </div>
                      )}
                    </div>

                    <div className="recommendation-body">
                      <div className="carousel-card-date">
                        <Calendar size={13} /> {formatConcertDate(c.fechaInicio)}
                      </div>
                      <h3 className="recommendation-title">{c.titulo}</h3>

                      {c.artistas && c.artistas.length > 0 && (
                        <div className="recommendation-artists">
                          {c.artistas.map((a) => a.nombreArtista).join(', ')}
                        </div>
                      )}

                      <div className="recommendation-meta">
                        <MapPin size={13} /> {c.recinto}
                      </div>

                      <div className="recommendation-footer">
                        <div className="recommendation-price">
                          {c.precioMinimo !== null ? (
                            <>
                              Desde <strong>Bs. {c.precioMinimo}</strong>
                            </>
                          ) : (
                            <span>Entrada libre</span>
                          )}
                        </div>

                        <Link to={`/conciertos/${c.id}`} className="btn-view-recommendation">
                          Ver concierto <MoveUpRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Catálogo completo con buscador y filtros */}
        <section className="catalog-section" aria-labelledby="all-concerts-title">
          <div className="catalog-search-bar">
            <div className="search-input-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Buscar por concierto, artista, recinto o ciudad..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Buscar conciertos"
              />
            </div>

            <select
              className="search-select"
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por ciudad"
            >
              {BOLIVIA_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <input
              className="search-select"
              type="text"
              placeholder="Género (Rock, Metal, etc.)..."
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por género musical"
            />
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          {/* Grid de Conciertos */}
          {loading ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Ticket size={28} />
              </div>
              <h3>Cargando conciertos...</h3>
              <p>Consultando eventos disponibles en tiempo real.</p>
            </div>
          ) : concerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Ticket size={28} />
              </div>
              <h3>No se encontraron conciertos</h3>
              <p>
                No hay eventos que coincidan con tus criterios de búsqueda. Prueba cambiando la ciudad o el término de búsqueda.
              </p>
            </div>
          ) : (
            <>
              <div className="concerts-grid">
                {concerts.map((c) => (
                  <Link
                    to={`/conciertos/${c.id}`}
                    key={c.id}
                    className="concert-grid-card"
                  >
                    <div className="concert-grid-cover">
                      <img
                        src={c.portadaUrl || '/images/sonic-concert.webp'}
                        alt={`Portada de ${c.titulo}`}
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/sonic-concert.webp';
                        }}
                      />
                      {renderStatusBadge(c.estadoVenta)}
                    </div>

                    <div className="concert-grid-body">
                      <div className="concert-grid-date">
                        {formatConcertDate(c.fechaInicio)}
                      </div>
                      <h3 className="concert-grid-title">{c.titulo}</h3>
                      <div className="concert-grid-location">
                        <MapPin size={13} /> {c.recinto}, {c.ciudad}
                      </div>

                      <div className="concert-grid-footer">
                        <div className="concert-grid-price">
                          {c.precioMinimo !== null ? (
                            <>
                              Desde <strong>Bs. {c.precioMinimo}</strong>
                            </>
                          ) : (
                            <span>Precio a definir</span>
                          )}
                        </div>
                        <span className="btn-view-details">Ver detalles</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="pagination-row">
                  <button
                    className="btn-pagination"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {page} de {totalPages} ({total} eventos)
                  </span>
                  <button
                    className="btn-pagination"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
