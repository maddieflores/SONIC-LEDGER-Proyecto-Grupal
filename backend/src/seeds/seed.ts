import { hash } from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { Usuario } from '../auth/usuario.entity.js';
import { Rol, RolNombre } from '../auth/rol.entity.js';
import { Artista } from '../musica/artista.entity.js';
import { Concierto, ConciertoEstado } from '../conciertos/concierto.entity.js';
import { ConciertoArtista } from '../conciertos/concierto-artista.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import dataSource from '../data-source.js';

export interface DemoAccountConfig {
  email: string;
  username: string;
  envVar: string;
  roles: RolNombre[];
  artista?: {
    nombreArtistico: string;
    biografia: string;
    avatarUrl: string;
  };
}

export const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    email: 'demo.cliente@example.com',
    username: 'Demo Cliente',
    envVar: 'DEMO_CLIENTE_PASSWORD',
    roles: [RolNombre.CLIENTE],
  },
  {
    email: 'demo.artista@example.com',
    username: 'Demo Artista',
    envVar: 'DEMO_ARTISTA_PASSWORD',
    roles: [RolNombre.CLIENTE, RolNombre.ARTISTA],
    artista: {
      nombreArtistico: 'Aura Neón',
      biografia: 'Perfil artístico oficial de demostración para catálogo y conciertos en Sonic Ledger.',
      avatarUrl: 'https://storage.sonicledger.example/avatars/aura-neon.webp',
    },
  },
  {
    email: 'demo.organizador@example.com',
    username: 'Demo Organizador',
    envVar: 'DEMO_ORGANIZADOR_PASSWORD',
    roles: [RolNombre.CLIENTE, RolNombre.ORGANIZADOR],
  },
  {
    email: 'demo.verificador@example.com',
    username: 'Demo Verificador',
    envVar: 'DEMO_VERIFICADOR_PASSWORD',
    roles: [RolNombre.CLIENTE, RolNombre.VERIFICADOR],
  },
  {
    email: 'demo.admin@example.com',
    username: 'Demo Administrador',
    envVar: 'DEMO_ADMIN_PASSWORD',
    roles: [RolNombre.ADMIN, RolNombre.CLIENTE],
  },
];

export function getPasswordForAccount(acc: DemoAccountConfig): string {
  const specific = process.env[acc.envVar];
  if (specific && specific.trim().length > 0) {
    return specific.trim();
  }
  const global = process.env.DEMO_PASSWORD;
  if (global && global.trim().length > 0) {
    return global.trim();
  }
  throw new Error(
    `Contraseña no configurada para la cuenta de demostración "${acc.email}". ` +
      `Configure la variable de entorno "${acc.envVar}" o "DEMO_PASSWORD" ` +
      `(mínimo 8 caracteres, máximo 72 bytes).`,
  );
}

export async function seedDemoAccounts(ds: DataSource) {
  if (!ds.isInitialized) {
    await ds.initialize();
  }

  const userRepo = ds.getRepository(Usuario);
  const rolesRepo = ds.getRepository(Rol);
  const artistaRepo = ds.getRepository(Artista);

  // 1. Asegurar catálogo de roles existente
  const existingRoles = await rolesRepo.find();
  const roleMap = new Map<RolNombre, Rol>();
  for (const r of existingRoles) {
    roleMap.set(r.nombre as RolNombre, r);
  }

  for (const roleName of Object.values(RolNombre)) {
    if (!roleMap.has(roleName)) {
      const created = rolesRepo.create({
        nombre: roleName,
        descripcion: `Rol del sistema: ${roleName}`,
      });
      const savedRole = await rolesRepo.save(created);
      roleMap.set(roleName, savedRole);
    }
  }

  const results: Array<{
    email: string;
    username: string;
    roles: string[];
    perfilArtistico?: string;
  }> = [];

  // 2. Procesar exclusivamente las cuentas de demostración (idempotente)
  for (const acc of DEMO_ACCOUNTS) {
    const password = getPasswordForAccount(acc);
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error(
        `La contraseña para la cuenta demo "${acc.email}" debe tener entre 8 caracteres y 72 bytes.`,
      );
    }

    const targetRoles = acc.roles.map((rn) => {
      const r = roleMap.get(rn);
      if (!r) throw new Error(`Rol requerido no encontrado en base de datos: ${rn}`);
      return r;
    });

    let user = await userRepo.findOne({
      where: { email: acc.email.toLowerCase() },
      relations: { roles: true },
    });

    if (!user) {
      const passwordHash = await hash(password, 12);
      user = userRepo.create({
        username: acc.username,
        email: acc.email.toLowerCase(),
        passwordHash,
        roles: targetRoles,
        role: 'usuario',
      });
      user = await userRepo.save(user);
    } else {
      // Idempotencia: verificar y ajustar estrictamente los roles para esta cuenta demo
      const currentRoleNames = new Set(user.roles.map((r) => r.nombre));
      const targetRoleNames = new Set(acc.roles);
      const isRolesEqual =
        currentRoleNames.size === targetRoleNames.size &&
        [...currentRoleNames].every((rn) => targetRoleNames.has(rn as RolNombre));

      if (!isRolesEqual) {
        user.roles = targetRoles;
      }

      // Actualizar hash de contraseña de la cuenta demo usando el mecanismo seguro de bcrypt
      user.passwordHash = await hash(password, 12);
      user = await userRepo.save(user);
    }

    let artistaName: string | undefined;
    if (acc.artista) {
      let artista = await artistaRepo.findOne({ where: { usuarioId: user.id } });
      if (!artista) {
        artista = artistaRepo.create({
          usuarioId: user.id,
          nombreArtistico: acc.artista.nombreArtistico,
          biografia: acc.artista.biografia,
          avatarUrl: acc.artista.avatarUrl,
        });
        await artistaRepo.save(artista);
      } else {
        artista.nombreArtistico = acc.artista.nombreArtistico;
        artista.biografia = acc.artista.biografia;
        artista.avatarUrl = acc.artista.avatarUrl;
        await artistaRepo.save(artista);
      }
      artistaName = artista.nombreArtistico;
    }

    // 3. Verificación exacta de roles asignados en base de datos
    const verified = await userRepo.findOne({
      where: { id: user.id },
      relations: { roles: true },
    });

    const finalRoles = (verified?.roles ?? []).map((r) => r.nombre);

    // Comprobar que únicamente tiene los roles esperados
    const expectedSet = new Set(acc.roles);
    const actualSet = new Set(finalRoles);
    if (
      expectedSet.size !== actualSet.size ||
      ![...expectedSet].every((r) => actualSet.has(r as RolNombre))
    ) {
      throw new Error(
        `Discrepancia en roles de la cuenta ${acc.email}. Esperados: ${acc.roles.join(', ')}, Obtenidos: ${finalRoles.join(', ')}`,
      );
    }

    results.push({
      email: user.email,
      username: user.username,
      roles: finalRoles,
      perfilArtistico: artistaName,
    });
  }

  return results;
}

export async function seedDemoConcerts(ds: DataSource) {
  if (!ds.isInitialized) {
    await ds.initialize();
  }

  const userRepo = ds.getRepository(Usuario);
  const artistaRepo = ds.getRepository(Artista);
  const conciertoRepo = ds.getRepository(Concierto);
  const conciertoArtistaRepo = ds.getRepository(ConciertoArtista);
  const categoriaRepo = ds.getRepository(ConciertoCategoria);

  const organizador = await userRepo.findOne({
    where: { email: 'demo.organizador@example.com' },
  });
  if (!organizador) {
    console.warn('Organizador demo no encontrado, omitiendo seed de conciertos');
    return [];
  }

  const artistaNeon = await artistaRepo.findOne({
    where: { nombreArtistico: 'Aura Neón' },
  });

  const demoConcertsData = [
    {
      titulo: 'Aura Neón: Resonancia Tour 2026',
      descripcion:
        'La experiencia definitiva de synthwave y electrónica futurista en vivo. Un espectáculo audiovisual con iluminación neón de 360 grados, sonido inmersivo y el estreno en directo del nuevo álbum.',
      portadaUrl: '/images/sonic-concert.webp',
      genero: 'Synthwave / Electrónica',
      diasFuturo: 18,
      duracionHoras: 4,
      recinto: 'Teatro al Aire Libre Jaime Laredo',
      direccion: 'Av. del Poeta s/n, Zona Central',
      ciudad: 'La Paz',
      departamento: 'La Paz',
      destacado: true,
      categorias: [
        { nombre: 'General', precio: 70, cupoTotal: 800, cupoDisponible: 650 },
        { nombre: 'VIP Neón Front', precio: 150, cupoTotal: 300, cupoDisponible: 210 },
        { nombre: 'Experiencia Backstage Sonic', precio: 280, cupoTotal: 50, cupoDisponible: 25 },
      ],
    },
    {
      titulo: 'CyberPulse Fest Santa Cruz',
      descripcion:
        'El festival de música electrónica y cyberpunk más esperado de los llanos bolivianos. Más de 6 horas de sintetizadores, beats envolventes y visuales generativos en gran formato.',
      portadaUrl: '/images/sonic-concert.webp',
      genero: 'Electronic / Cyberpunk',
      diasFuturo: 32,
      duracionHoras: 6,
      recinto: 'Fexpocruz — Salón Sirionó',
      direccion: 'Av. Roca y Coronado s/n',
      ciudad: 'Santa Cruz',
      departamento: 'Santa Cruz',
      destacado: true,
      categorias: [
        { nombre: 'General Pista', precio: 80, cupoTotal: 1200, cupoDisponible: 950 },
        { nombre: 'Ultra Lounge VIP', precio: 200, cupoTotal: 400, cupoDisponible: 310 },
      ],
    },
    {
      titulo: 'Noche Neón Cochabamba: Eco Frecuencias',
      descripcion:
        'Una velada de dream pop y retrowave en el valle de Cochabamba. Atmósferas envolventes, sintetizadores analógicos y una puesta en escena futurista irrepetible.',
      portadaUrl: '/images/sonic-concert.webp',
      genero: 'Dream Pop / Retrowave',
      diasFuturo: 45,
      duracionHoras: 4,
      recinto: 'Campo Ferial Alalay — Pabellón Internacional',
      direccion: 'Circuito Laguna Alalay',
      ciudad: 'Cochabamba',
      departamento: 'Cochabamba',
      destacado: true,
      categorias: [
        { nombre: 'Entrada General', precio: 60, cupoTotal: 600, cupoDisponible: 520 },
        { nombre: 'Sector Preferencial VIP', precio: 120, cupoTotal: 250, cupoDisponible: 190 },
      ],
    },
  ];

  const seededConcerts = [];

  for (const cData of demoConcertsData) {
    let concierto = await conciertoRepo.findOne({
      where: { titulo: cData.titulo, organizadorId: organizador.id },
      relations: { categorias: true, artistas: true },
    });

    const now = Date.now();
    const fechaInicio = new Date(now + cData.diasFuturo * 24 * 3600 * 1000);
    const fechaFin = new Date(fechaInicio.getTime() + cData.duracionHoras * 3600 * 1000);
    const inicioVenta = new Date(now - 7 * 24 * 3600 * 1000);

    if (!concierto) {
      concierto = conciertoRepo.create({
        organizadorId: organizador.id,
        titulo: cData.titulo,
        descripcion: cData.descripcion,
        portadaUrl: cData.portadaUrl,
        genero: cData.genero,
        fechaInicio,
        fechaFin,
        zonaHoraria: 'America/La_Paz',
        recinto: cData.recinto,
        direccion: cData.direccion,
        ciudad: cData.ciudad,
        departamento: cData.departamento,
        estado: ConciertoEstado.PUBLICADO,
        inicioVenta,
        destacado: cData.destacado,
      });
      concierto = await conciertoRepo.save(concierto);
    } else {
      concierto.descripcion = cData.descripcion;
      concierto.portadaUrl = cData.portadaUrl;
      concierto.genero = cData.genero;
      concierto.fechaInicio = fechaInicio;
      concierto.fechaFin = fechaFin;
      concierto.recinto = cData.recinto;
      concierto.direccion = cData.direccion;
      concierto.ciudad = cData.ciudad;
      concierto.departamento = cData.departamento;
      concierto.estado = ConciertoEstado.PUBLICADO;
      concierto.inicioVenta = inicioVenta;
      concierto.destacado = cData.destacado;
      concierto = await conciertoRepo.save(concierto);
    }

    const existingArtistas = await conciertoArtistaRepo.find({
      where: { conciertoId: concierto.id },
    });
    if (existingArtistas.length === 0) {
      const ca = conciertoArtistaRepo.create({
        conciertoId: concierto.id,
        artistaId: artistaNeon?.id || null,
        nombreArtista: artistaNeon?.nombreArtistico || 'Aura Neón',
        orden: 1,
      });
      await conciertoArtistaRepo.save(ca);
    }

    const existingCats = await categoriaRepo.find({
      where: { conciertoId: concierto.id },
    });
    if (existingCats.length === 0) {
      for (const cat of cData.categorias) {
        const catEntity = categoriaRepo.create({
          conciertoId: concierto.id,
          nombre: cat.nombre,
          precio: cat.precio,
          moneda: 'BOB',
          cupoTotal: cat.cupoTotal,
          cupoDisponible: cat.cupoDisponible,
          disponible: true,
        });
        await categoriaRepo.save(catEntity);
      }
    }

    seededConcerts.push({
      id: concierto.id,
      titulo: concierto.titulo,
      ciudad: concierto.ciudad,
      fecha: concierto.fechaInicio.toISOString(),
    });
  }

  return seededConcerts;
}

async function main() {
  try {
    const results = await seedDemoAccounts(dataSource);
    console.log('✓ Semillas de demostración cargadas correctamente (entorno local):');
    for (const r of results) {
      console.log(
        `  - ${r.email} | Usuario: "${r.username}" | Roles: [${r.roles.join(', ')}]${r.perfilArtistico ? ` | Artista: "${r.perfilArtistico}"` : ''}`,
      );
    }
    const concerts = await seedDemoConcerts(dataSource);
    console.log('✓ Conciertos de demostración cargados correctamente:');
    for (const c of concerts) {
      console.log(`  - Concierto: "${c.titulo}" | Ciudad: ${c.ciudad} | Fecha: ${c.fecha}`);
    }
  } catch (error) {
    console.error('✗ Error ejecutando semillas:', (error as Error).message);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Ejecución directa por CLI
if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed.ts'))
) {
  void main();
}
