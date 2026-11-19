import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SonicSidebar, SidebarToggle } from './components/SonicSidebar';
import {
  AlertTriangle,
  ArrowLeft,
  AudioLines,
  Ban,
  BarChart3,
  Calendar,
  DollarSign,
  Edit3,
  ExternalLink,
  MapPin,
  Plus,
  Send,
  Ticket,
  Trash2,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import {
  addConcertArtist,
  addConcertCategory,
  cancelarConcierto,
  createConcertDraft,
  deleteConcertArtist,
  deleteConcertCategory,
  fetchOrganizerConcertDetail,
  fetchOrganizerConcerts,
  fetchPlatformArtists,
  publishConcert,
  updateConcert,
  uploadConcertCover,
} from '../../shared/concerts-api';
import type {
  Concert,
  ConcertArtist,
  ConcertTicketCategory,
  CreateConcertPayload,
  CreateTicketCategoryPayload,
} from '../../shared/concerts';
import {
  obtenerEstadisticasConcierto,
  obtenerReembolsosConciertoOrganizador,
  procesarReembolsoSimulado,
} from '../../shared/ticketing-api';
import type {
  EstadisticasConcierto,
  ResumenReembolsosOrganizador,
} from '../../shared/ticketing';
import { request, type User } from './auth-api';
import './OrganizerConcerts.css';

const BOLIVIAN_DEPARTMENTS = [
  'La Paz',
  'Santa Cruz',
  'Cochabamba',
  'Tarija',
  'Chuquisaca',
  'Oruro',
  'Potosí',
  'Beni',
  'Pando',
];

export function OrganizerConcertsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [tab, setTab] = useState<'all' | 'draft' | 'published' | 'cancelled'>('all');
  const [activeSection, setActiveSection] = useState<'conciertos' | 'estadisticas'>('conciertos');
  const [loading, setLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // CU17: Modal de Cancelación de Concierto
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingConcert, setCancellingConcert] = useState<Concert | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  // CU24: Estadísticas de Ventas y Asistencia
  const [selectedStatsConcertId, setSelectedStatsConcertId] = useState<string>('');
  const [concertStats, setConcertStats] = useState<EstadisticasConcierto | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  // Sandbox Modal State
  const [isSandboxModalOpen, setIsSandboxModalOpen] = useState(false);
  const [sandboxRefunds, setSandboxRefunds] = useState<ResumenReembolsosOrganizador | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxMessage, setSandboxMessage] = useState('');

  // Modal de creación / edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConcertId, setEditingConcertId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Plataforma de artistas para selector
  const [platformArtists, setPlatformArtists] = useState<
    Array<{ id: string; nombre: string; avatarUrl?: string | null }>
  >([]);

  // Form state
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formGenero, setFormGenero] = useState('');
  const [formFechaInicio, setFormFechaInicio] = useState('');
  const [formFechaFin, setFormFechaFin] = useState('');
  const [formInicioVenta, setFormInicioVenta] = useState('');
  const [formZonaHoraria, setFormZonaHoraria] = useState('America/La_Paz');
  const [formRecinto, setFormRecinto] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formCiudad, setFormCiudad] = useState('La Paz');
  const [formDepartamento, setFormDepartamento] = useState('La Paz');
  const [formDestacado, setFormDestacado] = useState(false);

  // Subida de imagen
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // Sub-elementos de concierto en edición
  const [editingCategorias, setEditingCategorias] = useState<ConcertTicketCategory[]>([]);
  const [editingArtistas, setEditingArtistas] = useState<ConcertArtist[]>([]);

  // Nuevos sub-elementos para añadir
  const [newCatNombre, setNewCatNombre] = useState('General');
  const [newCatPrecio, setNewCatPrecio] = useState('100');
  const [newCatCupo, setNewCatCupo] = useState('150');

  const [newArtType, setNewArtType] = useState<'platform' | 'manual'>('platform');
  const [newArtSelectedId, setNewArtSelectedId] = useState('');
  const [newArtManualName, setNewArtManualName] = useState('');

  // 1. Verificar rol ORGANIZADOR
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const me = await request<User & { roles?: string[] }>('me');
        if (active) {
          setCurrentUser(me);
          const roles = Array.isArray(me.roles)
            ? me.roles
            : me.role
            ? [me.role]
            : [];
          if (!roles.includes('ORGANIZADOR') && !roles.includes('ADMIN')) {
            setAuthorized(false);
          } else {
            setAuthorized(true);
          }
        }
      } catch {
        if (active) {
          setAuthorized(false);
          navigate('/iniciar-sesion');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  // 2. Cargar conciertos del organizador y artistas de la plataforma
  const loadMyConcerts = async () => {
    setLoading(true);
    try {
      const list = await fetchOrganizerConcerts();
      setConcerts(list);
    } catch (e: any) {
      setGlobalMessage({
        type: 'error',
        text: e.message || 'No se pudieron cargar tus conciertos.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      void loadMyConcerts();
      void fetchPlatformArtists()
        .then((arts) => {
          setPlatformArtists(arts);
          if (arts.length > 0) setNewArtSelectedId(arts[0].id);
        })
        .catch(() => {});
    }
  }, [authorized]);

  const openCreateModal = () => {
    setEditingConcertId(null);
    setFormTitulo('');
    setFormDescripcion('');
    setFormGenero('');
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 86400000 * 14); // 2 semanas adelante
    const defaultEnd = new Date(defaultStart.getTime() + 3600000 * 5); // 5 horas de show
    setFormFechaInicio(defaultStart.toISOString().slice(0, 16));
    setFormFechaFin(defaultEnd.toISOString().slice(0, 16));
    setFormInicioVenta(now.toISOString().slice(0, 16));
    setFormZonaHoraria('America/La_Paz');
    setFormRecinto('');
    setFormDireccion('');
    setFormCiudad('La Paz');
    setFormDepartamento('La Paz');
    setFormDestacado(false);
    setCoverPreview(null);
    setCoverFile(null);
    setEditingCategorias([]);
    setEditingArtistas([]);
    setModalError('');
    setModalSuccess('');
    setIsModalOpen(true);
  };

  const openEditModal = async (concertId: string) => {
    setEditingConcertId(concertId);
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');
    setIsModalOpen(true);

    try {
      const data = await fetchOrganizerConcertDetail(concertId);
      setFormTitulo(data.titulo);
      setFormDescripcion(data.descripcion);
      setFormGenero(data.genero);
      setFormFechaInicio(new Date(data.fechaInicio).toISOString().slice(0, 16));
      setFormFechaFin(new Date(data.fechaFin).toISOString().slice(0, 16));
      setFormInicioVenta(
        data.inicioVenta ? new Date(data.inicioVenta).toISOString().slice(0, 16) : ''
      );
      setFormZonaHoraria(data.zonaHoraria || 'America/La_Paz');
      setFormRecinto(data.recinto);
      setFormDireccion(data.direccion);
      setFormCiudad(data.ciudad);
      setFormDepartamento(data.departamento);
      setFormDestacado(data.destacado);
      setCoverPreview(data.portadaUrl);
      setCoverFile(null);
      setEditingCategorias(data.categorias || []);
      setEditingArtistas(data.artistas || []);
    } catch (e: any) {
      setModalError(e.message || 'Error al cargar los datos del concierto.');
    } finally {
      setModalLoading(false);
    }
  };

  // Guardar datos básicos
  const handleSaveConcert = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    if (!formTitulo.trim()) {
      setModalError('El título del concierto es obligatorio.');
      return;
    }
    if (!formRecinto.trim() || !formDireccion.trim()) {
      setModalError('El recinto y la dirección son obligatorios.');
      return;
    }

    const payload: CreateConcertPayload = {
      titulo: formTitulo.trim(),
      descripcion: formDescripcion.trim(),
      genero: formGenero.trim(),
      fechaInicio: new Date(formFechaInicio).toISOString(),
      fechaFin: new Date(formFechaFin).toISOString(),
      inicioVenta: formInicioVenta ? new Date(formInicioVenta).toISOString() : null,
      zonaHoraria: formZonaHoraria,
      recinto: formRecinto.trim(),
      direccion: formDireccion.trim(),
      ciudad: formCiudad.trim(),
      departamento: formDepartamento.trim(),
      destacado: formDestacado,
    };

    try {
      let savedConcert: Concert;
      if (editingConcertId) {
        savedConcert = await updateConcert(editingConcertId, payload);
      } else {
        savedConcert = await createConcertDraft(payload);
        setEditingConcertId(savedConcert.id);
      }

      // Si hay archivo de portada para subir
      if (coverFile) {
        const coverRes = await uploadConcertCover(savedConcert.id, coverFile);
        savedConcert.portadaUrl = coverRes.coverUrl;
        setCoverPreview(coverRes.coverUrl);
        setCoverFile(null);
      }

      setModalSuccess('Concierto guardado correctamente como borrador.');
      void loadMyConcerts();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar el concierto.');
    }
  };

  // Subir portada directa
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setModalError('Solo se permiten imágenes en formato JPG o PNG.');
      return;
    }

    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview(objectUrl);

    // Si ya existe el concierto, lo subimos de inmediato
    if (editingConcertId) {
      try {
        const res = await uploadConcertCover(editingConcertId, file);
        setCoverPreview(res.coverUrl);
        setCoverFile(null);
        setModalSuccess('Portada actualizada con éxito.');
        void loadMyConcerts();
      } catch (err: any) {
        setModalError(err.message || 'Error al subir la portada.');
      }
    }
  };

  // Añadir categoría
  const handleAddCategory = async () => {
    if (!editingConcertId) {
      setModalError('Debes guardar el concierto primero antes de añadir categorías.');
      return;
    }

    const precio = parseFloat(newCatPrecio);
    const cupo = parseInt(newCatCupo, 10);

    if (isNaN(precio) || precio < 0) {
      setModalError('El precio debe ser un número no negativo en BOB.');
      return;
    }
    if (isNaN(cupo) || cupo <= 0) {
      setModalError('El cupo debe ser mayor a 0.');
      return;
    }

    const payload: CreateTicketCategoryPayload = {
      nombre: newCatNombre.trim(),
      precio,
      moneda: 'BOB',
      cupoTotal: cupo,
      disponible: true,
    };

    try {
      const added = await addConcertCategory(editingConcertId, payload);
      setEditingCategorias((prev) => [...prev, added]);
      setModalSuccess(`Categoría "${added.nombre}" añadida.`);
      setNewCatNombre('');
      void loadMyConcerts();
    } catch (err: any) {
      setModalError(err.message || 'Error al añadir categoría.');
    }
  };

  // Eliminar categoría
  const handleDeleteCategory = async (catId: string) => {
    if (!editingConcertId) return;
    try {
      await deleteConcertCategory(editingConcertId, catId);
      setEditingCategorias((prev) => prev.filter((c) => c.id !== catId));
      void loadMyConcerts();
    } catch (err: any) {
      setModalError(err.message || 'Error al eliminar categoría.');
    }
  };

  // Añadir artista
  const handleAddArtist = async () => {
    if (!editingConcertId) {
      setModalError('Debes guardar el concierto primero antes de asociar artistas.');
      return;
    }

    let payload = {
      nombreArtista: newArtManualName.trim(),
      artistaId: undefined as string | undefined,
    };

    if (newArtType === 'platform') {
      const found = platformArtists.find((a) => a.id === newArtSelectedId);
      if (!found) {
        setModalError('Selecciona un artista de la lista.');
        return;
      }
      payload.artistaId = found.id;
      payload.nombreArtista = found.nombre;
    } else {
      if (!newArtManualName.trim()) {
        setModalError('Ingresa el nombre del artista.');
        return;
      }
    }

    try {
      const added = await addConcertArtist(editingConcertId, payload);
      setEditingArtistas((prev) => [...prev, added]);
      setModalSuccess(`Artista "${added.nombreArtista}" vinculado.`);
      setNewArtManualName('');
      void loadMyConcerts();
    } catch (err: any) {
      setModalError(err.message || 'Error al asociar artista.');
    }
  };

  // Eliminar artista
  const handleDeleteArtist = async (relId: string) => {
    if (!editingConcertId) return;
    try {
      await deleteConcertArtist(editingConcertId, relId);
      setEditingArtistas((prev) => prev.filter((a) => a.id !== relId));
      void loadMyConcerts();
    } catch (err: any) {
      setModalError(err.message || 'Error al quitar artista.');
    }
  };

  // Publicar concierto (CU16)
  const handlePublish = async (concertId: string) => {
    setGlobalMessage(null);
    try {
      const published = await publishConcert(concertId);
      setGlobalMessage({
        type: 'success',
        text: `¡Concierto "${published.titulo}" publicado exitosamente! Ahora es visible para el público.`,
      });
      void loadMyConcerts();
      if (isModalOpen) setIsModalOpen(false);
    } catch (err: any) {
      const msg = err.message || 'No se pudo publicar el concierto.';
      setGlobalMessage({ type: 'error', text: msg });
      if (isModalOpen) setModalError(msg);
    }
  };

  // CU17: Abrir modal de cancelación
  const openCancelModal = (c: Concert) => {
    setCancellingConcert(c);
    setCancelMotivo('');
    setCancelError('');
    setIsCancelModalOpen(true);
  };

  // CU17: Ejecutar cancelación con motivo obligatorio
  const handleConfirmCancel = async () => {
    if (!cancellingConcert) return;
    const motivoLimpio = cancelMotivo.trim();
    if (motivoLimpio.length < 5) {
      setCancelError('Debes ingresar un motivo de cancelación claro (mínimo 5 caracteres).');
      return;
    }

    setCancelLoading(true);
    setCancelError('');
    try {
      await cancelarConcierto(cancellingConcert.id, { motivo: motivoLimpio });
      setGlobalMessage({
        type: 'success',
        text: `El concierto "${cancellingConcert.titulo}" ha sido cancelado. Las órdenes pendientes se anularon y los tickets han sido invalidados.`,
      });
      setIsCancelModalOpen(false);
      setCancellingConcert(null);
      void loadMyConcerts();

      // Si estábamos viendo estadísticas de este concierto, actualizarlas
      if (selectedStatsConcertId === cancellingConcert.id) {
        void loadStatsForConcert(cancellingConcert.id);
      }
    } catch (err: any) {
      setCancelError(err.message || 'Error al procesar la cancelación del concierto.');
    } finally {
      setCancelLoading(false);
    }
  };

  // CU24: Cargar estadísticas de un concierto
  const loadStatsForConcert = async (concertId: string) => {
    if (!concertId) return;
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await obtenerEstadisticasConcierto(concertId);
      setConcertStats(data);
    } catch (err: any) {
      setStatsError(err.message || 'No se pudieron obtener las estadísticas del concierto.');
      setConcertStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleOpenSandbox = async (conciertoId: string) => {
    setIsSandboxModalOpen(true);
    setSandboxLoading(true);
    setSandboxMessage('');
    try {
      const data = await obtenerReembolsosConciertoOrganizador(conciertoId);
      setSandboxRefunds(data);
    } catch (e: any) {
      setSandboxMessage(e.message || 'Error al cargar devoluciones.');
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleProcessRefundAction = async (reembolsoId: string, accion: 'COMPLETAR' | 'FALLAR') => {
    setSandboxLoading(true);
    setSandboxMessage('');
    try {
      await procesarReembolsoSimulado({ reembolsoId, accion });
      setSandboxMessage(`Devolución ${accion === 'COMPLETAR' ? 'completada' : 'rechazada'} exitosamente en el simulador.`);
      if (selectedStatsConcertId) {
        const data = await obtenerReembolsosConciertoOrganizador(selectedStatsConcertId);
        setSandboxRefunds(data);
        void loadStatsForConcert(selectedStatsConcertId);
      }
    } catch (e: any) {
      setSandboxMessage(e.message || 'Error al procesar la devolución.');
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleSwitchToStats = (concertId?: string) => {
    setActiveSection('estadisticas');
    const targetId = concertId || selectedStatsConcertId || (concerts.length > 0 ? concerts[0].id : '');
    if (targetId) {
      setSelectedStatsConcertId(targetId);
      void loadStatsForConcert(targetId);
    }
  };

  // Efecto cuando cambia la sección a estadísticas o la lista de conciertos se carga
  useEffect(() => {
    if (activeSection === 'estadisticas' && concerts.length > 0 && !selectedStatsConcertId) {
      const firstId = concerts[0].id;
      setSelectedStatsConcertId(firstId);
      void loadStatsForConcert(firstId);
    }
  }, [activeSection, concerts]);

  if (authorized === false) {
    return (
      <div className="organizer-page">
        <div className="organizer-shell" style={{ paddingTop: '80px', textAlign: 'center' }}>
          <h2>Acceso restringido</h2>
          <p style={{ color: '#cdbedb', margin: '16px 0' }}>
            Se requiere el rol de ORGANIZADOR para administrar conciertos.
          </p>
          <Link to="/explorar" className="btn-cancel">
            Volver a Explorar
          </Link>
        </div>
      </div>
    );
  }

  const filteredConcerts = concerts.filter((c) => {
    if (tab === 'draft') return c.estado === 'BORRADOR';
    if (tab === 'published') return c.estado === 'PUBLICADO';
    if (tab === 'cancelled') return c.estado === 'CANCELADO';
    return true;
  });

  return (
    <div className="organizer-page">
      <SonicSidebar mode="drawer" />
      {/* Header Bar */}
      <div className="organizer-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <SidebarToggle />
          <Link to="/conciertos" className="concerts-brand">
            <span className="concerts-brand-mark">
              <AudioLines size={22} />
            </span>
            <span>
              sonic<span>ledger</span>.
            </span>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/conciertos" className="concerts-nav-link">
            <ArrowLeft size={16} /> Ver Catálogo Público
          </Link>
          <Link to="/perfil" className="concerts-nav-link">
            <UserRound size={16} /> {currentUser?.username}
          </Link>
        </div>
      </div>

      <main className="organizer-shell">
        {/* Navegación Principal de Secciones: Conciertos vs Estadísticas */}
        <div className="stats-main-nav">
          <button
            className={`stats-nav-btn ${activeSection === 'conciertos' ? 'active' : ''}`}
            onClick={() => setActiveSection('conciertos')}
          >
            <Ticket size={18} /> Mis Conciertos
          </button>
          <button
            className={`stats-nav-btn ${activeSection === 'estadisticas' ? 'active' : ''}`}
            onClick={() => handleSwitchToStats()}
          >
            <BarChart3 size={18} /> Ventas y Asistencia (CU24)
          </button>
        </div>

        {globalMessage && (
          <div
            className={`alert-message ${
              globalMessage.type === 'success' ? 'alert-success' : 'alert-error'
            }`}
          >
            {globalMessage.text}
          </div>
        )}

        {/* SECCIÓN 1: MIS CONCIERTOS */}
        {activeSection === 'conciertos' && (
          <>
            <div className="organizer-title-area">
              <div className="organizer-heading">
                <h1>Mis Conciertos</h1>
                <p>Gestiona, configura, publica y administra el ciclo de vida de tus eventos.</p>
              </div>

              <button className="btn-create-concert" onClick={openCreateModal}>
                <Plus size={18} /> Crear Concierto
              </button>
            </div>

            {/* Tabs de Filtro */}
            <div className="organizer-tabs">
              <button
                className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
                onClick={() => setTab('all')}
              >
                Todos ({concerts.length})
              </button>
              <button
                className={`tab-btn ${tab === 'draft' ? 'active' : ''}`}
                onClick={() => setTab('draft')}
              >
                Borradores ({concerts.filter((c) => c.estado === 'BORRADOR').length})
              </button>
              <button
                className={`tab-btn ${tab === 'published' ? 'active' : ''}`}
                onClick={() => setTab('published')}
              >
                Publicados ({concerts.filter((c) => c.estado === 'PUBLICADO').length})
              </button>
              <button
                className={`tab-btn ${tab === 'cancelled' ? 'active' : ''}`}
                onClick={() => setTab('cancelled')}
              >
                Cancelados ({concerts.filter((c) => c.estado === 'CANCELADO').length})
              </button>
            </div>

            {/* Listado de Conciertos */}
            {loading ? (
              <p style={{ textAlign: 'center', color: '#cdbedb', padding: '40px 0' }}>
                Cargando tus conciertos...
              </p>
            ) : filteredConcerts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Ticket size={28} />
                </div>
                <h3>No tienes conciertos en esta categoría</h3>
                <p>Crea tu primer concierto haciendo clic en el botón "Crear Concierto".</p>
              </div>
            ) : (
              <div className="organizer-grid">
                {filteredConcerts.map((c) => (
                  <div key={c.id} className="org-card">
                    <div className="org-card-cover">
                      <img
                        src={c.portadaUrl || '/images/sonic-listener.png'}
                        alt={c.titulo}
                      />
                      {c.estado === 'BORRADOR' && (
                        <span className="badge-state-draft">Borrador</span>
                      )}
                      {c.estado === 'PUBLICADO' && (
                        <span className="badge-state-published">Publicado</span>
                      )}
                      {c.estado === 'CANCELADO' && (
                        <span className="badge-state-cancelled">Cancelado</span>
                      )}
                    </div>

                    <div className="org-card-body">
                      <h3 className="org-card-title">{c.titulo}</h3>
                      <div className="org-card-meta">
                        <Calendar size={14} color="#f472b6" />
                        {new Date(c.fechaInicio).toLocaleDateString('es-BO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="org-card-meta">
                        <MapPin size={14} color="#38bdf8" />
                        {c.recinto}, {c.ciudad}
                      </div>

                      {c.estado === 'CANCELADO' && (
                        <div
                          className="org-card-meta"
                          style={{
                            color: '#fca5a5',
                            background: 'rgba(239, 68, 68, 0.12)',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <Ban size={14} /> Motivo: {c.motivoCancelacion || 'Cancelado'}
                        </div>
                      )}

                      <div className="org-card-stats">
                        <span>
                          Entradas: <strong>{c.categorias?.length || 0} categorías</strong>
                        </span>
                        <span>
                          {c.precioMinimo !== null ? `Desde Bs. ${c.precioMinimo}` : 'Sin precio'}
                        </span>
                      </div>

                      <div className="org-card-actions">
                        {c.estado !== 'CANCELADO' && (
                          <button
                            className="btn-card-action btn-edit"
                            onClick={() => openEditModal(c.id)}
                          >
                            <Edit3 size={14} /> Editar / Configurar
                          </button>
                        )}

                        {c.estado === 'BORRADOR' && (
                          <button
                            className="btn-card-action btn-publish"
                            onClick={() => handlePublish(c.id)}
                          >
                            <Send size={14} /> Publicar
                          </button>
                        )}

                        {c.estado === 'PUBLICADO' && (
                          <>
                            <Link
                              to={`/conciertos/${c.id}`}
                              className="btn-card-action btn-view-pub"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={14} /> Ver en público
                            </Link>

                            <button
                              className="btn-card-action btn-stats"
                              onClick={() => handleSwitchToStats(c.id)}
                            >
                              <BarChart3 size={14} /> Estadísticas
                            </button>

                            <button
                              className="btn-card-action btn-cancel-concert"
                              onClick={() => openCancelModal(c)}
                            >
                              <XCircle size={14} /> Cancelar Concierto
                            </button>
                          </>
                        )}

                        {c.estado === 'CANCELADO' && (
                          <>
                            <Link
                              to={`/conciertos/${c.id}`}
                              className="btn-card-action btn-view-pub"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink size={14} /> Ver aviso público
                            </Link>

                            <button
                              className="btn-card-action btn-stats"
                              onClick={() => handleSwitchToStats(c.id)}
                            >
                              <BarChart3 size={14} /> Ver Estadísticas y Reembolsos
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SECCIÓN 2: VENTAS Y ASISTENCIA (CU24) */}
        {activeSection === 'estadisticas' && (
          <div>
            <div className="organizer-title-area">
              <div className="organizer-heading">
                <h1>Ventas y Asistencia</h1>
                <p>Indicadores clave de ocupación, órdenes, recaudación y control de accesos.</p>
              </div>
            </div>

            {/* Selector de Concierto */}
            <div className="stats-selector-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ color: '#cdbedb', fontWeight: 600, fontSize: '0.9rem' }}>
                  Selecciona Concierto:
                </label>
                <select
                  className="stats-select-input"
                  value={selectedStatsConcertId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setSelectedStatsConcertId(newId);
                    void loadStatsForConcert(newId);
                  }}
                >
                  {concerts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo} [{c.estado}]
                    </option>
                  ))}
                </select>
              </div>

              <span className="badge-test-payment">
                <DollarSign size={14} /> Modo demostración — Sin cargos ni devoluciones reales
              </span>
            </div>

            {statsLoading && (
              <p style={{ textAlign: 'center', color: '#cdbedb', padding: '40px 0' }}>
                Cargando métricas de ventas y asistencia...
              </p>
            )}

            {statsError && <div className="alert-message alert-error">{statsError}</div>}

            {!statsLoading && !statsError && !concertStats && (
              <div className="empty-state">
                <BarChart3 size={32} />
                <h3>No hay datos disponibles</h3>
                <p>Selecciona un concierto para consultar sus estadísticas de ventas y aforo.</p>
              </div>
            )}

            {!statsLoading && concertStats && (
              <>
                {/* Alerta si el evento está cancelado */}
                {concertStats.estado === 'CANCELADO' && (
                  <div
                    className="alert-message alert-error"
                    style={{
                      padding: '18px 22px',
                      borderRadius: '16px',
                      marginBottom: '24px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.05rem', fontWeight: 800 }}>
                      <AlertTriangle size={20} /> Concierto Cancelado
                    </div>
                    <p style={{ margin: '8px 0 4px', fontSize: '0.92rem' }}>
                      <strong>Motivo:</strong> {concertStats.motivoCancelacion || 'Cancelado por el organizador.'}
                    </p>
                    {concertStats.canceladoEn && (
                      <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#fca5a5' }}>
                        Fecha de cancelación: {new Date(concertStats.canceladoEn).toLocaleString('es-BO')}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '10px' }}>
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          color: '#fecaca',
                        }}
                      >
                        Pendiente de devolución: Bs. {concertStats.montoPendienteReembolsoBob.toFixed(2)} BOB ({concertStats.ordenesPendienteReembolso} órdenes)
                      </div>

                      {concertStats.montoReembolsadoBob !== undefined && concertStats.montoReembolsadoBob > 0 && (
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            color: '#6ee7b7',
                          }}
                        >
                          Devuelto completado: Bs. {concertStats.montoReembolsadoBob.toFixed(2)} BOB ({concertStats.ordenesReembolsadas || 0} órdenes)
                        </div>
                      )}

                      <button
                        type="button"
                        style={{
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                          border: 'none',
                          color: '#fff',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenSandbox(concertStats.conciertoId)}
                      >
                        Gestionar Devoluciones (Sandbox)
                      </button>
                    </div>
                  </div>
                )}

                {/* KPI Cards Grid */}
                <div className="stats-kpi-grid">
                  {/* KPI 1: Aforo y Ocupación */}
                  <div className="stats-kpi-card">
                    <span className="stats-kpi-label">Aforo y Ocupación</span>
                    <div className="stats-kpi-value">{concertStats.porcentajeOcupacion}%</div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${Math.min(100, concertStats.porcentajeOcupacion)}%` }}
                      />
                    </div>
                    <span className="stats-kpi-sub" style={{ marginTop: '8px' }}>
                      {concertStats.entradasVendidas} vendidas de {concertStats.cupoTotal} cupos
                    </span>
                    <span className="stats-kpi-sub">
                      Disponibles: <strong>{concertStats.cuposDisponibles}</strong> | Reservas: {concertStats.reservasActivas}
                    </span>
                  </div>

                  {/* KPI 2: Órdenes de Compra */}
                  <div className="stats-kpi-card">
                    <span className="stats-kpi-label">Órdenes de Compra</span>
                    <div className="stats-kpi-value">{concertStats.totalOrdenes}</div>
                    <span className="stats-kpi-sub" style={{ color: '#86efac' }}>
                      ✓ {concertStats.ordenesConfirmadas} Confirmadas
                    </span>
                    <span className="stats-kpi-sub" style={{ color: '#fde047' }}>
                      ⏳ {concertStats.ordenesPendientes} Pendientes
                    </span>
                    <span className="stats-kpi-sub" style={{ color: '#fca5a5' }}>
                      ✕ {concertStats.ordenesFallidasOExpiradas} Expiradas / Fallidas
                    </span>
                  </div>

                  {/* KPI 3: Recaudación Bruta Confirmada */}
                  <div className="stats-kpi-card">
                    <span className="stats-kpi-label">Recaudación Confirmada</span>
                    <div className="stats-kpi-value" style={{ color: '#38bdf8' }}>
                      Bs. {concertStats.ingresosConfirmadosBob.toFixed(2)}
                    </div>
                    <span className="stats-kpi-sub">
                      Moneda: BOB (Bolivianos)
                    </span>
                    {concertStats.ingresosNetosBob !== undefined && (
                      <span className="stats-kpi-sub" style={{ color: '#a7f3d0' }}>
                        Neto: Bs. {concertStats.ingresosNetosBob.toFixed(2)} BOB
                      </span>
                    )}
                    <span className="stats-kpi-sub" style={{ color: '#fef08a', fontSize: '0.75rem', marginTop: '4px' }}>
                      • Modo demostración — Sin cargos ni devoluciones reales
                    </span>
                  </div>

                  {/* KPI 4: Control de Asistencia */}
                  <div className="stats-kpi-card">
                    <span className="stats-kpi-label">Control de Asistencia</span>
                    <div className="stats-kpi-value" style={{ color: '#c084fc' }}>
                      {concertStats.tasaAsistenciaPorcentaje}%
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, concertStats.tasaAsistenciaPorcentaje)}%`,
                          background: 'linear-gradient(90deg, #ec4899, #a855f7)',
                        }}
                      />
                    </div>
                    <span className="stats-kpi-sub" style={{ marginTop: '8px' }}>
                      {concertStats.ticketsUtilizados} validados en puerta
                    </span>
                    <span className="stats-kpi-sub">
                      Emitidos: {concertStats.ticketsEmitidos} | Invalidados: {concertStats.ticketsInvalidados}
                    </span>
                  </div>
                </div>

                {/* Desglose por Categoría de Entrada */}
                <div className="stats-section-card">
                  <h3 className="stats-section-title">Desglose de Ventas por Categoría</h3>
                  <div className="stats-table-wrapper">
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>Categoría</th>
                          <th>Precio Unit.</th>
                          <th>Cupo Total</th>
                          <th>Vendidas</th>
                          <th>Reservadas</th>
                          <th>Disponibles</th>
                          <th>Ingresos</th>
                          <th>Ocupación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {concertStats.categorias.map((cat) => {
                          const ocupacionCat =
                            cat.cupoTotal > 0
                              ? Math.round((cat.entradasVendidas / cat.cupoTotal) * 100)
                              : 0;
                          return (
                            <tr key={cat.categoriaId}>
                              <td>
                                <strong>{cat.nombre}</strong>
                              </td>
                              <td>Bs. {cat.precio.toFixed(2)}</td>
                              <td>{cat.cupoTotal}</td>
                              <td style={{ color: '#86efac', fontWeight: 700 }}>{cat.entradasVendidas}</td>
                              <td style={{ color: '#fde047' }}>{cat.reservasActivas}</td>
                              <td style={{ color: '#38bdf8' }}>{cat.cupoDisponible}</td>
                              <td style={{ fontWeight: 700 }}>Bs. {cat.ingresosConfirmadosBob.toFixed(2)}</td>
                              <td style={{ minWidth: '130px' }}>
                                <span>{ocupacionCat}%</span>
                                <div className="progress-bar-bg">
                                  <div
                                    className="progress-bar-fill"
                                    style={{ width: `${Math.min(100, ocupacionCat)}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CU17: Modal de Cancelación de Concierto */}
        {isCancelModalOpen && cancellingConcert && (
          <div className="cancel-modal-backdrop" onClick={() => !cancelLoading && setIsCancelModalOpen(false)}>
            <div className="cancel-modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '8px' }}>
                <Ban size={24} />
                <h2 style={{ color: '#fff', margin: 0, fontSize: '1.4rem' }}>
                  Cancelar Concierto
                </h2>
              </div>

              <p style={{ color: '#cdbedb', margin: '4px 0 12px', fontSize: '0.95rem' }}>
                Estás a punto de cancelar el evento: <strong style={{ color: '#fff' }}>{cancellingConcert.titulo}</strong>
              </p>

              <div className="cancel-warning-box">
                <strong>Consecuencias operativas de la cancelación:</strong>
                <ul>
                  <li>Se cerrará de forma permanente la venta de entradas.</li>
                  <li>Todas las órdenes pendientes se anularán inmediatamente.</li>
                  <li>Todos los tickets digitales emitidos quedarán <strong>INVALIDADOS</strong>.</li>
                  <li>Cualquier intento de ingreso o validación con código QR será <strong>RECHAZADO</strong>.</li>
                  <li>Las compras confirmadas quedarán registradas como <strong>Pendientes de Devolución</strong>.</li>
                </ul>
              </div>

              {cancelError && <div className="alert-message alert-error">{cancelError}</div>}

              <div style={{ margin: '16px 0' }}>
                <label style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.88rem', display: 'block' }}>
                  Motivo de Cancelación (Obligatorio) *
                </label>
                <textarea
                  className="cancel-reason-textarea"
                  rows={3}
                  placeholder="Explica el motivo oficial (ej. Razones de fuerza mayor, indisposición técnica del recinto...)"
                  value={cancelMotivo}
                  onChange={(e) => setCancelMotivo(e.target.value)}
                  disabled={cancelLoading}
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={cancelLoading}
                >
                  Volver atrás
                </button>
                <button
                  type="button"
                  className="btn-card-action btn-cancel-concert"
                  style={{ padding: '10px 22px', fontSize: '0.95rem', fontWeight: 800 }}
                  onClick={() => void handleConfirmCancel()}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? 'Cancelando evento...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Creación / Edición */}
        {isModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-container">
              <button
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>

              <h2 style={{ color: '#fff', margin: '0 0 20px', fontSize: '1.6rem' }}>
                {editingConcertId ? 'Editar y Configurar Concierto' : 'Crear Nuevo Concierto'}
              </h2>

              {modalError && <div className="alert-message alert-error">{modalError}</div>}
              {modalSuccess && <div className="alert-message alert-success">{modalSuccess}</div>}

              {modalLoading ? (
                <p>Cargando información...</p>
              ) : (
                <form onSubmit={handleSaveConcert}>
                  {/* SECCIÓN 1: DATOS PRINCIPALES */}
                  <div className="form-step-section">
                    <h3>1. Datos Principales del Evento</h3>
                    <div className="form-group">
                      <label>Título del Concierto *</label>
                      <input
                        type="text"
                        value={formTitulo}
                        onChange={(e) => setFormTitulo(e.target.value)}
                        placeholder="ej. Festival Illimani 2026"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Descripción *</label>
                      <textarea
                        rows={3}
                        value={formDescripcion}
                        onChange={(e) => setFormDescripcion(e.target.value)}
                        placeholder="Descripción detallada del concierto, cartelera y recomendaciones..."
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Género Principal</label>
                        <input
                          type="text"
                          value={formGenero}
                          onChange={(e) => setFormGenero(e.target.value)}
                          placeholder="ej. Heavy Metal, Rock, Pop..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Zona Horaria</label>
                        <input
                          type="text"
                          value={formZonaHoraria}
                          onChange={(e) => setFormZonaHoraria(e.target.value)}
                          disabled
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Fecha y Hora de Inicio *</label>
                        <input
                          type="datetime-local"
                          value={formFechaInicio}
                          onChange={(e) => setFormFechaInicio(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Fecha y Hora de Fin *</label>
                        <input
                          type="datetime-local"
                          value={formFechaFin}
                          onChange={(e) => setFormFechaFin(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Inicio Programado de Venta (Opcional)</label>
                        <input
                          type="datetime-local"
                          value={formInicioVenta}
                          onChange={(e) => setFormInicioVenta(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ justifyContent: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formDestacado}
                            onChange={(e) => setFormDestacado(e.target.checked)}
                          />
                          Destacar evento en el carrusel principal
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: UBICACIÓN */}
                  <div className="form-step-section">
                    <h3>2. Ubicación del Evento</h3>
                    <div className="form-group">
                      <label>Nombre del Recinto / Lugar *</label>
                      <input
                        type="text"
                        value={formRecinto}
                        onChange={(e) => setFormRecinto(e.target.value)}
                        placeholder="ej. Teatro al Aire Libre Jaime Laredo"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Dirección exacta *</label>
                      <input
                        type="text"
                        value={formDireccion}
                        onChange={(e) => setFormDireccion(e.target.value)}
                        placeholder="ej. Av. del Poeta s/n"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Ciudad *</label>
                        <input
                          type="text"
                          value={formCiudad}
                          onChange={(e) => setFormCiudad(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Departamento *</label>
                        <select
                          value={formDepartamento}
                          onChange={(e) => setFormDepartamento(e.target.value)}
                        >
                          {BOLIVIAN_DEPARTMENTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 3: PORTADA */}
                  <div className="form-step-section">
                    <h3>3. Portada Publicitaria (JPG o PNG)</h3>
                    {coverPreview && (
                      <div style={{ textAlign: 'center' }}>
                        <img
                          src={coverPreview}
                          alt="Vista previa de portada"
                          className="cover-preview-img"
                        />
                      </div>
                    )}
                    <label className="cover-upload-box">
                      <Upload size={24} color="#ec4899" style={{ margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, color: '#cdbedb', fontSize: '0.9rem' }}>
                        Haz clic aquí para seleccionar o actualizar la portada (máx. 5 MB)
                      </p>
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        style={{ display: 'none' }}
                        onChange={handleCoverChange}
                      />
                    </label>
                  </div>

                  {/* SECCIÓN 4: ARTISTAS PARTICIPANTES (Solo si ya existe ID) */}
                  {editingConcertId && (
                    <div className="form-step-section">
                      <h3>4. Artistas Participantes</h3>
                      {editingArtistas.length > 0 ? (
                        <table className="items-list-table">
                          <thead>
                            <tr>
                              <th>Orden</th>
                              <th>Nombre del Artista</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingArtistas.map((art) => (
                              <tr key={art.id}>
                                <td>{art.orden}</td>
                                <td>{art.nombreArtista}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-remove-subitem"
                                    onClick={() => handleDeleteArtist(art.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ color: '#a797be', fontSize: '0.88rem' }}>
                          No hay artistas participantes asignados.
                        </p>
                      )}

                      <div style={{ marginTop: '14px', background: 'rgba(8,5,17,0.5)', padding: '12px', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                          <label style={{ color: '#cdbedb', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="artType"
                              checked={newArtType === 'platform'}
                              onChange={() => setNewArtType('platform')}
                            />{' '}
                            Artista registrado de Sonic Ledger
                          </label>
                          <label style={{ color: '#cdbedb', fontSize: '0.85rem' }}>
                            <input
                              type="radio"
                              name="artType"
                              checked={newArtType === 'manual'}
                              onChange={() => setNewArtType('manual')}
                            />{' '}
                            Artista invitado manual
                          </label>
                        </div>

                        {newArtType === 'platform' ? (
                          <div className="form-group">
                            <select
                              value={newArtSelectedId}
                              onChange={(e) => setNewArtSelectedId(e.target.value)}
                            >
                              {platformArtists.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="form-group">
                            <input
                              type="text"
                              value={newArtManualName}
                              onChange={(e) => setNewArtManualName(e.target.value)}
                              placeholder="Nombre del artista o banda invitada..."
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn-add-subitem"
                          onClick={handleAddArtist}
                        >
                          <Plus size={14} /> Vincular Artista
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN 5: CATEGORÍAS DE ENTRADAS (Solo si ya existe ID) */}
                  {editingConcertId && (
                    <div className="form-step-section">
                      <h3>5. Categorías de Entradas y Precios (BOB)</h3>
                      {editingCategorias.length > 0 ? (
                        <table className="items-list-table">
                          <thead>
                            <tr>
                              <th>Categoría</th>
                              <th>Precio (Bs.)</th>
                              <th>Cupo Total</th>
                              <th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingCategorias.map((cat) => (
                              <tr key={cat.id}>
                                <td>{cat.nombre}</td>
                                <td>Bs. {cat.precio}</td>
                                <td>{cat.cupoTotal} entradas</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-remove-subitem"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ color: '#a797be', fontSize: '0.88rem' }}>
                          Aún no has configurado categorías de entradas para este evento.
                        </p>
                      )}

                      <div style={{ marginTop: '14px', background: 'rgba(8,5,17,0.5)', padding: '12px', borderRadius: '10px' }}>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Nombre de Categoría</label>
                            <input
                              type="text"
                              value={newCatNombre}
                              onChange={(e) => setNewCatNombre(e.target.value)}
                              placeholder="General, VIP, etc."
                            />
                          </div>
                          <div className="form-group">
                            <label>Precio en Bolivianos (BOB)</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={newCatPrecio}
                              onChange={(e) => setNewCatPrecio(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group">
                            <label>Cupo Total de Entradas</label>
                            <input
                              type="number"
                              min="1"
                              value={newCatCupo}
                              onChange={(e) => setNewCatCupo(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn-add-subitem"
                              onClick={handleAddCategory}
                            >
                              <Plus size={14} /> Agregar Categoría
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cerrar
                    </button>
                    <button type="submit" className="btn-save-draft">
                      Guardar Datos del Concierto
                    </button>

                    {editingConcertId && (
                      <button
                        type="button"
                        className="btn-card-action btn-publish"
                        style={{ padding: '10px 22px', fontSize: '0.95rem' }}
                        onClick={() => handlePublish(editingConcertId)}
                      >
                        <Send size={16} /> Publicar Concierto
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal Sandbox de Pruebas: Devoluciones y Webhooks */}
        {isSandboxModalOpen && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(5, 2, 12, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <div
              style={{
                background: '#120b22',
                border: '1px solid #7c3aed',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '750px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 0 35px rgba(124, 58, 237, 0.3)',
              }}
            >
              <div
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>
                    Panel de Pruebas Sandbox — Devoluciones
                  </h3>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      fontSize: '0.78rem',
                      color: '#a78bfa',
                      background: 'rgba(167, 139, 250, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    Modo demostración — Sin cargos ni devoluciones reales
                  </span>
                </div>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#cdbedb',
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsSandboxModalOpen(false)}
                >
                  <X size={22} />
                </button>
              </div>

              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                {sandboxMessage && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid #8b5cf6',
                      color: '#e9d5ff',
                      marginBottom: '16px',
                      fontSize: '0.9rem',
                    }}
                  >
                    {sandboxMessage}
                  </div>
                )}

                {sandboxLoading && (
                  <p style={{ textAlign: 'center', color: '#cdbedb' }}>Cargando solicitudes...</p>
                )}

                {!sandboxLoading && sandboxRefunds && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        marginBottom: '20px',
                      }}
                    >
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: '#a797be' }}>Pendientes</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fde047' }}>
                          {sandboxRefunds.pendientes}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#cdbedb' }}>
                          Bs. {sandboxRefunds.montoPendienteBob.toFixed(2)}
                        </span>
                      </div>

                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: '#a797be' }}>Completadas</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#86efac' }}>
                          {sandboxRefunds.completados}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#cdbedb' }}>
                          Bs. {sandboxRefunds.montoCompletadoBob.toFixed(2)}
                        </span>
                      </div>

                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <span style={{ fontSize: '0.75rem', color: '#a797be' }}>Fallidas</span>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fca5a5' }}>
                          {sandboxRefunds.fallidos}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#cdbedb' }}>
                          Bs. {sandboxRefunds.montoFallidoBob.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: '0.95rem' }}>
                      Solicitudes de devolución ({sandboxRefunds.reembolsos.length})
                    </h4>

                    {sandboxRefunds.reembolsos.length === 0 ? (
                      <p style={{ color: '#a797be', textAlign: 'center', padding: '20px 0' }}>
                        No hay solicitudes de devolución registradas para este concierto.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sandboxRefunds.reembolsos.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              background: 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '12px',
                              padding: '14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '14px',
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <strong style={{ color: '#fff', fontSize: '0.95rem' }}>
                                  Bs. {r.monto.toFixed(2)} {r.moneda}
                                </strong>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background:
                                      r.estado === 'COMPLETADO'
                                        ? 'rgba(16, 185, 129, 0.2)'
                                        : r.estado === 'PENDIENTE'
                                        ? 'rgba(245, 158, 11, 0.2)'
                                        : 'rgba(239, 68, 68, 0.2)',
                                    color:
                                      r.estado === 'COMPLETADO'
                                        ? '#6ee7b7'
                                        : r.estado === 'PENDIENTE'
                                        ? '#fde047'
                                        : '#fca5a5',
                                  }}
                                >
                                  {r.estado}
                                </span>
                              </div>
                              <p style={{ margin: 0, color: '#a797be', fontSize: '0.8rem' }}>
                                Motivo: {r.motivo}
                              </p>
                              <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                                ID: {r.reembolsoTransaccionId}
                              </span>
                            </div>

                            {r.estado === 'PENDIENTE' && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  style={{
                                    background: '#10b981',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleProcessRefundAction(r.id, 'COMPLETAR')}
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid #ef4444',
                                    borderRadius: '8px',
                                    color: '#fca5a5',
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => handleProcessRefundAction(r.id, 'FALLAR')}
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    padding: '8px 20px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsSandboxModalOpen(false)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
