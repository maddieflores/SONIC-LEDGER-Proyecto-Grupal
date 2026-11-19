import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import {
  ArrowLeft,
  Ban,
  Calendar,
  CheckCircle,
  Info,
  MapPin,
  Minus,
  Music2,
  Plus,
  ShoppingBag,
  Ticket,
  UserRound,
  X,
} from 'lucide-react';
import { fetchPublicConcertDetail } from '../../shared/concerts-api';
import type { Concert, ConcertEstadoVenta } from '../../shared/concerts';
import {
  crearReservaOrden,
  procesarPagoPrueba,
} from '../../shared/ticketing-api';
import type { OrdenCompra, TicketDigital } from '../../shared/ticketing';
import { request, type User } from './auth-api';
import './ConcertDetail.css';

export function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [concert, setConcert] = useState<Concert | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selección de entradas
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<OrdenCompra | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [issuedTickets, setIssuedTickets] = useState<TicketDigital[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await request<User>('me');
        if (active) setCurrentUser(me);
      } catch {
        // Visitante anónimo
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    void (async () => {
      try {
        const data = await fetchPublicConcertDetail(id);
        if (active) {
          setConcert(data);
          setError('');
          if (data.categorias && data.categorias.length > 0) {
            setSelectedCatId(data.categorias[0].id);
          }
        }
      } catch (e: any) {
        if (active) setError(e.message || 'No se pudo cargar el concierto.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const selectedCategory = concert?.categorias?.find((c) => c.id === selectedCatId);
  const unitPrice = selectedCategory ? Number(selectedCategory.precio) : 0;
  const totalPrice = unitPrice * quantity;

  const handleStartPurchase = async () => {
    if (!currentUser) {
      // Guardar intención y redirigir al login
      navigate(`/iniciar-sesion?redirect=/conciertos/${id}`);
      return;
    }

    if (!selectedCategory || !id) return;
    setCheckoutError('');
    setCheckoutLoading(true);

    try {
      const order = await crearReservaOrden({
        conciertoId: id,
        categoriaId: selectedCategory.id,
        cantidad: quantity,
      });
      setActiveOrder(order);
      setIssuedTickets([]);
      setIsCheckoutOpen(true);
    } catch (e: any) {
      setCheckoutError(e.message || 'Error al reservar entradas.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSimulatePayment = async (status: 'APROBADO' | 'RECHAZADO') => {
    if (!activeOrder) return;
    setCheckoutError('');
    setCheckoutLoading(true);

    try {
      const res = await procesarPagoPrueba({
        ordenId: activeOrder.id,
        simularResultado: status,
      });

      if (status === 'APROBADO') {
        setActiveOrder(res.orden);
        setIssuedTickets(res.tickets);
      }
    } catch (e: any) {
      setCheckoutError(e.message || 'Error al procesar el pago.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-BO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderSalesStatusBadge = (status: ConcertEstadoVenta) => {
    if (concert?.estado === 'CANCELADO') {
      return (
        <span
          className="concert-status-badge venta-cerrada"
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            borderColor: '#ef4444',
            color: '#fca5a5',
          }}
        >
          Concierto Cancelado
        </span>
      );
    }

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

  if (loading) {
    return (
      <div className="concert-detail-page">
        <div className="concerts-shell" style={{ paddingTop: '80px', textAlign: 'center' }}>
          <p>Cargando información del concierto...</p>
        </div>
      </div>
    );
  }

  if (error || !concert) {
    return (
      <div className="concert-detail-page">
        <div className="concerts-shell" style={{ paddingTop: '80px', textAlign: 'center' }}>
          <h2>Concierto no encontrado</h2>
          <p style={{ color: '#cdbedb', margin: '16px 0 24px' }}>
            {error || 'El concierto solicitado no existe o no se encuentra publicado.'}
          </p>
          <Link to="/conciertos" className="btn-back-conciertos">
            <ArrowLeft size={16} /> Volver a Conciertos
          </Link>
        </div>
      </div>
    );
  }

  const isSaleOpen = concert.estado !== 'CANCELADO' && concert.estadoVenta === 'VENTA_INICIADA';

  return (
    <div className="concert-detail-page">
      <SonicSidebar mode="drawer" />
      {/* Portada panorámica */}
      <div className="concert-banner-wrapper">
        <img
          src={concert.portadaUrl || '/images/sonic-concert.webp'}
          alt={`Portada de ${concert.titulo}`}
          className="concert-banner-img"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/images/sonic-concert.webp';
          }}
        />
        <div className="concert-banner-overlay" />

        <div className="concert-banner-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <SidebarToggle />
          <Link to="/conciertos" className="btn-back-conciertos">
            <ArrowLeft size={16} /> Explorar conciertos
          </Link>
          {currentUser && (
            <Link to="/mis-entradas" className="btn-back-conciertos" style={{ marginLeft: '12px' }}>
              <Ticket size={16} /> Mis entradas
            </Link>
          )}
        </div>

        <div className="concert-banner-content concerts-shell">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {concert.genero && (
              <span className="concerts-badge">
                <span /> {concert.genero}
              </span>
            )}
            {renderSalesStatusBadge(concert.estadoVenta)}
          </div>

          <h1 className="concert-title-huge">{concert.titulo}</h1>

          <div className="concert-meta-row">
            <span className="concert-meta-item">
              <Calendar size={18} color="#ec4899" />
              {formatDateTime(concert.fechaInicio)}
            </span>
            <span className="concert-meta-item">
              <MapPin size={18} color="#38bdf8" />
              {concert.recinto}, {concert.ciudad}
            </span>
            <span className="concert-meta-item">
              <UserRound size={18} color="#a855f7" />
              Organizado por {concert.organizadorNombre}
            </span>
          </div>
        </div>
      </div>

      {/* CU17: Banner de Cancelación si el evento fue cancelado */}
      {concert.estado === 'CANCELADO' && (
        <div className="concerts-shell" style={{ marginTop: '24px', marginBottom: '8px' }}>
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.45)',
              borderRadius: '16px',
              padding: '22px 26px',
              color: '#fca5a5',
              boxShadow: '0 8px 30px rgba(239, 68, 68, 0.15)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#ef4444',
                marginBottom: '8px',
              }}
            >
              <Ban size={24} /> Concierto Cancelado por el Organizador
            </div>
            <p style={{ margin: '0 0 6px', color: '#fff', fontSize: '0.98rem' }}>
              <strong>Motivo oficial:</strong> {concert.motivoCancelacion || 'Cancelado por razones de fuerza mayor.'}
            </p>
            {concert.canceladoEn && (
              <p style={{ margin: '0 0 10px', color: '#f87171', fontSize: '0.85rem' }}>
                Fecha de cancelación: {formatDateTime(concert.canceladoEn)}
              </p>
            )}
            <p style={{ margin: 0, color: '#fecaca', fontSize: '0.88rem', lineHeight: 1.5 }}>
              La venta de entradas está cerrada definitivamente. Todas las entradas adquiridas han sido invalidadas y ningún código QR autoriza el ingreso al recinto. Las órdenes confirmadas se encuentran en proceso de devolución.
            </p>
          </div>
        </div>
      )}

      <div className="concerts-shell concert-detail-grid">
        {/* Columna principal */}
        <div>
          {/* Artistas participantes */}
          {concert.artistas && concert.artistas.length > 0 && (
            <section className="concert-section">
              <h2>
                <Music2 size={20} color="#a855f7" /> Artistas en el escenario
              </h2>
              <div className="artists-list">
                {concert.artistas.map((art) => (
                  <div key={art.id} className="artist-pill">
                    {art.avatarUrl ? (
                      <img
                        src={art.avatarUrl}
                        alt={art.nombreArtista}
                        className="artist-avatar"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="artist-avatar" style={{ display: 'grid', placeItems: 'center' }}>
                        <UserRound size={16} />
                      </div>
                    )}
                    <span>{art.nombreArtista}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Descripción */}
          <section className="concert-section">
            <h2>
              <Info size={20} color="#38bdf8" /> Acerca del evento
            </h2>
            <div className="concert-desc-text">
              {concert.descripcion || 'Sin descripción detallada por el momento.'}
            </div>
          </section>

          {/* Ubicación detallada */}
          <section className="concert-section">
            <h2>
              <MapPin size={20} color="#ec4899" /> Ubicación y Recinto
            </h2>
            <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#fff', fontSize: '1.1rem' }}>
              {concert.recinto}
            </p>
            <p style={{ margin: '0 0 6px', color: '#cdbedb' }}>
              Dirección: {concert.direccion}
            </p>
            <p style={{ margin: 0, color: '#a797be', fontSize: '0.9rem' }}>
              {concert.ciudad}, {concert.departamento} • Zona horaria: {concert.zonaHoraria}
            </p>
          </section>
        </div>

        {/* Sidebar Entradas y Compra (CU20) */}
        <aside className="tickets-sidebar">
          <section className="concert-section">
            <h2>
              <Ticket size={20} color="#38bdf8" /> Selección de Entradas
            </h2>

            {checkoutError && (
              <div className="alert-message alert-error" style={{ marginBottom: '14px' }}>
                {checkoutError}
              </div>
            )}

            {concert.categorias && concert.categorias.length > 0 ? (
              <>
                <div style={{ marginBottom: '14px' }}>
                  {concert.categorias.map((cat) => {
                    const isSelected = selectedCatId === cat.id;
                    const isAvailable =
                      concert.estado !== 'CANCELADO' && cat.disponible && cat.cupoDisponible > 0;

                    return (
                      <div
                        key={cat.id}
                        className={`ticket-card ${isAvailable ? 'selectable' : ''} ${
                          isSelected ? 'selected' : ''
                        }`}
                        onClick={() => isAvailable && setSelectedCatId(cat.id)}
                      >
                        <div>
                          <h3 className="ticket-name">{cat.nombre}</h3>
                          <div className="ticket-quota">
                            {concert.estado === 'CANCELADO'
                              ? 'Cancelado'
                              : isAvailable
                              ? `Cupos disponibles: ${cat.cupoDisponible}`
                              : 'Agotado'}
                          </div>
                        </div>
                        <div className="ticket-price-box">
                          <span className="ticket-price">Bs. {cat.precio}</span>
                          <span className="ticket-currency">{cat.moneda}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selector de cantidad */}
                {selectedCategory && isSaleOpen && (
                  <>
                    <div className="qty-control-row">
                      <span style={{ color: '#cdbedb', fontSize: '0.95rem' }}>Cantidad:</span>
                      <div className="qty-buttons">
                        <button
                          type="button"
                          className="btn-qty"
                          disabled={quantity <= 1}
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="qty-display">{quantity}</span>
                        <button
                          type="button"
                          className="btn-qty"
                          disabled={quantity >= Math.min(10, selectedCategory.cupoDisponible)}
                          onClick={() =>
                            setQuantity((q) =>
                              Math.min(10, selectedCategory.cupoDisponible, q + 1),
                            )
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="total-summary-row">
                      <span className="total-summary-label">Total a pagar:</span>
                      <span className="total-summary-price">Bs. {totalPrice} BOB</span>
                    </div>

                    <button
                      className="btn-buy-active"
                      onClick={handleStartPurchase}
                      disabled={checkoutLoading}
                    >
                      <ShoppingBag size={18} />
                      {currentUser ? 'Comprar entradas' : 'Iniciar sesión para comprar'}
                    </button>
                  </>
                )}

                {!isSaleOpen && (
                  <button className="btn-buy-soon" disabled aria-disabled="true">
                    {concert.estado === 'CANCELADO'
                      ? 'Concierto cancelado — Venta cerrada'
                      : concert.estadoVenta === 'VENTA_PENDIENTE'
                      ? 'Venta próximamente'
                      : 'Venta cerrada'}
                  </button>
                )}
              </>
            ) : (
              <p style={{ color: '#a797be' }}>No hay categorías de entrada publicadas aún.</p>
            )}
          </section>
        </aside>
      </div>

      {/* Modal de Checkout / Pago de Prueba (CU20) */}
      {isCheckoutOpen && activeOrder && (
        <div className="checkout-modal-backdrop">
          <div className="checkout-modal-card">
            <button
              className="modal-close-btn"
              onClick={() => setIsCheckoutOpen(false)}
              aria-label="Cerrar modal"
            >
              <X size={20} />
            </button>

            {issuedTickets.length > 0 ? (
              /* Pantalla de Confirmación de Compra */
              <div className="checkout-success-view">
                <div className="checkout-test-notice" style={{ marginBottom: '14px' }}>
                  Modo demostración — Sin cargos ni devoluciones reales
                </div>
                <div className="success-check-icon">
                  <CheckCircle size={36} />
                </div>
                <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Compra confirmada</h2>
                <p style={{ color: '#cdbedb', margin: '0 0 20px', fontSize: '0.95rem' }}>
                  Tus entradas para <strong>{concert.titulo}</strong> han sido emitidas exitosamente.
                </p>

                <div className="checkout-order-summary">
                  <div className="checkout-summary-line">
                    <span>Nº Operación:</span>
                    <strong>{activeOrder.operacionId}</strong>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Entradas emitidas:</span>
                    <strong>{issuedTickets.length} ticket(s)</strong>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Total:</span>
                    <strong>Bs. {activeOrder.total} BOB</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    className="btn-confirm-payment"
                    style={{ flex: 1 }}
                    onClick={() => navigate('/mis-entradas')}
                  >
                    Ver mis entradas y QR
                  </button>
                </div>
              </div>
            ) : (
              /* Pantalla de Checkout */
              <div>
                <div className="checkout-test-notice">
                  Modo demostración — Sin cargos ni devoluciones reales
                </div>

                <h2 style={{ color: '#fff', margin: '0 0 16px', fontSize: '1.4rem' }}>
                  Resumen de compra
                </h2>

                {checkoutError && (
                  <div className="alert-message alert-error" style={{ marginBottom: '16px' }}>
                    {checkoutError}
                  </div>
                )}

                <div className="checkout-order-summary">
                  <div className="checkout-summary-line">
                    <span>Concierto:</span>
                    <strong>{concert.titulo}</strong>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Categoría:</span>
                    <strong>{selectedCategory?.nombre}</strong>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Cantidad:</span>
                    <strong>{quantity} entrada(s)</strong>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Precio unitario:</span>
                    <strong>Bs. {unitPrice} BOB</strong>
                  </div>
                  <div
                    className="checkout-summary-line"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}
                  >
                    <span>Total:</span>
                    <strong style={{ color: '#38bdf8', fontSize: '1.15rem' }}>
                      Bs. {totalPrice} BOB
                    </strong>
                  </div>
                </div>

                <p style={{ color: '#a797be', fontSize: '0.82rem', marginBottom: '14px' }}>
                  El cupo se encuentra reservado temporalmente por 15 minutos mientras completas tu compra.
                </p>

                <button
                  type="button"
                  className="btn-confirm-payment"
                  disabled={checkoutLoading}
                  onClick={() => handleSimulatePayment('APROBADO')}
                >
                  {checkoutLoading ? 'Confirmando...' : 'Comprar entradas'}
                </button>

                <button
                  type="button"
                  className="btn-reject-simulated"
                  disabled={checkoutLoading}
                  onClick={() => handleSimulatePayment('RECHAZADO')}
                >
                  Probar con pago rechazado
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
