import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  Concierto,
  ConciertoEstado,
  ConciertoEstadoVenta,
} from './concierto.entity.js';
import { ConciertoArtista } from './concierto-artista.entity.js';
import { ConciertoCategoria } from './concierto-categoria.entity.js';
import { Artista } from '../musica/artista.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { RolNombre } from '../auth/rol.entity.js';
import {
  AddConcertArtistaDto,
  CancelarConciertoDto,
  ConcertQueryDto,
  CreateConcertDto,
  CreateTicketCategoryDto,
  UpdateConcertDto,
  UpdateTicketCategoryDto,
} from './conciertos.dto.js';
import { validateArtistImage } from '../artist/artist-media.service.js';
import { OrdenCompra, OrdenEstado, ReembolsoEstado } from '../ticketing/orden-compra.entity.js';
import { Ticket, TicketEstado } from '../ticketing/ticket.entity.js';
import { ReservaCupo } from '../ticketing/reserva-cupo.entity.js';
import { Reembolso, ReembolsoEstadoOperacion, ReembolsoTipo } from '../ticketing/reembolso.entity.js';

export type UploadedConcertCover = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export function computeSalesStatus(
  estado: ConciertoEstado,
  inicioVenta: Date | string | null,
  fechaFin: Date | string,
  now = new Date(),
): ConciertoEstadoVenta {
  if (estado !== ConciertoEstado.PUBLICADO) {
    return ConciertoEstadoVenta.VENTA_NO_INICIADA;
  }
  const nowMs = now.getTime();
  const finMs = new Date(fechaFin).getTime();
  if (nowMs > finMs) {
    return ConciertoEstadoVenta.VENTA_CERRADA;
  }
  if (inicioVenta) {
    const inicioMs = new Date(inicioVenta).getTime();
    if (nowMs < inicioMs) {
      return ConciertoEstadoVenta.VENTA_PENDIENTE;
    }
  }
  return ConciertoEstadoVenta.VENTA_INICIADA;
}

@Injectable()
export class ConciertosService {
  private readonly uploadDir = resolve(process.cwd(), 'uploads', 'conciertos');

  constructor(
    @InjectRepository(Concierto)
    private readonly conciertosRepo: Repository<Concierto>,
    @InjectRepository(ConciertoArtista)
    private readonly artistasRepo: Repository<ConciertoArtista>,
    @InjectRepository(ConciertoCategoria)
    private readonly categoriasRepo: Repository<ConciertoCategoria>,
    @InjectRepository(Artista)
    private readonly platformArtistsRepo: Repository<Artista>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  private mapConcert(c: Concierto) {
    const categorias = (c.categorias || []).map((cat) => ({
      id: cat.id,
      conciertoId: cat.conciertoId,
      nombre: cat.nombre,
      precio: Number(cat.precio),
      moneda: cat.moneda,
      cupoTotal: cat.cupoTotal,
      cupoDisponible: cat.cupoDisponible,
      disponible: cat.disponible,
      createdAt: cat.createdAt?.toISOString(),
      updatedAt: cat.updatedAt?.toISOString(),
    }));

    const preciosValidos = categorias
      .filter((cat) => cat.disponible)
      .map((cat) => cat.precio);
    const precioMinimo =
      preciosValidos.length > 0 ? Math.min(...preciosValidos) : null;

    const artistas = (c.artistas || [])
      .sort((a, b) => a.orden - b.orden)
      .map((a) => ({
        id: a.id,
        conciertoId: a.conciertoId,
        artistaId: a.artistaId,
        nombreArtista: a.nombreArtista,
        orden: a.orden,
        avatarUrl: a.artista?.avatarUrl ?? null,
      }));

    return {
      id: c.id,
      organizadorId: c.organizadorId,
      organizadorNombre:
        c.organizador?.displayName || c.organizador?.username || 'Organizador',
      titulo: c.titulo,
      descripcion: c.descripcion || '',
      portadaUrl: c.portadaUrl,
      genero: c.genero || '',
      fechaInicio: c.fechaInicio instanceof Date ? c.fechaInicio.toISOString() : c.fechaInicio,
      fechaFin: c.fechaFin instanceof Date ? c.fechaFin.toISOString() : c.fechaFin,
      zonaHoraria: c.zonaHoraria || 'America/La_Paz',
      recinto: c.recinto,
      direccion: c.direccion,
      ciudad: c.ciudad,
      departamento: c.departamento,
      estado: c.estado,
      inicioVenta: c.inicioVenta ? (c.inicioVenta instanceof Date ? c.inicioVenta.toISOString() : c.inicioVenta) : null,
      destacado: c.destacado ?? false,
      estadoVenta: computeSalesStatus(c.estado, c.inicioVenta, c.fechaFin),
      precioMinimo,
      motivoCancelacion: c.motivoCancelacion || null,
      canceladoEn: c.canceladoEn ? (c.canceladoEn instanceof Date ? c.canceladoEn.toISOString() : c.canceladoEn) : null,
      canceladoPorNombre: c.canceladoPor?.displayName || c.canceladoPor?.username || null,
      artistas,
      categorias,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
    };
  }

  async getPlatformArtists() {
    const list = await this.platformArtistsRepo.find({
      order: { nombreArtistico: 'ASC' },
      take: 50,
    });
    return list.map((a) => ({
      id: a.id,
      nombre: a.nombreArtistico,
      avatarUrl: a.avatarUrl,
    }));
  }

  async createDraft(organizadorId: string, dto: CreateConcertDto) {
    const inicio = new Date(dto.fechaInicio);
    const fin = new Date(dto.fechaFin);

    if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
      throw new BadRequestException('Las fechas de inicio y fin deben ser válidas.');
    }

    if (inicio.getTime() >= fin.getTime()) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización.',
      );
    }

    let inicioVentaDate: Date | null = null;
    if (dto.inicioVenta) {
      inicioVentaDate = new Date(dto.inicioVenta);
      if (isNaN(inicioVentaDate.getTime())) {
        throw new BadRequestException('La fecha de inicio de venta no es válida.');
      }
      if (inicioVentaDate.getTime() > fin.getTime()) {
        throw new BadRequestException(
          'La fecha de inicio de venta no puede ser posterior a la fecha de finalización del concierto.',
        );
      }
    }

    const concierto = this.conciertosRepo.create({
      organizadorId,
      titulo: dto.titulo.trim(),
      descripcion: (dto.descripcion || '').trim(),
      genero: (dto.genero || '').trim(),
      fechaInicio: inicio,
      fechaFin: fin,
      zonaHoraria: dto.zonaHoraria?.trim() || 'America/La_Paz',
      recinto: dto.recinto.trim(),
      direccion: dto.direccion.trim(),
      ciudad: dto.ciudad.trim(),
      departamento: dto.departamento.trim(),
      inicioVenta: inicioVentaDate,
      destacado: dto.destacado ?? false,
      estado: ConciertoEstado.BORRADOR,
    });

    const saved = await this.conciertosRepo.save(concierto);
    return this.mapConcert(saved);
  }

  async getOrganizerConcerts(organizadorId: string) {
    const conciertos = await this.conciertosRepo.find({
      where: { organizadorId },
      relations: {
        artistas: { artista: true },
        categorias: true,
        organizador: true,
      },
      order: { createdAt: 'DESC' },
    });
    return conciertos.map((c) => this.mapConcert(c));
  }

  async getOrganizerConcertDetail(organizadorId: string, concertId: string) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: {
        artistas: { artista: true },
        categorias: true,
        organizador: true,
      },
    });

    if (!c) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException(
        'No tienes permiso para consultar o editar este concierto.',
      );
    }

    return this.mapConcert(c);
  }

  async updateConcert(
    organizadorId: string,
    concertId: string,
    dto: UpdateConcertDto,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: {
        artistas: { artista: true },
        categorias: true,
        organizador: true,
      },
    });

    if (!c) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este concierto.',
      );
    }

    const inicio = dto.fechaInicio ? new Date(dto.fechaInicio) : c.fechaInicio;
    const fin = dto.fechaFin ? new Date(dto.fechaFin) : c.fechaFin;

    if (inicio.getTime() >= fin.getTime()) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización.',
      );
    }

    if (dto.inicioVenta !== undefined) {
      if (dto.inicioVenta === null || dto.inicioVenta === '') {
        c.inicioVenta = null;
      } else {
        const vDate = new Date(dto.inicioVenta);
        if (isNaN(vDate.getTime())) {
          throw new BadRequestException('Fecha de inicio de venta inválida.');
        }
        if (vDate.getTime() > fin.getTime()) {
          throw new BadRequestException(
            'El inicio de venta no puede ser posterior a la fecha de finalización.',
          );
        }
        c.inicioVenta = vDate;
      }
    }

    if (dto.titulo !== undefined) c.titulo = dto.titulo.trim();
    if (dto.descripcion !== undefined) c.descripcion = dto.descripcion.trim();
    if (dto.genero !== undefined) c.genero = dto.genero.trim();
    if (dto.recinto !== undefined) c.recinto = dto.recinto.trim();
    if (dto.direccion !== undefined) c.direccion = dto.direccion.trim();
    if (dto.ciudad !== undefined) c.ciudad = dto.ciudad.trim();
    if (dto.departamento !== undefined) c.departamento = dto.departamento.trim();
    if (dto.zonaHoraria !== undefined) c.zonaHoraria = dto.zonaHoraria.trim();
    if (dto.destacado !== undefined) c.destacado = dto.destacado;

    c.fechaInicio = inicio;
    c.fechaFin = fin;

    const saved = await this.conciertosRepo.save(c);
    return this.mapConcert(saved);
  }

  async uploadCover(
    organizadorId: string,
    concertId: string,
    file?: UploadedConcertCover,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
    });

    if (!c) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException(
        'No tienes permiso para actualizar la portada de este concierto.',
      );
    }

    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Debes adjuntar un archivo de imagen en el campo "file".',
      );
    }

    const format = validateArtistImage(file.buffer, file.mimetype);
    await mkdir(this.uploadDir, { recursive: true });

    const filename = `${c.id}-${Date.now()}.${format}`;
    const filePath = join(this.uploadDir, filename);

    await writeFile(filePath, file.buffer);

    c.portadaUrl = `/api/conciertos/${c.id}/cover/${filename}`;
    await this.conciertosRepo.save(c);

    return { coverUrl: c.portadaUrl };
  }

  async getCoverFile(filename: string) {
    const filePath = join(this.uploadDir, filename);
    try {
      const buffer = await readFile(filePath);
      const isPng = filename.endsWith('.png');
      return {
        buffer,
        mimetype: isPng ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('Portada no encontrada.');
    }
  }

  async addCategory(
    organizadorId: string,
    concertId: string,
    dto: CreateTicketCategoryDto,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: { categorias: true },
    });

    if (!c) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para editar este concierto.');
    }

    const nombreNorm = dto.nombre.trim().toLowerCase();
    const existing = (c.categorias || []).some(
      (cat) => cat.nombre.trim().toLowerCase() === nombreNorm,
    );
    if (existing) {
      throw new BadRequestException(
        `Ya existe una categoría llamada "${dto.nombre.trim()}" en este concierto.`,
      );
    }

    if (dto.precio < 0) {
      throw new BadRequestException('El precio no puede ser negativo.');
    }

    if (dto.cupoTotal <= 0) {
      throw new BadRequestException('El cupo debe ser mayor a 0.');
    }

    const cat = this.categoriasRepo.create({
      conciertoId: c.id,
      nombre: dto.nombre.trim(),
      precio: dto.precio,
      moneda: 'BOB',
      cupoTotal: dto.cupoTotal,
      cupoDisponible: dto.cupoTotal,
      disponible: dto.disponible ?? true,
    });

    const saved = await this.categoriasRepo.save(cat);
    return {
      id: saved.id,
      conciertoId: saved.conciertoId,
      nombre: saved.nombre,
      precio: Number(saved.precio),
      moneda: saved.moneda,
      cupoTotal: saved.cupoTotal,
      cupoDisponible: saved.cupoDisponible,
      disponible: saved.disponible,
      createdAt: saved.createdAt?.toISOString(),
      updatedAt: saved.updatedAt?.toISOString(),
    };
  }

  async updateCategory(
    organizadorId: string,
    concertId: string,
    catId: string,
    dto: UpdateTicketCategoryDto,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: { categorias: true },
    });

    if (!c) throw new NotFoundException('Concierto no encontrado.');
    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para modificar este concierto.');
    }

    const cat = await this.categoriasRepo.findOne({
      where: { id: catId, conciertoId: concertId },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada.');

    if (dto.nombre) {
      const nombreNorm = dto.nombre.trim().toLowerCase();
      const duplicate = (c.categorias || []).some(
        (other) => other.id !== catId && other.nombre.trim().toLowerCase() === nombreNorm,
      );
      if (duplicate) {
        throw new BadRequestException(
          `Ya existe otra categoría con el nombre "${dto.nombre.trim()}".`,
        );
      }
      cat.nombre = dto.nombre.trim();
    }

    if (dto.precio !== undefined) {
      if (dto.precio < 0) {
        throw new BadRequestException('El precio no puede ser negativo.');
      }
      cat.precio = dto.precio;
    }

    if (dto.cupoTotal !== undefined) {
      if (dto.cupoTotal <= 0) {
        throw new BadRequestException('El cupo debe ser mayor a 0.');
      }
      const diff = dto.cupoTotal - cat.cupoTotal;
      cat.cupoTotal = dto.cupoTotal;
      cat.cupoDisponible = Math.max(0, cat.cupoDisponible + diff);
    }

    if (dto.disponible !== undefined) {
      cat.disponible = dto.disponible;
    }

    const saved = await this.categoriasRepo.save(cat);
    return {
      id: saved.id,
      conciertoId: saved.conciertoId,
      nombre: saved.nombre,
      precio: Number(saved.precio),
      moneda: saved.moneda,
      cupoTotal: saved.cupoTotal,
      cupoDisponible: saved.cupoDisponible,
      disponible: saved.disponible,
      createdAt: saved.createdAt?.toISOString(),
      updatedAt: saved.updatedAt?.toISOString(),
    };
  }

  async deleteCategory(
    organizadorId: string,
    concertId: string,
    catId: string,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
    });
    if (!c) throw new NotFoundException('Concierto no encontrado.');
    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para modificar este concierto.');
    }

    const cat = await this.categoriasRepo.findOne({
      where: { id: catId, conciertoId: concertId },
    });
    if (!cat) throw new NotFoundException('Categoría no encontrada.');

    await this.categoriasRepo.remove(cat);
    return { success: true };
  }

  async addArtist(
    organizadorId: string,
    concertId: string,
    dto: AddConcertArtistaDto,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: { artistas: true },
    });

    if (!c) throw new NotFoundException('Concierto no encontrado.');
    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para modificar este concierto.');
    }

    let nombre = dto.nombreArtista.trim();
    let artista: Artista | null = null;

    if (dto.artistaId) {
      artista = await this.platformArtistsRepo.findOne({
        where: { id: dto.artistaId },
      });
      if (!artista) {
        throw new NotFoundException('El artista de la plataforma especificado no existe.');
      }
      if (!nombre) {
        nombre = artista.nombreArtistico;
      }
    }

    const maxOrden = (c.artistas || []).reduce(
      (max, a) => Math.max(max, a.orden || 0),
      0,
    );

    const rel = this.artistasRepo.create({
      conciertoId: c.id,
      artistaId: artista ? artista.id : null,
      nombreArtista: nombre,
      orden: dto.orden && dto.orden > 0 ? dto.orden : maxOrden + 1,
    });

    const saved = await this.artistasRepo.save(rel);
    return {
      id: saved.id,
      conciertoId: saved.conciertoId,
      artistaId: saved.artistaId,
      nombreArtista: saved.nombreArtista,
      orden: saved.orden,
      avatarUrl: artista?.avatarUrl ?? null,
    };
  }

  async deleteArtist(
    organizadorId: string,
    concertId: string,
    relId: string,
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
    });
    if (!c) throw new NotFoundException('Concierto no encontrado.');
    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException('No tienes permiso para modificar este concierto.');
    }

    const rel = await this.artistasRepo.findOne({
      where: { id: relId, conciertoId: concertId },
    });
    if (!rel) throw new NotFoundException('Artista participante no encontrado.');

    await this.artistasRepo.remove(rel);
    return { success: true };
  }

  async publish(organizadorId: string, concertId: string) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: {
        artistas: { artista: true },
        categorias: true,
        organizador: true,
      },
    });

    if (!c) throw new NotFoundException('Concierto no encontrado.');
    if (c.organizadorId !== organizadorId) {
      throw new ForbiddenException(
        'No tienes permiso para publicar este concierto.',
      );
    }

    // CU16 Validaciones previas a la publicación:
    if (!c.titulo || c.titulo.trim().length < 3) {
      throw new BadRequestException('El título del concierto debe tener al menos 3 caracteres.');
    }

    if (!c.descripcion || c.descripcion.trim().length < 10) {
      throw new BadRequestException('El concierto debe tener una descripción de al menos 10 caracteres.');
    }

    if (!c.portadaUrl) {
      throw new BadRequestException('Debes subir una portada válida antes de publicar el evento.');
    }

    if (!c.recinto || !c.direccion || !c.ciudad || !c.departamento) {
      throw new BadRequestException('La ubicación del evento debe estar completamente definida.');
    }

    const now = new Date();
    if (new Date(c.fechaFin).getTime() <= now.getTime()) {
      throw new BadRequestException('No puedes publicar un concierto cuya fecha ya ha pasado.');
    }

    if (!c.categorias || c.categorias.length === 0) {
      throw new BadRequestException(
        'Debes configurar al menos una categoría de entradas antes de publicar.',
      );
    }

    const categoriasValidas = c.categorias.every(
      (cat) => cat.cupoTotal > 0 && cat.precio >= 0 && cat.moneda === 'BOB',
    );
    if (!categoriasValidas) {
      throw new BadRequestException(
        'Todas las categorías de entrada deben tener cupos positivos y precios no negativos en BOB.',
      );
    }

    if (c.inicioVenta && new Date(c.inicioVenta).getTime() > new Date(c.fechaFin).getTime()) {
      throw new BadRequestException(
        'La fecha de inicio de venta no puede ser posterior a la fecha del concierto.',
      );
    }

    c.estado = ConciertoEstado.PUBLICADO;
    const saved = await this.conciertosRepo.save(c);
    return this.mapConcert(saved);
  }

  async findPublicConcerts(query: ConcertQueryDto) {
    const qb = this.conciertosRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.artistas', 'ca')
      .leftJoinAndSelect('ca.artista', 'pa')
      .leftJoinAndSelect('c.categorias', 'cc')
      .leftJoinAndSelect('c.organizador', 'org')
      .where('c.estado = :estado', { estado: ConciertoEstado.PUBLICADO });

    if (query.q) {
      const text = `%${query.q.trim()}%`;
      qb.andWhere(
        '(c.titulo ILIKE :qText OR c.recinto ILIKE :qText OR c.ciudad ILIKE :qText OR ca.nombre_artista ILIKE :qText OR c.genero ILIKE :qText)',
        { qText: text },
      );
    }

    if (query.ciudad && query.ciudad.trim()) {
      qb.andWhere('c.ciudad ILIKE :ciudad', { ciudad: `%${query.ciudad.trim()}%` });
    }

    if (query.genero && query.genero.trim()) {
      qb.andWhere('c.genero ILIKE :genero', { genero: `%${query.genero.trim()}%` });
    }

    if (query.fechaDesde) {
      qb.andWhere('c.fechaInicio >= :fechaDesde', { fechaDesde: new Date(query.fechaDesde) });
    }

    if (query.fechaHasta) {
      qb.andWhere('c.fechaInicio <= :fechaHasta', { fechaHasta: new Date(query.fechaHasta) });
    }

    if (query.artistaId) {
      qb.andWhere('ca.artista_id = :artistaId', { artistaId: query.artistaId });
    }

    const isDestacados = query.destacados === true || query.destacados === 'true';
    if (isDestacados) {
      qb.andWhere('c.destacado = true');
    }

    // Sort order
    if (query.sort === 'fecha_asc') {
      qb.orderBy('c.fechaInicio', 'ASC');
    } else if (query.sort === 'fecha_desc') {
      qb.orderBy('c.fechaInicio', 'DESC');
    } else {
      qb.orderBy('c.fechaInicio', 'ASC').addOrderBy('c.createdAt', 'DESC');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const mappedItems = items.map((c) => {
      const full = this.mapConcert(c);
      return {
        id: full.id,
        titulo: full.titulo,
        descripcion: full.descripcion,
        portadaUrl: full.portadaUrl,
        genero: full.genero,
        fechaInicio: full.fechaInicio,
        fechaFin: full.fechaFin,
        recinto: full.recinto,
        ciudad: full.ciudad,
        departamento: full.departamento,
        estadoVenta: full.estadoVenta,
        precioMinimo: full.precioMinimo,
        moneda: 'BOB',
        destacado: full.destacado,
        artistas: full.artistas.map((a) => ({
          id: a.id,
          nombre: a.nombreArtista,
          artistaId: a.artistaId,
          avatarUrl: a.avatarUrl,
        })),
      };
    });

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getPublicConcertDetail(
    id: string,
    user?: { id?: string; roles?: string[] },
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id },
      relations: {
        artistas: { artista: true },
        categorias: true,
        organizador: true,
      },
    });

    if (!c) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (c.estado === ConciertoEstado.BORRADOR) {
      const isOwner = user?.id && user.id === c.organizadorId;
      const isAdmin = user?.roles?.includes(RolNombre.ADMIN);
      if (!isOwner && !isAdmin) {
        throw new NotFoundException('Concierto no encontrado o no disponible.');
      }
    }

    return this.mapConcert(c);
  }

  /**
   * CU17 — Cancelar Concierto
   * Transaccional con bloqueo pesimista en PostgreSQL.
   */
  async cancelarConcierto(
    organizadorId: string,
    concertId: string,
    dto: CancelarConciertoDto,
    roles: string[] = [],
  ) {
    if (!dto.motivo || dto.motivo.trim().length < 5) {
      throw new BadRequestException(
        'El motivo de cancelación debe tener al menos 5 caracteres.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const c = await queryRunner.manager
        .createQueryBuilder(Concierto, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: concertId })
        .getOne();

      if (!c) {
        throw new NotFoundException('Concierto no encontrado.');
      }

      const isOwner = c.organizadorId === organizadorId;
      const isAdmin = roles.includes(RolNombre.ADMIN);
      if (!isOwner && !isAdmin) {
        throw new ForbiddenException(
          'No tienes permiso para cancelar este concierto.',
        );
      }

      // Idempotencia: si ya está cancelado, no duplicar efectos
      if (c.estado === ConciertoEstado.CANCELADO) {
        await queryRunner.commitTransaction();
        const full = await this.conciertosRepo.findOne({
          where: { id: concertId },
          relations: {
            artistas: { artista: true },
            categorias: true,
            organizador: true,
          },
        });
        return {
          success: true,
          concierto: this.mapConcert(full!),
          yaCancelado: true,
          mensaje: 'El concierto ya se encontraba cancelado previamente.',
        };
      }

      // Conciertos en borrador deben ser editados o eliminados, no cancelados
      if (c.estado === ConciertoEstado.BORRADOR) {
        throw new BadRequestException(
          'Solo se pueden cancelar conciertos que hayan sido publicados. Los borradores deben ser editados o eliminados.',
        );
      }

      // 1. Cambiar estado a CANCELADO y registrar auditoría
      c.estado = ConciertoEstado.CANCELADO;
      c.motivoCancelacion = dto.motivo.trim();
      c.canceladoEn = new Date();
      c.canceladoPorId = organizadorId;
      await queryRunner.manager.save(Concierto, c);

      // 2. Invalidar todos los tickets del concierto cancelado
      await queryRunner.manager
        .createQueryBuilder(Ticket, 't')
        .update()
        .set({
          estado: TicketEstado.INVALIDADO,
          motivoInvalidacion: 'CONCIERTO_CANCELADO',
        })
        .where('concierto_id = :concertId', { concertId })
        .execute();

      // 3. Órdenes pendientes pasan a CANCELADA
      await queryRunner.manager
        .createQueryBuilder(OrdenCompra, 'o')
        .update()
        .set({ estado: OrdenEstado.CANCELADA })
        .where('concierto_id = :concertId', { concertId })
        .andWhere('estado = :estado', { estado: OrdenEstado.PENDIENTE })
        .execute();

      // 4. Órdenes confirmadas registran obligación de reembolso (PENDIENTE_REEMBOLSO) y crean solicitud PENDIENTE
      await queryRunner.manager
        .createQueryBuilder(OrdenCompra, 'o')
        .update()
        .set({ reembolsoEstado: ReembolsoEstado.PENDIENTE_REEMBOLSO })
        .where('concierto_id = :concertId', { concertId })
        .andWhere('estado = :estado', { estado: OrdenEstado.CONFIRMADA })
        .execute();

      const ordenesConfirmadas =
        typeof queryRunner.manager.find === 'function'
          ? await queryRunner.manager.find(OrdenCompra, {
              where: { conciertoId: concertId, estado: OrdenEstado.CONFIRMADA },
            })
          : [];

      for (const ord of ordenesConfirmadas) {
        const montoDisponible = Math.max(
          0,
          Number(ord.total) - Number(ord.montoReembolsado || 0),
        );
        if (montoDisponible > 0 && typeof queryRunner.manager.findOne === 'function') {
          const idempotencyKey = `CANCEL_CONCERT_${concertId}_${ord.id}`;
          const existente = await queryRunner.manager.findOne(Reembolso, {
            where: { idempotencyKey },
          });
          if (!existente && typeof queryRunner.manager.create === 'function') {
            const solicitud = queryRunner.manager.create(Reembolso, {
              ordenId: ord.id,
              conciertoId: concertId,
              reembolsoTransaccionId: `SANDBOX-REF-CANCEL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
              monto: montoDisponible,
              moneda: ord.moneda || 'BOB',
              tipo: ReembolsoTipo.TOTAL,
              estado: ReembolsoEstadoOperacion.PENDIENTE,
              motivo: `Cancelación de concierto: ${dto.motivo.trim()}`,
              solicitadoPorId: organizadorId,
              idempotencyKey,
            });
            await queryRunner.manager.save(Reembolso, solicitud);
          }
        }
      }

      // 5. Liberar reservas de cupo no confirmadas
      await queryRunner.manager
        .createQueryBuilder(ReservaCupo, 'r')
        .update()
        .set({ liberada: true })
        .where(
          'categoria_id IN (SELECT id FROM concierto_categorias WHERE concierto_id = :concertId)',
          { concertId },
        )
        .andWhere('confirmada = false')
        .execute();

      await queryRunner.commitTransaction();

      const full = await this.conciertosRepo.findOne({
        where: { id: concertId },
        relations: {
          artistas: { artista: true },
          categorias: true,
          organizador: true,
        },
      });

      return {
        success: true,
        concierto: this.mapConcert(full!),
        mensaje:
          'El concierto ha sido cancelado exitosamente. Se han invalidado los accesos QR y registrado las obligaciones de reembolso pendientes.',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * CU17 — Consultar información de cancelación de un concierto
   */
  async obtenerInformacionCancelacion(
    organizadorId: string,
    concertId: string,
    roles: string[] = [],
  ) {
    const c = await this.conciertosRepo.findOne({
      where: { id: concertId },
      relations: { organizador: true },
    });

    if (!c) throw new NotFoundException('Concierto no encontrado.');

    const isOwner = c.organizadorId === organizadorId;
    const isAdmin = roles.includes(RolNombre.ADMIN);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para consultar esta información.',
      );
    }

    if (c.estado !== ConciertoEstado.CANCELADO) {
      throw new BadRequestException('El concierto no se encuentra cancelado.');
    }

    const [ticketsAfectados, ordenesAfectadas] = await Promise.all([
      this.dataSource.getRepository(Ticket).count({
        where: { conciertoId: concertId },
      }),
      this.dataSource.getRepository(OrdenCompra).find({
        where: { conciertoId: concertId, estado: OrdenEstado.CONFIRMADA },
      }),
    ]);

    const totalMontoAfectadoBob = ordenesAfectadas.reduce(
      (acc, o) => acc + Number(o.total || 0),
      0,
    );

    return {
      conciertoId: c.id,
      titulo: c.titulo,
      estado: c.estado,
      motivoCancelacion: c.motivoCancelacion || 'Cancelado por el organizador.',
      canceladoEn: c.canceladoEn
        ? c.canceladoEn.toISOString()
        : c.updatedAt.toISOString(),
      canceladoPorNombre:
        c.organizador?.displayName || c.organizador?.username || 'Organizador',
      totalTicketsAfectados: ticketsAfectados,
      totalOrdenesAfectadas: ordenesAfectadas.length,
      totalMontoAfectadoBob: Number(totalMontoAfectadoBob.toFixed(2)),
      pagosPrueba: true,
    };
  }
}
