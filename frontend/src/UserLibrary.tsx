import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { SonicSidebar } from './components/SonicSidebar';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Edit2,
  Heart,
  ListMusic,
  Music,
  Play,
  Plus,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { usePlayback } from './PlaybackContext';
import { type CatalogSong } from '../../shared/catalog';
import {
  type PlaylistSummary,
  type PlaylistDetail,
  type FavoriteResponse,
} from '../../shared/library';
import {
  fetchUserPlaylists,
  fetchUserPlaylist,
  createUserPlaylist,
  updateUserPlaylist,
  deleteUserPlaylist,
  removeTrackFromUserPlaylist,
  reorderUserPlaylistTracks,
  fetchUserFavorites,
  toggleFavorite,
  addTrackToUserPlaylist,
} from '../../shared/library-api';
import {
  type ListeningHistoryItem,
} from '../../shared/history';
import {
  fetchUserHistory,
  deleteHistoryEntry,
  clearUserHistory,
} from '../../shared/history-api';
import './UserLibrary.css';
import './ArtistReleases.css';
import { getApiBaseUrl } from './auth-api';

const base = getApiBaseUrl();

function formatSeconds(secs?: number | null): string {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UserLibrary() {
  const navigate = useNavigate();
  const location = useLocation();
  const playback = usePlayback();

  // Tabs: 'playlists' | 'favoritos' | 'historial'
  const initialTab: 'playlists' | 'favoritos' | 'historial' = location.pathname.includes('historial')
    ? 'historial'
    : location.pathname.includes('favoritos')
      ? 'favoritos'
      : 'playlists';

  const [activeTab, setActiveTab] = useState<'playlists' | 'favoritos' | 'historial'>(initialTab);

  // Playlists State
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null);

  // Favorites State
  const [favorites, setFavorites] = useState<CatalogSong[]>([]);

  // History State (CU11)
  const [historyItems, setHistoryItems] = useState<ListeningHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'PLAYED' | 'SKIPPED'>('ALL');

  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [playlistFormName, setPlaylistFormName] = useState('');
  const [playlistFormDesc, setPlaylistFormDesc] = useState('');
  const [songToAddToPlaylist, setSongToAddToPlaylist] = useState<CatalogSong | null>(null);

  // Load playlists
  const loadPlaylists = useCallback(async () => {
    try {
      const data = await fetchUserPlaylists(base);
      setPlaylists(data);
    } catch (err: any) {
      if (err.message && err.message.includes('401')) {
        navigate('/iniciar-sesion');
      }
    }
  }, [navigate]);

  // Load favorites
  const loadFavorites = useCallback(async () => {
    try {
      const data = await fetchUserFavorites(base);
      setFavorites(data);
    } catch (err: any) {
      if (err.message && err.message.includes('401')) {
        navigate('/iniciar-sesion');
      }
    }
  }, [navigate]);

  // Load history (CU11)
  const loadHistory = useCallback(
    async (filter: 'ALL' | 'PLAYED' | 'SKIPPED' = historyFilter) => {
      try {
        const data = await fetchUserHistory(base, { pageSize: 50, eventType: filter });
        setHistoryItems(data.items);
      } catch (err: any) {
        if (err.message && err.message.includes('401')) {
          navigate('/iniciar-sesion');
        }
      }
    },
    [historyFilter, navigate],
  );

  // Refresh current view
  const refresh = useCallback(async () => {
    await Promise.all([loadPlaylists(), loadFavorites(), loadHistory()]);
  }, [loadPlaylists, loadFavorites, loadHistory]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (location.pathname.includes('historial')) {
      setActiveTab('historial');
      setSelectedPlaylist(null);
    } else if (location.pathname.includes('favoritos')) {
      setActiveTab('favoritos');
      setSelectedPlaylist(null);
    } else if (location.pathname.includes('playlists') || location.pathname.includes('mi-musica')) {
      setActiveTab('playlists');
    }
  }, [location.pathname]);

  // Select playlist detail
  const handleOpenPlaylist = async (id: string) => {
    try {
      const detail = await fetchUserPlaylist(base, id);
      setSelectedPlaylist(detail);
    } catch (err: any) {
      setNotice({ type: 'error', text: 'No se pudo cargar la playlist.' });
    }
  };

  // Create playlist
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistFormName.trim()) return;
    try {
      const created = await createUserPlaylist(base, {
        nombre: playlistFormName.trim(),
        descripcion: playlistFormDesc.trim(),
      });
      setShowCreateModal(false);
      setPlaylistFormName('');
      setPlaylistFormDesc('');
      setNotice({ type: 'ok', text: `Playlist "${created.nombre}" creada con éxito.` });
      await loadPlaylists();
      await handleOpenPlaylist(created.id);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al crear la playlist.' });
    }
  };

  // Edit playlist
  const handleUpdatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlaylist || !playlistFormName.trim()) return;
    try {
      const updated = await updateUserPlaylist(base, selectedPlaylist.id, {
        nombre: playlistFormName.trim(),
        descripcion: playlistFormDesc.trim(),
      });
      setShowEditModal(false);
      setSelectedPlaylist(updated);
      setNotice({ type: 'ok', text: 'Playlist actualizada.' });
      await loadPlaylists();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al actualizar.' });
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async () => {
    if (!selectedPlaylist) return;
    const confirmDel = window.confirm(`¿Seguro que deseas eliminar la playlist "${selectedPlaylist.nombre}"?`);
    if (!confirmDel) return;
    try {
      await deleteUserPlaylist(base, selectedPlaylist.id);
      setSelectedPlaylist(null);
      setNotice({ type: 'ok', text: 'Playlist eliminada.' });
      await loadPlaylists();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al eliminar.' });
    }
  };

  // Remove track from playlist
  const handleRemoveTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;
    try {
      const updated = await removeTrackFromUserPlaylist(base, selectedPlaylist.id, trackId);
      setSelectedPlaylist(updated);
      await loadPlaylists();
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al quitar la canción.' });
    }
  };

  // Reorder track
  const handleMoveTrack = async (index: number, direction: 'up' | 'down') => {
    if (!selectedPlaylist) return;
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= selectedPlaylist.tracks.length) return;

    const copy = [...selectedPlaylist.tracks];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;

    const trackIds = copy.map((c) => c.id);
    try {
      const updated = await reorderUserPlaylistTracks(base, selectedPlaylist.id, trackIds);
      setSelectedPlaylist(updated);
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al reordenar canciones.' });
    }
  };

  // Play entire playlist
  const handlePlayPlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.tracks.length === 0) return;
    const playable = selectedPlaylist.tracks.filter((s: CatalogSong) => s.playable !== false);
    if (playable.length === 0) {
      setNotice({ type: 'error', text: 'No hay canciones reproducibles en esta playlist.' });
      return;
    }
    playback.play(playable[0], playable);
  };

  // Play all favorites
  const handlePlayFavorites = () => {
    if (favorites.length === 0) return;
    const playable = favorites.filter((s: CatalogSong) => s.playable !== false);
    if (playable.length === 0) {
      setNotice({ type: 'error', text: 'No hay canciones reproducibles en tus favoritas.' });
      return;
    }
    playback.play(playable[0], playable);
  };

  // Toggle favorite in favorites list
  const handleToggleFavorite = async (song: CatalogSong) => {
    try {
      const res: FavoriteResponse = await toggleFavorite(base, song.id, true, song.source);
      if (!res.favorited) {
        setFavorites((prev) => prev.filter((s) => s.id !== song.id));
        setNotice({ type: 'ok', text: `"${song.titulo}" quitada de tus favoritas.` });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al actualizar favorita.' });
    }
  };

  // Delete single history entry (CU11)
  const handleDeleteHistoryEntry = async (id: string) => {
    try {
      await deleteHistoryEntry(base, id);
      setHistoryItems((prev) => prev.filter((h) => h.id !== id));
      setNotice({ type: 'ok', text: 'Entrada eliminada del historial.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al eliminar entrada.' });
    }
  };

  // Clear entire history (CU11)
  const handleClearHistory = async () => {
    const confirmClear = window.confirm('¿Seguro que deseas limpiar todo tu historial de reproducción?');
    if (!confirmClear) return;
    try {
      await clearUserHistory(base);
      setHistoryItems([]);
      setNotice({ type: 'ok', text: 'Historial de reproducción limpiado.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err.message || 'Error al limpiar historial.' });
    }
  };

  // Filter history changed
  const handleFilterChange = (filter: 'ALL' | 'PLAYED' | 'SKIPPED') => {
    setHistoryFilter(filter);
    void loadHistory(filter);
  };

  // Total duration helper
  const totalPlaylistSeconds = selectedPlaylist?.tracks.reduce(
    (acc: number, cur: CatalogSong) => acc + (cur.duracionSegundos || 0),
    0,
  ) || 0;

  return (
    <div className="sl-library-page">
      <SonicSidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedPlaylist(null);
        }}
        onCreatePlaylist={() => setShowCreateModal(true)}
      />

      <div className="sl-lib-main-wrapper">
        <header className="sl-lib-header">
          <nav className="sl-lib-nav">
            <Link to="/explorar">Música</Link>
            <Link to="/dj">DJ con IA</Link>
            <Link to="/conciertos">Conciertos</Link>
          </nav>
          <div className="sl-lib-tools">
            <Link to="/perfil" aria-label="Mi perfil">
              <UserRound size={20} />
            </Link>
          </div>
        </header>

        {/* Main Container */}
        <div className="sl-lib-container">
          {notice && (
            <div
              className={`sl-lib-notice ${notice.type}`}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                margin: '20px 0 10px 0',
                background: notice.type === 'ok' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 45, 106, 0.15)',
                border: `1px solid ${notice.type === 'ok' ? '#00f0ff' : '#ff2d6a'}`,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {notice.type === 'ok' ? <Check size={18} color="#00f0ff" /> : <AlertCircle size={18} color="#ff2d6a" />}
              <span>{notice.text}</span>
              <button
                onClick={() => setNotice(null)}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Tabs switcher */}
          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div className="sl-lib-tabs" style={{ margin: 0, flexWrap: 'wrap' }}>
            <button
            className={`sl-lib-tab ${activeTab === 'playlists' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('playlists');
              setSelectedPlaylist(null);
            }}
          >
            <ListMusic size={18} />
            <span>Mis Playlists ({playlists.length})</span>
          </button>
          <button
            className={`sl-lib-tab ${activeTab === 'favoritos' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favoritos');
              setSelectedPlaylist(null);
            }}
          >
            <Heart size={18} />
            <span>Mis Favoritas ({favorites.length})</span>
          </button>
          <button
            className={`sl-lib-tab ${activeTab === 'historial' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('historial');
              setSelectedPlaylist(null);
            }}
          >
            <Clock size={18} />
            <span>Historial ({historyItems.length})</span>
          </button>
          </div>
        </div>

        {/* TAB 1: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <>
            {selectedPlaylist ? (
              /* Playlist Detail View */
              <div className="sl-playlist-detail-view">
                <button
                  className="sl-back-btn"
                  onClick={() => setSelectedPlaylist(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(30, 14, 58, 0.6)',
                    border: '1px solid rgba(157, 41, 237, 0.3)',
                    color: '#baa4d4',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    marginBottom: '20px',
                  }}
                >
                  ← Volver a mis playlists
                </button>

                <div className="sl-pl-detail-header">
                  <div className="sl-pl-detail-art">
                    {selectedPlaylist.tracks[0]?.coverUrl ? (
                      <img src={selectedPlaylist.tracks[0].coverUrl} alt={selectedPlaylist.nombre} />
                    ) : (
                      <ListMusic size={48} color="#9d29ed" />
                    )}
                    </div>
                  <div className="sl-pl-detail-info">
                    <span style={{ fontSize: '13px', color: '#00f0ff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Playlist
                    </span>
                    <h1 style={{ fontSize: '32px', margin: '4px 0 8px 0', color: '#fff' }}>{selectedPlaylist.nombre}</h1>
                    <p style={{ color: '#baa4d4', margin: '0 0 12px 0' }}>
                      {selectedPlaylist.descripcion || 'Sin descripción'}
                    </p>
                    <div style={{ fontSize: '13px', color: '#8c7b9e' }}>
                      {selectedPlaylist.tracks.length} canciones • {formatSeconds(totalPlaylistSeconds)} de duración
                      </div>

                    <div className="sl-pl-detail-actions">
                      <button
                        className="sl-lib-action-btn"
                        onClick={handlePlayPlaylist}
                        disabled={selectedPlaylist.tracks.length === 0}
                      >
                        <Play size={16} fill="currentColor" />
                        <span>Reproducir playlist</span>
                      </button>
                      <button
                        className="sl-lib-btn-secondary"
                        onClick={() => {
                          setPlaylistFormName(selectedPlaylist.nombre);
                          setPlaylistFormDesc(selectedPlaylist.descripcion || '');
                          setShowEditModal(true);
                        }}
                      >
                        <Edit2 size={16} />
                        <span>Editar</span>
                      </button>
                      <button className="sl-lib-btn-danger" onClick={handleDeletePlaylist}>
                        <Trash2 size={16} />
                        <span>Eliminar</span>
                      </button>
                      </div>
                    </div>
                  </div>

                {/* Playlist Tracks List */}
                <h3 style={{ fontSize: '18px', color: '#ffffff', margin: '24px 0 16px 0' }}>Canciones de la playlist</h3>
                {selectedPlaylist.tracks.length === 0 ? (
                  <div className="sl-lib-empty" style={{ textAlign: 'center', padding: '48px 0', color: '#baa4d4' }}>
                    <p>Esta playlist aún no tiene canciones.</p>
                    <Link to="/explorar" className="sl-lib-action-btn" style={{ display: 'inline-flex', marginTop: '16px' }}>
                      Explorar canciones para agregar
                    </Link>
                    </div>
                ) : (
                  <div className="sl-tracks-container">
                    {selectedPlaylist.tracks.map((track: CatalogSong, idx: number) => (
                      <div className="sl-track-item" key={track.id}>
                        <span className="sl-track-num" style={{ width: '24px', textAlign: 'center', color: '#8c7b9e' }}>
                          {idx + 1}
                        </span>
                        <div
                          className="sl-track-art-small"
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            background: '#120625',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {track.coverUrl ? (
                            <img src={track.coverUrl} alt={track.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Music size={18} color="#9d29ed" />
                          )}
                          </div>
                        <div className="sl-track-details" style={{ flex: 1 }}>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '14.5px' }}>{track.titulo}</strong>
                          <small style={{ color: '#baa4d4', fontSize: '12.5px' }}>{track.artista.nombre}</small>
                          </div>
                        <span
                          className={`sl-track-badge ${track.source === 'AUDIUS' ? 'audius' : 'local'}`}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            background: track.source === 'AUDIUS' ? 'rgba(204, 8, 255, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                            color: track.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff',
                            border: `1px solid ${track.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff'}`,
                          }}
                        >
                          {track.source === 'AUDIUS' ? 'Audius' : 'SL'}
                        </span>
                        <span style={{ fontSize: '13px', color: '#8c7b9e', margin: '0 12px' }}>
                          {formatSeconds(track.duracionSegundos)}
                        </span>
                        <div className="sl-track-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            title="Reproducir"
                            onClick={() => playback.play(track, selectedPlaylist.tracks)}
                            style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                          >
                            <Play size={18} />
                          </button>
                          <button
                            title="Subir posición"
                            disabled={idx === 0}
                            onClick={() => handleMoveTrack(idx, 'up')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: idx === 0 ? '#44325a' : '#baa4d4',
                              cursor: idx === 0 ? 'default' : 'pointer',
                            }}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            title="Bajar posición"
                            disabled={idx === selectedPlaylist.tracks.length - 1}
                            onClick={() => handleMoveTrack(idx, 'down')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: idx === selectedPlaylist.tracks.length - 1 ? '#44325a' : '#baa4d4',
                              cursor: idx === selectedPlaylist.tracks.length - 1 ? 'default' : 'pointer',
                            }}
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            title="Quitar de playlist"
                            onClick={() => handleRemoveTrack(track.id)}
                            style={{ background: 'none', border: 'none', color: '#ff2d6a', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                          </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            ) : (
              /* Playlists Grid View */
              <>
                <div className="sl-lib-banner">
                  <div className="sl-lib-banner-left">
                    <div className="sl-lib-icon-box">
                      <ListMusic size={32} />
                      </div>
                    <div className="sl-lib-banner-info">
                      <h1>Mis Playlists</h1>
                      <p>Crea, organiza y disfruta tus listas personalizadas con canciones de Sonic Ledger y Audius.</p>
                      </div>
                    </div>
                  <button className="sl-lib-action-btn" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} />
                    <span>Crear playlist</span>
                  </button>
                  </div>

                {playlists.length === 0 ? (
                  <div className="sl-lib-empty" style={{ textAlign: 'center', padding: '64px 0', color: '#baa4d4' }}>
                    <p style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>Aún no has creado ninguna playlist</p>
                    <p>Organiza tus canciones favoritas en colecciones únicas para cada momento.</p>
                    <button
                      className="sl-lib-action-btn"
                      onClick={() => setShowCreateModal(true)}
                      style={{ margin: '16px auto 0 auto' }}
                    >
                      <Plus size={18} />
                      <span>Crear mi primera playlist</span>
                    </button>
                    </div>
                ) : (
                  <div className="sl-playlist-grid">
                    {playlists.map((pl) => (
                      <div className="sl-playlist-card" key={pl.id} onClick={() => handleOpenPlaylist(pl.id)}>
                        <div className="sl-playlist-art-wrap">
                          <ListMusic size={40} color="#9d29ed" />
                          </div>
                        <h4 className="sl-playlist-name">{pl.nombre}</h4>
                        <p className="sl-playlist-desc">{pl.descripcion || 'Sin descripción'}</p>
                        <div className="sl-playlist-meta-row">
                          <span>{pl.trackCount} canciones</span>
                          </div>
                        </div>
                    ))}
                    </div>
                )}
              </>
            )}
          </>
        )}

        {/* TAB 2: FAVORITOS */}
        {activeTab === 'favoritos' && (
          <>
            <div className="sl-lib-banner">
              <div className="sl-lib-banner-left">
                <div
                  className="sl-lib-icon-box"
                  style={{
                    borderColor: '#ff2d6a',
                    color: '#ff2d6a',
                    boxShadow: '0 0 20px rgba(255, 45, 106, 0.35)',
                  }}
                >
                  <Heart size={32} fill="currentColor" />
                  </div>
                <div className="sl-lib-banner-info">
                  <h1>Mis Favoritas</h1>
                  <p>Todas las canciones que te encantan en un solo lugar. Disponibles para reproducir cuando quieras.</p>
                  </div>
                </div>
              <button
                className="sl-lib-action-btn"
                onClick={handlePlayFavorites}
                disabled={favorites.length === 0}
                style={{
                  background: 'linear-gradient(90deg, #ff2d6a 0%, #b818c8 100%)',
                  boxShadow: '0 0 20px rgba(255, 45, 106, 0.5)',
                }}
              >
                <Play size={18} fill="currentColor" />
                <span>Reproducir todo</span>
              </button>
              </div>

            {favorites.length === 0 ? (
              <div className="sl-lib-empty" style={{ textAlign: 'center', padding: '64px 0', color: '#baa4d4' }}>
                <p style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>No tienes canciones favoritas todavía</p>
                <p>Explora el catálogo de Sonic Ledger o Audius y dale corazón a las canciones que te muevan.</p>
                <Link to="/explorar" className="sl-lib-action-btn" style={{ display: 'inline-flex', marginTop: '16px' }}>
                  Ir a Explorar
                </Link>
                </div>
            ) : (
              <div className="sl-tracks-container">
                {favorites.map((song, idx) => (
                  <div className="sl-track-item" key={song.id}>
                    <span className="sl-track-num" style={{ width: '24px', textAlign: 'center', color: '#8c7b9e' }}>
                      {idx + 1}
                    </span>
                    <div
                      className="sl-track-art-small"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#120625',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {song.coverUrl ? (
                        <img src={song.coverUrl} alt={song.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Music size={18} color="#9d29ed" />
                      )}
                      </div>
                    <div className="sl-track-details" style={{ flex: 1 }}>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '14.5px' }}>{song.titulo}</strong>
                      <small style={{ color: '#baa4d4', fontSize: '12.5px' }}>{song.artista.nombre}</small>
                      </div>
                    <span
                      className={`sl-track-badge ${song.source === 'AUDIUS' ? 'audius' : 'local'}`}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: song.source === 'AUDIUS' ? 'rgba(204, 8, 255, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                        color: song.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff',
                        border: `1px solid ${song.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff'}`,
                      }}
                    >
                      {song.source === 'AUDIUS' ? 'Audius' : 'SL'}
                    </span>
                    <span style={{ fontSize: '13px', color: '#8c7b9e', margin: '0 12px' }}>
                      {formatSeconds(song.duracionSegundos)}
                    </span>
                    <div className="sl-track-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        title="Reproducir"
                        onClick={() => playback.play(song, favorites)}
                        style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                      >
                        <Play size={18} />
                      </button>
                      <button
                        title="Añadir a playlist"
                        onClick={() => setSongToAddToPlaylist(song)}
                        style={{ background: 'none', border: 'none', color: '#baa4d4', cursor: 'pointer' }}
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        title="Quitar de favoritas"
                        onClick={() => handleToggleFavorite(song)}
                        style={{ background: 'none', border: 'none', color: '#ff2d6a', cursor: 'pointer' }}
                      >
                        <Heart size={18} fill="#ff2d6a" />
                      </button>
                      </div>
                    </div>
                ))}
                </div>
            )}
          </>
        )}

        {/* TAB 3: HISTORIAL (CU11) */}
        {activeTab === 'historial' && (
          <>
            <div className="sl-lib-banner">
              <div className="sl-lib-banner-left">
                <div
                  className="sl-lib-icon-box"
                  style={{
                    borderColor: '#00f0ff',
                    color: '#00f0ff',
                    boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)',
                  }}
                >
                  <Clock size={32} />
                  </div>
                <div className="sl-lib-banner-info">
                  <h1>Historial de reproducción</h1>
                  <p>Canciones que has escuchado recientemente. Puedes volver a reproducirlas en cualquier momento.</p>
                  </div>
                </div>
              <button
                className="sl-lib-btn-danger"
                onClick={handleClearHistory}
                disabled={historyItems.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '22px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  cursor: historyItems.length === 0 ? 'default' : 'pointer',
                  opacity: historyItems.length === 0 ? 0.4 : 1,
                }}
              >
                <Trash2 size={16} />
                <span>Limpiar historial</span>
              </button>
              </div>

            {/* Filter Pills */}
            <div className="sl-history-filter-row">
              <div className="sl-filter-pills">
                <button
                  className={`sl-filter-pill ${historyFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('ALL')}
                >
                  Todos
                </button>
                <button
                  className={`sl-filter-pill ${historyFilter === 'PLAYED' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('PLAYED')}
                >
                  Reproducidas
                </button>
                <button
                  className={`sl-filter-pill ${historyFilter === 'SKIPPED' ? 'active' : ''}`}
                  onClick={() => handleFilterChange('SKIPPED')}
                >
                  Omitidas
                </button>
                </div>
              <span style={{ fontSize: '13px', color: '#8c7b9e' }}>
                {historyItems.length} {historyItems.length === 1 ? 'registro' : 'registros'}
              </span>
              </div>

            {historyItems.length === 0 ? (
              <div className="sl-lib-empty" style={{ textAlign: 'center', padding: '64px 0', color: '#baa4d4' }}>
                <p style={{ fontSize: '18px', color: '#fff', marginBottom: '8px' }}>No hay reproducciones en el historial</p>
                <p>Las canciones que reproduzcas en el catálogo aparecerán automáticamente registradas aquí.</p>
                <Link to="/explorar" className="sl-lib-action-btn" style={{ display: 'inline-flex', marginTop: '16px' }}>
                  Ir a Explorar
                </Link>
                </div>
            ) : (
              <div className="sl-tracks-container">
                {historyItems.map((item, idx) => (
                  <div className="sl-track-item" key={item.id}>
                    <span className="sl-track-num" style={{ width: '24px', textAlign: 'center', color: '#8c7b9e' }}>
                      {idx + 1}
                    </span>
                    <div
                      className="sl-track-art-small"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#120625',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {item.song?.coverUrl ? (
                        <img src={item.song.coverUrl} alt={item.song.titulo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Music size={18} color="#9d29ed" />
                      )}
                      </div>
                    <div className="sl-track-details" style={{ flex: 1 }}>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '14.5px' }}>
                        {item.song?.titulo || 'Canción'}
                      </strong>
                      <small style={{ color: '#baa4d4', fontSize: '12.5px' }}>
                        {item.song?.artista?.nombre || 'Artista'}
                      </small>
                      </div>

                    {/* Source badge */}
                    <span
                      className={`sl-track-badge ${item.source === 'AUDIUS' ? 'audius' : 'local'}`}
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        background: item.source === 'AUDIUS' ? 'rgba(204, 8, 255, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                        color: item.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff',
                        border: `1px solid ${item.source === 'AUDIUS' ? '#cc08ff' : '#00f0ff'}`,
                      }}
                    >
                      {item.source === 'AUDIUS' ? 'Audius' : 'SL'}
                    </span>

                    {/* Event Type Badge */}
                    <span className={item.eventType === 'PLAYED' ? 'sl-badge-played' : 'sl-badge-skipped'}>
                      {item.eventType === 'PLAYED' ? 'Reproducida' : 'Omitida'}
                    </span>

                    {/* Listened Time */}
                    <span style={{ fontSize: '12px', color: '#baa4d4', margin: '0 8px' }}>
                      {Math.round(item.listenedSeconds)}s
                    </span>

                    {/* Timestamp */}
                    <span className="sl-history-time" style={{ margin: '0 8px' }}>
                      {formatDateTime(item.startedAt || item.createdAt)}
                    </span>

                    {/* Controls */}
                    <div className="sl-track-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        title="Volver a reproducir"
                        onClick={() => playback.play(item.song, historyItems.map((h) => h.song))}
                        style={{ background: 'none', border: 'none', color: '#00f0ff', cursor: 'pointer' }}
                      >
                        <Play size={18} />
                      </button>
                      <button
                        title="Añadir a playlist"
                        onClick={() => setSongToAddToPlaylist(item.song)}
                        style={{ background: 'none', border: 'none', color: '#baa4d4', cursor: 'pointer' }}
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        title="Eliminar del historial"
                        onClick={() => handleDeleteHistoryEntry(item.id)}
                        style={{ background: 'none', border: 'none', color: '#ff2d6a', cursor: 'pointer' }}
                      >
                        <Trash2 size={16} />
                      </button>
                      </div>
                    </div>
                ))}
                </div>
            )}
          </>
        )}
      </div>
    </div>

      {/* CREATE PLAYLIST MODAL */}
      {showCreateModal && (
        <div className="sl-lib-modal-overlay">
          <div className="sl-lib-modal-card">
            <div className="sl-lib-modal-header">
              <h3>Crear nueva playlist</h3>
              <button onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
              </div>
            <form onSubmit={handleCreatePlaylist}>
              <div className="sl-lib-form-group">
                <label>Nombre de la playlist *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Ej: Para entrenar, Chill neón..."
                  value={playlistFormName}
                  onChange={(e) => setPlaylistFormName(e.target.value)}
                  autoFocus
                />
                </div>
              <div className="sl-lib-form-group">
                <label>Descripción (opcional)</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="¿De qué trata esta selección?"
                  value={playlistFormDesc}
                  onChange={(e) => setPlaylistFormDesc(e.target.value)}
                />
                </div>
              <div className="sl-lib-modal-actions">
                <button type="button" className="sl-lib-btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="sl-lib-action-btn">
                  Crear playlist
                </button>
                </div>
            </form>
            </div>
          </div>
      )}

      {/* EDIT PLAYLIST MODAL */}
      {showEditModal && selectedPlaylist && (
        <div className="sl-lib-modal-overlay">
          <div className="sl-lib-modal-card">
            <div className="sl-lib-modal-header">
              <h3>Editar playlist</h3>
              <button onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
              </div>
            <form onSubmit={handleUpdatePlaylist}>
              <div className="sl-lib-form-group">
                <label>Nombre de la playlist *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={playlistFormName}
                  onChange={(e) => setPlaylistFormName(e.target.value)}
                  autoFocus
                />
                </div>
              <div className="sl-lib-form-group">
                <label>Descripción (opcional)</label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={playlistFormDesc}
                  onChange={(e) => setPlaylistFormDesc(e.target.value)}
                />
                </div>
              <div className="sl-lib-modal-actions">
                <button type="button" className="sl-lib-btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="sl-lib-action-btn">
                  Guardar cambios
                </button>
                </div>
            </form>
            </div>
          </div>
      )}

      {/* ADD TO PLAYLIST MODAL */}
      {songToAddToPlaylist && (
        <AddToPlaylistModal
          song={songToAddToPlaylist}
          playlists={playlists}
          onClose={() => setSongToAddToPlaylist(null)}
          onAdded={async (_plId: string, plName: string) => {
            setSongToAddToPlaylist(null);
            setNotice({ type: 'ok', text: `Canción añadida a "${plName}".` });
            await loadPlaylists();
          }}
        />
      )}
    </div>
  );
}

// Reusable AddToPlaylistModal
export function AddToPlaylistModal({
  song,
  playlists,
  onClose,
  onAdded,
}: {
  song: CatalogSong;
  playlists: PlaylistSummary[];
  onClose: () => void;
  onAdded: (playlistId: string, playlistName: string) => void;
}) {
  const [selectedPlId, setSelectedPlId] = useState<string>(playlists[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleAdd = async () => {
    if (!selectedPlId) return;
    setLoading(true);
    setErr('');
    try {
      await addTrackToUserPlaylist(base, selectedPlId, song.id, song.source);
      const pl = playlists.find((p) => p.id === selectedPlId);
      onAdded(selectedPlId, pl ? pl.nombre : 'la playlist');
    } catch (e: any) {
      setErr(e.message || 'Error al añadir a la playlist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sl-lib-modal-overlay">
      <div className="sl-lib-modal-card">
        <div className="sl-lib-modal-header">
          <h3>Añadir a playlist</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
          </div>
        <p style={{ color: '#baa4d4', fontSize: '14px', margin: '0 0 16px 0' }}>
          Selecciona la playlist para <strong>"{song.titulo}"</strong> ({song.artista.nombre}):
        </p>
        {err && (
          <div style={{ color: '#ff2d6a', fontSize: '13px', marginBottom: '12px' }}>
            {err}
            </div>
        )}
        {playlists.length === 0 ? (
          <p style={{ color: '#baa4d4', fontSize: '13px' }}>
            No tienes playlists creadas. Puedes crear una desde la sección "Mi música".
          </p>
        ) : (
          <div className="sl-lib-form-group">
            <select
              value={selectedPlId}
              onChange={(e) => setSelectedPlId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                background: '#1a0d33',
                border: '1px solid rgba(157, 41, 237, 0.4)',
                color: '#fff',
                fontSize: '14px',
              }}
            >
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.nombre} ({pl.trackCount} canciones)
                </option>
              ))}
            </select>
            </div>
        )}
        <div className="sl-lib-modal-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="sl-lib-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="sl-lib-action-btn"
            disabled={loading || playlists.length === 0}
            onClick={handleAdd}
          >
            {loading ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </div>
    </div>
  );
}
