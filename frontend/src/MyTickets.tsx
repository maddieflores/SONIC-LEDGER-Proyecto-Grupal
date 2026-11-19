import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import {
  AudioLines,
  Calendar,
  MapPin,
  MoveUpRight,
  QrCode,
  Ticket,
  UserRound,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { listarMisTickets } from '../../shared/ticketing-api';
import type { TicketDigital, TicketEstado } from '../../shared/ticketing';
import { request, type User } from './auth-api';
import './MyTickets.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function MyTicketsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [tickets, setTickets] = useState<TicketDigital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketDigital | null>(null);

  // Cargar usuario
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
        // No autenticado
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Cargar tickets del usuario
  const loadTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listarMisTickets(undefined, API_BASE);
      setTickets(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus entradas. Verifica tu sesión.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, []);

  const formatDateTime = (dateStr: string) => {
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

  const renderStatusBadge = (estado: TicketEstado, cancelado?: boolean) => {
    if (cancelado) {
      return (
        <span
          className="ticket-status-pill invalidado"
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            borderColor: '#ef4444',
            color: '#fca5a5',
          }}
        >
          Cancelado
        </span>
      );
    }

    switch (estado) {
      case 'VIGENTE':
        return <span className="ticket-status-pill vigente">Vigente</span>;
      case 'UTILIZADO':
        return <span className="ticket-status-pill utilizado">Utilizado</span>;
      case 'INVALIDADO':
        return <span className="ticket-status-pill invalidado">Invalidado</span>;
      default:
        return <span className="ticket-status-pill">{estado}</span>;
    }
  };

  const isOrganizador = userRoles.includes('ORGANIZADOR');

  return (
    <div className="my-tickets-page">
      <SonicSidebar mode="drawer" />
      {/* Header */}
      <header className="concerts-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SidebarToggle />
          <Link className="concerts-brand" to="/mis-entradas" aria-label="Sonic Ledger">
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
          <Link to="/mis-entradas" className="concerts-nav-link active">
            Mis entradas
          </Link>
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

      <main className="concerts-shell" style={{ paddingTop: '40px' }}>
        <div className="tickets-header-row">
          <div>
            <div className="concerts-badge">
              <span /> TICKETS DIGITALES
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#fff', margin: '8px 0 4px' }}>
              Mis <span style={{ color: '#c084fc' }}>Entradas</span>
            </h1>
            <p style={{ color: '#cdbedb', fontSize: '0.95rem' }}>
              Gestiona tus accesos digitales, revisa el estado de validez y presenta tu QR en puerta.
            </p>
          </div>
          <button
            onClick={() => void loadTickets()}
            className="btn-refresh-tickets"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#f1ecf7',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#cdbedb' }}>
            <p>Cargando tus entradas digitales...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '24px',
              borderRadius: '16px',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              margin: '20px 0',
            }}
          >
            <AlertCircle size={28} />
            <div>
              <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Error al obtener entradas</p>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && tickets.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '70px 20px',
              background: '#120c24',
              borderRadius: '24px',
              border: '1px dashed rgba(139, 92, 246, 0.3)',
              margin: '30px 0',
            }}
          >
            <Ticket size={48} style={{ color: '#a855f7', opacity: 0.7, marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              No tienes entradas emitidas aún
            </h3>
            <p style={{ color: '#cdbedb', maxWidth: '420px', margin: '0 auto 24px' }}>
              Explora la cartelera de conciertos y asegura tu lugar en los mejores espectáculos en vivo.
            </p>
            <Link
              to="/conciertos"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                color: '#fff',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Explorar Conciertos <MoveUpRight size={16} />
            </Link>
          </div>
        )}

        {/* Tickets Grid */}
        {!loading && !error && tickets.length > 0 && (
          <div className="tickets-grid">
            {tickets.map((t) => (
              <div key={t.id} className="ticket-digital-card">
                <div className="ticket-cover-header">
                  {t.conciertoPortadaUrl ? (
                    <img src={t.conciertoPortadaUrl} alt={t.conciertoTitulo} />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #3b0764 0%, #1e1b4b 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ticket size={40} style={{ color: '#c084fc', opacity: 0.5 }} />
                    </div>
                  )}
                  {renderStatusBadge(t.estado, t.conciertoCancelado)}
                </div>

                <div className="ticket-card-content">
                  <div className="ticket-code-tag">{t.codigoPublico}</div>
                  <h3 className="ticket-event-title">
                    {t.conciertoTitulo || 'Concierto Sonic Ledger'}
                  </h3>

                  {t.conciertoCancelado && (
                    <div
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        color: '#fca5a5',
                        marginBottom: '8px',
                      }}
                    >
                      <div>
                        <strong>Concierto cancelado</strong>
                        {t.motivoCancelacion ? `: ${t.motivoCancelacion}` : ''}
                      </div>
                      {t.reembolsoEstado === 'PENDIENTE_REEMBOLSO' && (
                        <div style={{ color: '#fecaca', fontWeight: 700, marginTop: '2px' }}>
                          • Devolución: Pendiente de reembolso
                        </div>
                      )}
                    </div>
                  )}

                  {t.fechaInicio && (
                    <div className="ticket-info-line">
                      <Calendar size={14} style={{ color: '#c084fc' }} />
                      <span>{formatDateTime(t.fechaInicio)}</span>
                    </div>
                  )}

                  {t.recinto && (
                    <div className="ticket-info-line">
                      <MapPin size={14} style={{ color: '#ec4899' }} />
                      <span>
                        {t.recinto} ({t.ciudad})
                      </span>
                    </div>
                  )}

                  <div className="ticket-category-box">
                    <span className="ticket-category-name">
                      {t.categoriaNombre || 'General'}
                    </span>
                    <span className="ticket-category-price">
                      {t.precio != null
                        ? `${Number(t.precio).toFixed(2)} ${t.moneda || 'BOB'}`
                        : 'Acceso'}
                    </span>
                  </div>

                  <button
                    className="btn-show-qr"
                    onClick={() => setSelectedTicket(t)}
                    aria-label={`Ver código QR para ${t.codigoPublico}`}
                  >
                    <QrCode size={18} /> Mostrar QR de Ingreso
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* QR Modal (CU21) */}
      {selectedTicket && (
        <div className="qr-modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div className="qr-modal-ticket" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedTicket(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Cerrar modal de QR"
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              {renderStatusBadge(selectedTicket.estado, selectedTicket.conciertoCancelado)}
            </div>

            <h3
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#fff',
                margin: '8px 0 4px',
              }}
            >
              {selectedTicket.conciertoTitulo || 'Entrada Concierto'}
            </h3>

            <p style={{ color: '#cdbedb', fontSize: '0.85rem', margin: '0 0 12px' }}>
              {selectedTicket.categoriaNombre} • {selectedTicket.ciudad}
            </p>

            {/* Aviso si está cancelado */}
            {(selectedTicket.conciertoCancelado || selectedTicket.estado === 'INVALIDADO') && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  margin: '10px 0 14px',
                  color: '#fca5a5',
                  textAlign: 'left',
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: '#ef4444', display: 'block', marginBottom: '3px' }}>
                  Concierto cancelado
                </strong>
                El evento ha sido cancelado por el organizador. Este código QR no autoriza el ingreso.
                <div style={{ margin: '8px 0 0', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#f3e8ff', marginBottom: '2px' }}>Estado de devolución:</div>
                  <div style={{ color: '#fed7aa', fontSize: '0.85rem' }}>
                    {selectedTicket.reembolsoEstado === 'REEMBOLSADO'
                      ? `Devolución completada (${selectedTicket.precio ? `Bs. ${Number(selectedTicket.precio).toFixed(2)}` : ''})`
                      : selectedTicket.reembolsoEstado === 'REEMBOLSO_PARCIAL'
                      ? 'Devolución parcial procesada'
                      : `Pendiente de procesamiento (${selectedTicket.precio ? `Bs. ${Number(selectedTicket.precio).toFixed(2)}` : ''})`}
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: '0.75rem',
                color: '#c084fc',
                background: 'rgba(192, 132, 252, 0.1)',
                padding: '4px 10px',
                borderRadius: '8px',
                marginBottom: '10px',
              }}
            >
              Modo demostración — Sin cargos ni devoluciones reales
            </div>

            {/* QR de Alto Contraste */}
            <div className="qr-display-box">
              {selectedTicket.qrCodeDataUrl ? (
                <img
                  src={selectedTicket.qrCodeDataUrl}
                  alt={`Código QR ${selectedTicket.codigoPublico}`}
                  className="qr-image-render"
                  style={
                    selectedTicket.conciertoCancelado || selectedTicket.estado === 'INVALIDADO'
                      ? { filter: 'grayscale(100%) opacity(0.5)' }
                      : undefined
                  }
                />
              ) : (
                <div
                  style={{
                    width: '220px',
                    height: '220px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    fontSize: '0.8rem',
                  }}
                >
                  QR no disponible
                </div>
              )}
            </div>

            <div className="qr-ticket-code">{selectedTicket.codigoPublico}</div>

            <p className="qr-warning-note">
              {selectedTicket.conciertoCancelado || selectedTicket.estado === 'INVALIDADO'
                ? 'Evento cancelado. El código de acceso queda inhabilitado para el control de puerta.'
                : 'Presenta este código en la puerta del recinto para su validación con el personal autorizado. Cada código QR es único y sólo puede ser utilizado una vez.'}
            </p>

            <button
              onClick={() => setSelectedTicket(null)}
              style={{
                marginTop: '16px',
                padding: '10px 24px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
