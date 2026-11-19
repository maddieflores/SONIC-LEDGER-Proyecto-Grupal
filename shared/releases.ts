export type ReleaseTipo = 'SINGLE' | 'EP' | 'ALBUM';
export type ReleaseEstado = 'borrador' | 'publicado';

export type ReleaseSong = {
  id: string;
  numeroPista?: number | null;
  titulo: string;
  descripcion?: string;
  duracionSegundos: number | null;
  estado: 'borrador' | 'publicado';
  generoId?: string | null;
  genero?: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
};

export type Release = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: ReleaseTipo;
  estado: ReleaseEstado;
  artistaId: string;
  artista: string;
  fechaLanzamiento: string | null;
  createdAt: string;
  updatedAt: string;
  portadaUrl: string | null;
  cancionCount: number;
  duracionTotalSegundos: number;
  canciones: ReleaseSong[];
};

export type AvailableSong = {
  id: string;
  titulo: string;
  duracionSegundos: number | null;
  estado: 'borrador' | 'publicado';
  generoId: string | null;
  genero: string | null;
  lanzamientoId: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
};

export type ReleasesQuery = {
  tipo?: ReleaseTipo;
  estado?: ReleaseEstado;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type ReleasesResponse = {
  items: Release[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function releaseTypeLabel(tipo: ReleaseTipo): string {
  switch (tipo) {
    case 'SINGLE':
      return 'Sencillo';
    case 'EP':
      return 'EP';
    case 'ALBUM':
      return 'Álbum';
    default:
      return tipo;
  }
}

export function releaseStateLabel(estado: ReleaseEstado): string {
  return estado === 'publicado' ? 'Publicado' : 'Borrador';
}

export function formatReleaseDate(isoString: string | null | undefined): string {
  if (!isoString) return 'Sin fecha';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Sin fecha';
    const day = d.getDate();
    const months = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return 'Sin fecha';
  }
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function validateReleaseTrackCount(
  tipo: ReleaseTipo,
  count: number,
): string | null {
  if (tipo === 'SINGLE' && count !== 1) {
    return 'Un sencillo debe tener exactamente 1 canción.';
  }
  if (tipo === 'EP' && (count < 2 || count > 6)) {
    return 'Un EP debe tener entre 2 y 6 canciones.';
  }
  if (tipo === 'ALBUM' && count < 7) {
    return 'Un álbum debe tener 7 o más canciones.';
  }
  return null;
}
