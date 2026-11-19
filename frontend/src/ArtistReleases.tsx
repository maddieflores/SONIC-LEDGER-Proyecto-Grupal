import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SonicSidebar } from './components/SonicSidebar';
import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Disc,
  Edit2,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  MoreVertical,
  Music,
  Plus,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  formatDuration,
  formatReleaseDate,
  releaseTypeLabel,
  validateReleaseTrackCount,
} from '../../shared/releases';
import type {
  AvailableSong,
  Release,
  ReleaseTipo,
} from '../../shared/releases';
import {
  createReleaseDraft,
  deleteRelease,
  fetchArtistReleases,
  fetchAvailableSongs,
  publishRelease,
  releaseCoverUrl,
  setReleaseTracks,
  updateReleaseDraft,
  uploadReleaseCover,
} from '../../shared/releases-api';
import { usePlayback } from './PlaybackContext';
import './ArtistReleases.css';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function ArtistReleases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [filterTipo, setFilterTipo] = useState<ReleaseTipo | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Modal / Editor State
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [availableSongs, setAvailableSongs] = useState<AvailableSong[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDesc, setEditorDesc] = useState('');
  const [editorTipo, setEditorTipo] = useState<ReleaseTipo>('SINGLE');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const navigate = useNavigate();
  const playback = usePlayback();

  const loadReleases = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchArtistReleases(base, {
        tipo: filterTipo === 'ALL' ? undefined : filterTipo,
        q: searchTerm.trim() || undefined,
        pageSize: 50,
      });
      setReleases(res.items);
    } catch (e: any) {
      if (e.status === 401) {
        navigate('/iniciar-sesion');
      } else {
        setNotice({ type: 'error', text: e.message || 'Error al cargar lanzamientos.' });
      }
    } finally {
      setLoading(false);
    }
  }, [filterTipo, searchTerm, navigate]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const loadSongs = useCallback(async () => {
    try {
      const songs = await fetchAvailableSongs(base);
      setAvailableSongs(songs);
    } catch {
      // Fallback silently if artist has no profile or songs
    }
  }, []);

  const openCreateModal = async () => {
    await loadSongs();
    setIsCreatingNew(true);
    setEditingRelease(null);
    setEditorTitle('');
    setEditorDesc('');
    setEditorTipo('SINGLE');
    setSelectedTrackIds([]);
    setCoverFile(null);
    setCoverPreview(null);
    setNotice(null);
  };

  const openEditModal = async (rel: Release) => {
    await loadSongs();
    setIsCreatingNew(false);
    setEditingRelease(rel);
    setEditorTitle(rel.titulo);
    setEditorDesc(rel.descripcion || '');
    setEditorTipo(rel.tipo);
    setSelectedTrackIds(rel.canciones.map((c) => c.id));
    setCoverFile(null);
    setCoverPreview(rel.portadaUrl ? releaseCoverUrl(base, rel.portadaUrl) || null : null);
    setNotice(null);
  };

  const closeModal = () => {
    setIsCreatingNew(false);
    setEditingRelease(null);
  };

  const handleSaveDraft = async () => {
    if (editorTitle.trim().length < 2) {
      setNotice({ type: 'error', text: 'El título debe tener al menos 2 caracteres.' });
      return;
    }
    setSaving(true);
    try {
      let currentRelId = editingRelease?.id;
      if (isCreatingNew) {
        const created = await createReleaseDraft(base, {
          titulo: editorTitle.trim(),
          tipo: editorTipo,
          descripcion: editorDesc.trim(),
        });
        currentRelId = created.id;
      } else if (currentRelId) {
        await updateReleaseDraft(base, currentRelId, {
          titulo: editorTitle.trim(),
          tipo: editorTipo,
          descripcion: editorDesc.trim(),
        });
      }

      if (currentRelId) {
        // Set tracks
        await setReleaseTracks(base, currentRelId, selectedTrackIds);

        // Upload cover if new file selected
        if (coverFile) {
          const form = new FormData();
          form.append('file', coverFile);
          await uploadReleaseCover(base, currentRelId, form);
        }
      }

      setNotice({ type: 'success', text: 'Lanzamiento guardado como borrador.' });
      closeModal();
      await loadReleases();
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'No se pudo guardar el lanzamiento.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishFromModal = async () => {
    if (editorTitle.trim().length < 2) {
      setNotice({ type: 'error', text: 'El título debe tener al menos 2 caracteres.' });
      return;
    }
    const countErr = validateReleaseTrackCount(editorTipo, selectedTrackIds.length);
    if (countErr) {
      setNotice({ type: 'error', text: countErr });
      return;
    }
    if (!coverFile && !coverPreview) {
      setNotice({ type: 'error', text: 'Debes cargar una portada para poder publicar.' });
      return;
    }

    setSaving(true);
    try {
      let currentRelId = editingRelease?.id;
      if (isCreatingNew) {
        const created = await createReleaseDraft(base, {
          titulo: editorTitle.trim(),
          tipo: editorTipo,
          descripcion: editorDesc.trim(),
        });
        currentRelId = created.id;
      } else if (currentRelId) {
        await updateReleaseDraft(base, currentRelId, {
          titulo: editorTitle.trim(),
          tipo: editorTipo,
          descripcion: editorDesc.trim(),
        });
      }

      if (currentRelId) {
        await setReleaseTracks(base, currentRelId, selectedTrackIds);
        if (coverFile) {
          const form = new FormData();
          form.append('file', coverFile);
          await uploadReleaseCover(base, currentRelId, form);
        }
        await publishRelease(base, currentRelId);
      }

      setNotice({ type: 'success', text: '¡Lanzamiento publicado exitosamente!' });
      closeModal();
      await loadReleases();
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'No se pudo publicar el lanzamiento.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDirectPublish = async (rel: Release) => {
    const countErr = validateReleaseTrackCount(rel.tipo, rel.cancionCount);
    if (countErr) {
      setNotice({ type: 'error', text: countErr });
      return;
    }
    if (!rel.portadaUrl) {
      setNotice({ type: 'error', text: 'El lanzamiento requiere una portada antes de publicarse.' });
      return;
    }
    try {
      await publishRelease(base, rel.id);
      setNotice({ type: 'success', text: `¡"${rel.titulo}" ha sido publicado!` });
      await loadReleases();
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'Error al publicar el lanzamiento.' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteRelease(base, deletingId);
      setNotice({ type: 'success', text: 'Lanzamiento eliminado con éxito.' });
      setDeletingId(null);
      await loadReleases();
    } catch (e: any) {
      setNotice({ type: 'error', text: e.message || 'No se pudo eliminar el lanzamiento.' });
    }
  };

  const toggleTrack = (songId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(songId) ? prev.filter((id) => id !== songId) : [...prev, songId],
    );
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= selectedTrackIds.length) return;
    const copy = [...selectedTrackIds];
    const temp = copy[index];
    copy[index] = copy[newIdx];
    copy[newIdx] = temp;
    setSelectedTrackIds(copy);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setNotice({ type: 'error', text: 'La portada debe ser formato PNG o JPG.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'La portada no debe superar los 2 MB.' });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const playSongPreview = (song: AvailableSong) => {
    if (!song.audioUrl) return;
    playback.play({
      id: song.id,
      titulo: song.titulo,
      artista: { id: '', nombre: '' },
      genero: song.genero ? { id: song.generoId || '', nombre: song.genero } : null,
      duracionSegundos: song.duracionSegundos,
      descripcion: '',
      coverUrl: song.coverUrl,
      playable: true,
      source: 'LOCAL',
    });
  };

  return (
    <div className="sl-releases-page">
      <SonicSidebar />

      {/* Main Content Area */}
      <div className="sl-main-content">
        {/* Top bar matching Image 2 */}
        <header className="sl-topbar">
          <div className="sl-topbar-left">
            <button className="sl-nav-arrow" onClick={() => window.history.back()} aria-label="Atrás">
              <ChevronLeft size={18} />
            </button>
            <button className="sl-nav-arrow" onClick={() => window.history.forward()} aria-label="Adelante">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="sl-search-container">
            <Search className="sl-search-icon" size={18} />
            <input
              type="text"
              className="sl-search-input"
              placeholder="Buscar canciones, artistas o lanzamientos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="sl-topbar-right">
            <button className="sl-icon-btn" title="Notificaciones">
              <Bell size={18} />
            </button>
            <Link to="/perfil-artistico">
              <img
                src="/images/sonic-listener.png"
                alt="Avatar"
                className="sl-user-avatar"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </Link>
          </div>
        </header>

        {/* Releases Container */}
        <div className="sl-releases-container">
          {notice && (
            <div
              className={`sl-notice-box ${notice.type === 'error' ? 'sl-notice-error' : 'sl-notice-success'}`}
            >
              {notice.text}
            </div>
          )}

          {/* Banner matching Image 2 */}
          <div className="sl-header-banner">
            <div className="sl-banner-left">
              <div className="sl-banner-icon-box">
                <Layers size={36} />
              </div>
              <div className="sl-banner-info">
                <h1>Mis lanzamientos</h1>
                <p>Organiza y gestiona tus sencillos, EP y álbumes.</p>
              </div>
            </div>

            <img
              src="/images/sonic-headphones.webp"
              alt="Audífonos neón"
              className="sl-banner-art"
            />

            <button className="sl-create-btn" onClick={openCreateModal}>
              <Plus size={18} />
              <span>Crear lanzamiento</span>
            </button>
          </div>

          {/* Filter Bar matching Image 2 */}
          <div className="sl-filter-bar">
            <button
              className={`sl-filter-pill ${filterTipo === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterTipo('ALL')}
            >
              <LayoutGrid size={16} />
              <span>Todos</span>
            </button>
            <button
              className={`sl-filter-pill ${filterTipo === 'SINGLE' ? 'active' : ''}`}
              onClick={() => setFilterTipo('SINGLE')}
            >
              <Disc size={16} />
              <span>Sencillos</span>
            </button>
            <button
              className={`sl-filter-pill ${filterTipo === 'EP' ? 'active' : ''}`}
              onClick={() => setFilterTipo('EP')}
            >
              <Layers size={16} />
              <span>EP</span>
            </button>
            <button
              className={`sl-filter-pill ${filterTipo === 'ALBUM' ? 'active' : ''}`}
              onClick={() => setFilterTipo('ALBUM')}
            >
              <Disc size={16} />
              <span>Álbumes</span>
            </button>
          </div>

          {/* Grid of Releases matching Image 2 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#baa4d4' }}>
              Cargando tus lanzamientos...
            </div>
          ) : releases.length === 0 ? (
            <div className="sl-empty-state">
              <div className="sl-empty-icon">
                <Layers size={40} />
              </div>
              <h3>Todavía no tienes lanzamientos</h3>
              <p>
                Organiza tus canciones publicadas en sencillos, EPs o álbumes para compartirlas en el
                catálogo de Sonic Ledger.
              </p>
              <button className="sl-create-btn" onClick={openCreateModal}>
                <Plus size={18} />
                <span>Crear mi primer lanzamiento</span>
              </button>
            </div>
          ) : (
            <div className="sl-releases-grid">
              {releases.map((rel) => {
                const cover = releaseCoverUrl(base, rel.portadaUrl);
                const isPublished = rel.estado === 'publicado';

                return (
                  <div key={rel.id} className="sl-release-card">
                    <div className="sl-card-top">
                      <div className="sl-card-cover-wrap">
                        {cover ? (
                          <img src={cover} alt={rel.titulo} className="sl-card-cover" />
                        ) : (
                          <div className="sl-card-cover-fallback">
                            <Layers size={32} />
                          </div>
                        )}
                      </div>

                      <div className="sl-card-meta">
                        <div className="sl-card-status-row">
                          {isPublished ? (
                            <span className="sl-badge-publicado">● Publicado</span>
                          ) : (
                            <span className="sl-badge-borrador">● Borrador</span>
                          )}
                          <button className="sl-card-dots-btn" aria-label="Opciones">
                            <MoreVertical size={16} />
                          </button>
                        </div>

                        <h3 className="sl-card-title" title={rel.titulo}>
                          {rel.titulo}
                        </h3>

                        <div className="sl-card-detail-item">
                          <Disc size={14} />
                          <span>{releaseTypeLabel(rel.tipo)}</span>
                        </div>

                        <div className="sl-card-detail-item">
                          <Calendar size={14} />
                          <span>{formatReleaseDate(rel.fechaLanzamiento || rel.createdAt)}</span>
                        </div>

                        <div className="sl-card-detail-item">
                          <Music size={14} />
                          <span>
                            {rel.cancionCount} {rel.cancionCount === 1 ? 'canción' : 'canciones'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons matching Image 2 */}
                    <div className="sl-card-actions">
                      <button
                        className="sl-btn-action"
                        onClick={() => openEditModal(rel)}
                      >
                        <Edit2 size={14} />
                        <span>Editar</span>
                      </button>

                      <button
                        className={`sl-btn-action ${isPublished ? 'disabled' : 'publish-highlight'}`}
                        disabled={isPublished}
                        onClick={() => !isPublished && handleDirectPublish(rel)}
                      >
                        <Play size={14} fill={isPublished ? 'none' : 'currentColor'} />
                        <span>Publicar</span>
                      </button>

                      <button
                        className="sl-btn-action delete"
                        onClick={() => setDeletingId(rel.id)}
                      >
                        <Trash2 size={14} />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal / View */}
      {(isCreatingNew || editingRelease) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 2, 12, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            overflowY: 'auto',
          }}
        >
          <div className="sl-editor-container" style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="sl-editor-header">
              <button className="sl-back-link" onClick={closeModal}>
                <ChevronLeft size={18} />
                <span>Volver a Mis lanzamientos</span>
              </button>
              <h2 className="sl-editor-title">
                {isCreatingNew ? 'Crear lanzamiento' : `Editar "${editingRelease?.titulo}"`}
              </h2>
              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: 'none', color: '#baa4d4', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Paso 1: Tipo de lanzamiento */}
            <div className="sl-form-section">
              <div className="sl-section-heading">
                <Disc size={18} color="#00f0ff" />
                <span>1. Tipo de lanzamiento *</span>
              </div>
              <div className="sl-type-cards">
                <div
                  className={`sl-type-card ${editorTipo === 'SINGLE' ? 'selected' : ''}`}
                  onClick={() => setEditorTipo('SINGLE')}
                >
                  {editorTipo === 'SINGLE' && (
                    <div className="sl-type-card-badge">
                      <Check size={12} />
                    </div>
                  )}
                  <Music size={28} color="#e024ff" />
                  <span className="sl-type-title">Sencillo</span>
                  <span className="sl-type-sub">1 canción</span>
                </div>

                <div
                  className={`sl-type-card ${editorTipo === 'EP' ? 'selected' : ''}`}
                  onClick={() => setEditorTipo('EP')}
                >
                  {editorTipo === 'EP' && (
                    <div className="sl-type-card-badge">
                      <Check size={12} />
                    </div>
                  )}
                  <Layers size={28} color="#e024ff" />
                  <span className="sl-type-title">EP</span>
                  <span className="sl-type-sub">2 – 6 canciones</span>
                </div>

                <div
                  className={`sl-type-card ${editorTipo === 'ALBUM' ? 'selected' : ''}`}
                  onClick={() => setEditorTipo('ALBUM')}
                >
                  {editorTipo === 'ALBUM' && (
                    <div className="sl-type-card-badge">
                      <Check size={12} />
                    </div>
                  )}
                  <Disc size={28} color="#e024ff" />
                  <span className="sl-type-title">Álbum</span>
                  <span className="sl-type-sub">7 o más canciones</span>
                </div>
              </div>
            </div>

            {/* Paso 2: Información básica */}
            <div className="sl-form-section">
              <div className="sl-section-heading">
                <Edit2 size={18} color="#00f0ff" />
                <span>2. Información básica</span>
              </div>

              <div className="sl-form-group">
                <label className="sl-form-label">Título del lanzamiento *</label>
                <input
                  type="text"
                  className="sl-text-input"
                  maxLength={100}
                  placeholder="Ej: Luz Intermitente"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                />
                <div className="sl-char-counter">{editorTitle.length}/100</div>
              </div>

              <div className="sl-form-group">
                <label className="sl-form-label">Descripción (opcional)</label>
                <textarea
                  className="sl-textarea"
                  rows={3}
                  maxLength={2000}
                  placeholder="Detalles sobre este lanzamiento musical..."
                  value={editorDesc}
                  onChange={(e) => setEditorDesc(e.target.value)}
                />
              </div>
            </div>

            {/* Paso 3: Portada */}
            <div className="sl-form-section">
              <div className="sl-section-heading">
                <ImageIcon size={18} color="#00f0ff" />
                <span>3. Portada del lanzamiento</span>
              </div>

              <div className="sl-cover-uploader">
                <div className="sl-cover-preview-box">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Preview" className="sl-cover-preview-img" />
                  ) : (
                    <ImageIcon size={32} color="#795b9c" />
                  )}
                </div>

                <div>
                  <label
                    className="sl-btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  >
                    <Upload size={16} />
                    <span>{coverPreview ? 'Cambiar portada' : 'Seleccionar imagen'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={handleCoverSelect}
                    />
                  </label>
                  <p style={{ fontSize: '12px', color: '#baa4d4', marginTop: 8 }}>
                    Formatos JPG o PNG, cuadrada, máximo 2 MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Paso 4: Selección y organización de canciones */}
            <div className="sl-form-section">
              <div className="sl-section-heading">
                <Music size={18} color="#00f0ff" />
                <span>
                  4. Canciones del lanzamiento * ({selectedTrackIds.length} seleccionadas)
                </span>
              </div>

              {availableSongs.length === 0 ? (
                <div style={{ padding: '24px', background: 'rgba(22, 10, 42, 0.6)', borderRadius: 12 }}>
                  <p style={{ margin: 0, color: '#baa4d4' }}>
                    Todavía no tienes canciones disponibles. Puedes publicar una canción primero desde la
                    sección "Publicar canción".
                  </p>
                </div>
              ) : (
                <div className="sl-tracklist">
                  {/* First display selected tracks in order with arrows */}
                  {selectedTrackIds.map((id, index) => {
                    const song = availableSongs.find((s) => s.id === id);
                    if (!song) return null;

                    return (
                      <div key={song.id} className="sl-track-row" style={{ borderColor: '#d414a8' }}>
                        <input
                          type="checkbox"
                          className="sl-track-checkbox"
                          checked={true}
                          onChange={() => toggleTrack(song.id)}
                        />
                        <span className="sl-track-num">{index + 1}</span>
                        <span className="sl-track-title">{song.titulo}</span>
                        <span className="sl-track-duration">{formatDuration(song.duracionSegundos)}</span>
                        {song.audioUrl && (
                          <button
                            className="sl-track-order-btn"
                            title="Escuchar"
                            onClick={() => playSongPreview(song)}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        <div className="sl-track-controls">
                          <button
                            className="sl-track-order-btn"
                            disabled={index === 0}
                            title="Subir"
                            onClick={() => moveTrack(index, 'up')}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            className="sl-track-order-btn"
                            disabled={index === selectedTrackIds.length - 1}
                            title="Bajar"
                            onClick={() => moveTrack(index, 'down')}
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Then display unselected available songs */}
                  {availableSongs
                    .filter((s) => !selectedTrackIds.includes(s.id))
                    .map((song) => (
                      <div key={song.id} className="sl-track-row">
                        <input
                          type="checkbox"
                          className="sl-track-checkbox"
                          checked={false}
                          onChange={() => toggleTrack(song.id)}
                        />
                        <span className="sl-track-num">-</span>
                        <span className="sl-track-title">{song.titulo}</span>
                        <span className="sl-track-duration">
                          {formatDuration(song.duracionSegundos)}
                        </span>
                        {song.audioUrl && (
                          <button
                            className="sl-track-order-btn"
                            title="Escuchar"
                            onClick={() => playSongPreview(song)}
                          >
                            <Play size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Editor Actions Footer */}
            <div className="sl-editor-footer">
              <button className="sl-btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button className="sl-btn-secondary" onClick={handleSaveDraft} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar borrador'}
              </button>
              <button className="sl-btn-primary" onClick={handlePublishFromModal} disabled={saving}>
                {saving ? 'Publicando...' : 'Publicar lanzamiento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 2, 12, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#140727',
              border: '1px solid rgba(255, 23, 68, 0.4)',
              borderRadius: 18,
              padding: 28,
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, color: '#ffffff' }}>
              ¿Eliminar lanzamiento?
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#baa4d4', lineHeight: 1.5 }}>
              Esta acción eliminará el lanzamiento. Las canciones asociadas no se borrarán y seguirán
              disponibles en tu perfil artístico.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="sl-btn-secondary" onClick={() => setDeletingId(null)}>
                Cancelar
              </button>
              <button
                className="sl-btn-action delete"
                style={{ background: '#d50000', color: '#ffffff', borderColor: '#d50000' }}
                onClick={handleConfirmDelete}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
