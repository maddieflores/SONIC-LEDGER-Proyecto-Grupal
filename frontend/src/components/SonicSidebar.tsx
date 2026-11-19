import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AudioLines,
  BarChart3,
  Clock,
  Compass,
  Disc,
  Heart,
  Home,
  Layers,
  ListMusic,
  LogOut,
  Menu,
  Mic2,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Radio,
  Sparkles,
  Ticket,
  UserRound,
  X,
} from 'lucide-react';
import { useSidebar } from '../SidebarContext';
import { request } from '../auth-api';
import '../Sidebar.css';

export interface SonicSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: 'playlists' | 'favoritos' | 'historial') => void;
  onCreatePlaylist?: () => void;
  artistMode?: boolean;
  mode?: 'full' | 'drawer';
}

export function SonicSidebar({
  activeTab,
  onTabChange,
  onCreatePlaylist,
  artistMode = false,
  mode = 'full',
}: SonicSidebarProps) {
  const { isOpen, close, toggle, isMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();

  const isDrawer = mode === 'drawer' || isMobile;

  const handleLogout = async () => {
    try {
      await request('logout', {});
    } catch {
      // Ignorar error de red y redirigir
    } finally {
      localStorage.removeItem('token');
      sessionStorage.clear();
      navigate('/iniciar-sesion');
    }
  };

  const isCurrent = (path: string, exact = false) => {
    if (exact) return location.pathname === path;
    if (path.includes('?')) {
      return (location.pathname + location.search) === path;
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isOpen && isDrawer && (
        <div
          className="sl-sidebar-backdrop"
          onClick={close}
          aria-label="Cerrar menú lateral"
        />
      )}

      <aside
        className={`sl-sidebar ${isOpen ? 'is-open' : 'is-collapsed'} ${
          isDrawer ? 'is-drawer' : ''
        } ${artistMode ? 'artist-mode' : ''}`}
        aria-label="Navegación principal"
      >
        {/* Header: Brand & Collapse toggle button */}
        <div className="sl-sidebar-header">
          <Link
            to="/inicio"
            className="sl-sidebar-brand"
            aria-label="Sonic Ledger, inicio"
            onClick={() => isDrawer && close()}
            title="Sonic Ledger"
          >
            <span className="sl-sidebar-brand-mark">
              <AudioLines size={18} />
            </span>
            <span className="sl-sidebar-brand-text">
              sonic<span>ledger</span>
              <i>.</i>
            </span>
          </Link>

          <button
            type="button"
            className="sl-sidebar-collapse-btn"
            onClick={toggle}
            aria-label={isOpen ? 'Contraer menú (solo iconos)' : 'Expandir menú'}
            title={isOpen ? 'Contraer menú (solo iconos)' : 'Expandir menú'}
          >
            {isDrawer ? (
              <X size={18} />
            ) : isOpen ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>
        </div>

        {/* Navigation links */}
        <nav className="sl-sidebar-nav">
          <div className="sl-nav-section-title">
            <span>Principal</span>
          </div>

          <Link
            to="/inicio"
            className={`sl-nav-item ${isCurrent('/inicio', true) ? 'active' : ''}`}
            onClick={() => isDrawer && close()}
            title="Inicio"
          >
            <Home size={19} />
            <span>Inicio</span>
          </Link>

          <Link
            to="/explorar"
            className={`sl-nav-item ${
              isCurrent('/explorar', true) && !location.search.includes('tipo=album')
                ? 'active'
                : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Explorar"
          >
            <Compass size={19} />
            <span>Explorar</span>
          </Link>

          <Link
            to="/mi-musica"
            className={`sl-nav-item ${
              (isCurrent('/mi-musica') || activeTab === 'playlists') &&
              !location.search.includes('tipo=album')
                ? 'active'
                : ''
            }`}
            onClick={() => {
              if (onTabChange) onTabChange('playlists');
              if (isMobile) close();
            }}
            title="Mi música"
          >
            <Music size={19} />
            <span>Mi música</span>
          </Link>

          <Link
            to="/explorar?tipo=album"
            className={`sl-nav-item ${
              location.search.includes('tipo=album') ? 'active' : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Álbumes"
          >
            <Disc size={19} />
            <span>Álbumes</span>
          </Link>

          <Link
            to="/conciertos"
            className={`sl-nav-item ${isCurrent('/conciertos') ? 'active' : ''}`}
            onClick={() => isDrawer && close()}
            title="Conciertos"
          >
            <Ticket size={19} />
            <span>Conciertos</span>
          </Link>

          <Link
            to="/artista/lanzamientos"
            className={`sl-nav-item ${
              isCurrent('/artista/lanzamientos') || isCurrent('/lanzamientos')
                ? 'active'
                : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Lanzamientos"
          >
            <Layers size={19} />
            <span>Lanzamientos</span>
          </Link>

          <Link
            to="/dj"
            className={`sl-nav-item ${isCurrent('/dj') ? 'active' : ''}`}
            onClick={() => isDrawer && close()}
            title="DJ con IA"
          >
            <Sparkles size={19} />
            <span>DJ con IA</span>
          </Link>

          {/* Section: Biblioteca & Playlists */}
          <div className="sl-nav-section-title">
            <span>Biblioteca</span>
            {onCreatePlaylist && isOpen && (
              <button
                type="button"
                className="sl-nav-plus-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatePlaylist();
                }}
                title="Crear playlist"
                aria-label="Crear playlist"
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {onTabChange ? (
            <button
              type="button"
              className={`sl-nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('playlists');
                if (isMobile) close();
              }}
              title="Mis Playlists"
            >
              <ListMusic size={19} />
              <span>Mis Playlists</span>
            </button>
          ) : (
            <Link
              to="/playlists"
              className={`sl-nav-item ${
                isCurrent('/playlists') || activeTab === 'playlists' ? 'active' : ''
              }`}
              onClick={() => isDrawer && close()}
              title="Mis Playlists"
            >
              <ListMusic size={19} />
              <span>Mis Playlists</span>
            </Link>
          )}

          {onTabChange ? (
            <button
              type="button"
              className={`sl-nav-item ${activeTab === 'favoritos' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('favoritos');
                if (isMobile) close();
              }}
              title="Mis Favoritas"
            >
              <Heart size={19} />
              <span>Mis Favoritas</span>
            </button>
          ) : (
            <Link
              to="/favoritos"
              className={`sl-nav-item ${
                isCurrent('/favoritos') || activeTab === 'favoritos' ? 'active' : ''
              }`}
              onClick={() => isDrawer && close()}
              title="Mis Favoritas"
            >
              <Heart size={19} />
              <span>Mis Favoritas</span>
            </Link>
          )}

          {onTabChange ? (
            <button
              type="button"
              className={`sl-nav-item ${activeTab === 'historial' ? 'active' : ''}`}
              onClick={() => {
                onTabChange('historial');
                if (isMobile) close();
              }}
              title="Historial"
            >
              <Clock size={19} />
              <span>Historial</span>
            </button>
          ) : (
            <Link
              to="/historial"
              className={`sl-nav-item ${
                isCurrent('/historial') || activeTab === 'historial' ? 'active' : ''
              }`}
              onClick={() => isDrawer && close()}
              title="Historial"
            >
              <Clock size={19} />
              <span>Historial</span>
            </Link>
          )}

          <Link
            to="/estadisticas-musicales"
            className={`sl-nav-item ${
              isCurrent('/estadisticas-musicales') ? 'active' : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Estadísticas"
          >
            <BarChart3 size={19} />
            <span>Estadísticas</span>
          </Link>

          <Link
            to="/mis-entradas"
            className={`sl-nav-item ${isCurrent('/mis-entradas') ? 'active' : ''}`}
            onClick={() => isDrawer && close()}
            title="Mis entradas"
          >
            <Ticket size={19} />
            <span>Mis entradas</span>
          </Link>

          {/* Section: Artista & Cuenta */}
          <div className="sl-nav-section-title">
            <span>Artista y Cuenta</span>
          </div>

          <Link
            to="/perfil-artistico"
            className={`sl-nav-item ${
              isCurrent('/perfil-artistico') ? 'active' : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Perfil artístico"
          >
            <Mic2 size={19} />
            <span>Perfil artístico</span>
          </Link>

          <Link
            to="/artista"
            className={`sl-nav-item ${
              isCurrent('/artista') || location.pathname.startsWith('/artista/')
                ? 'active'
                : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Espacio de artista"
          >
            <Radio size={19} />
            <span>Espacio de artista</span>
          </Link>

          <Link
            to="/perfil"
            className={`sl-nav-item ${
              isCurrent('/perfil', true) ? 'active' : ''
            }`}
            onClick={() => isDrawer && close()}
            title="Mi perfil"
          >
            <UserRound size={19} />
            <span>Mi perfil</span>
          </Link>
        </nav>

        {/* Footer: Illustration & Logout */}
        <div className="sl-sidebar-footer">
          <div className="sl-sidebar-art-container" aria-hidden="true">
            <img
              src="/images/sonic-listener.png"
              alt="Ilustración oyente Sonic Ledger"
              loading="lazy"
            />
          </div>

          <button
            type="button"
            className="sl-sidebar-logout-btn"
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle({ className = '' }: { className?: string }) {
  const { isOpen, toggle } = useSidebar();
  return (
    <button
      type="button"
      className={`sl-sidebar-toggle-btn ${isOpen ? 'active' : ''} ${className}`}
      onClick={toggle}
      aria-label={isOpen ? 'Contraer menú (solo iconos)' : 'Expandir menú'}
      title={isOpen ? 'Contraer menú (solo iconos)' : 'Expandir menú'}
    >
      <Menu size={20} />
    </button>
  );
}

export function FloatingSidebarToggle() {
  return null;
}
