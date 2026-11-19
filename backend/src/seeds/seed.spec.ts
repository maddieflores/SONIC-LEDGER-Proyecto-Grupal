import { Test } from '@nestjs/testing';
import { Controller, Get, UseGuards, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { hash } from 'bcryptjs';
import type { INestApplication } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { AuthController, JwtGuard } from '../auth/auth.controller.js';
import { Usuario } from '../auth/usuario.entity.js';
import { Rol, RolNombre } from '../auth/rol.entity.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { DEMO_ACCOUNTS, getPasswordForAccount } from './seed.js';

@Controller('test-permisos')
class TestPermisosController {
  @Get('publico')
  publico() {
    return { ok: true, scope: 'public' };
  }

  @Get('solo-cliente')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.CLIENTE)
  soloCliente() {
    return { ok: true, scope: 'cliente' };
  }

  @Get('solo-artista')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ARTISTA)
  soloArtista() {
    return { ok: true, scope: 'artista' };
  }

  @Get('solo-organizador')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR)
  soloOrganizador() {
    return { ok: true, scope: 'organizador' };
  }

  @Get('solo-verificador')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.VERIFICADOR)
  soloVerificador() {
    return { ok: true, scope: 'verificador' };
  }

  @Get('solo-admin')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ADMIN)
  soloAdmin() {
    return { ok: true, scope: 'admin' };
  }
}

describe('Semillas de demostración y autorización por rol', () => {
  let app: INestApplication;
  const inMemoryUsers: Map<string, Usuario> = new Map();

  const roleMap: Map<RolNombre, Rol> = new Map([
    [RolNombre.CLIENTE, { id: 'r-cliente', nombre: RolNombre.CLIENTE, descripcion: null, createdAt: new Date() }],
    [RolNombre.ARTISTA, { id: 'r-artista', nombre: RolNombre.ARTISTA, descripcion: null, createdAt: new Date() }],
    [RolNombre.ORGANIZADOR, { id: 'r-org', nombre: RolNombre.ORGANIZADOR, descripcion: null, createdAt: new Date() }],
    [RolNombre.VERIFICADOR, { id: 'r-verif', nombre: RolNombre.VERIFICADOR, descripcion: null, createdAt: new Date() }],
    [RolNombre.ADMIN, { id: 'r-admin', nombre: RolNombre.ADMIN, descripcion: null, createdAt: new Date() }],
  ]);

  const testPassword = 'TestDemoPassword2026!';

  beforeAll(async () => {
    process.env.DEMO_PASSWORD = testPassword;

    // Poblar usuarios en memoria basados en DEMO_ACCOUNTS
    for (const acc of DEMO_ACCOUNTS) {
      const u = new Usuario();
      u.id = `uuid-${acc.email}`;
      u.username = acc.username;
      u.email = acc.email.toLowerCase();
      u.passwordHash = await hash(testPassword, 12);
      u.roles = acc.roles.map((rn) => roleMap.get(rn)!);
      u.authVersion = 0;
      inMemoryUsers.set(u.email, u);
    }

    const userRepo = {
      findOne: async ({ where }: { where: { email?: string; id?: string } }) => {
        if (where.email) return inMemoryUsers.get(where.email.toLowerCase()) ?? null;
        if (where.id) {
          for (const u of inMemoryUsers.values()) {
            if (u.id === where.id) return u;
          }
        }
        return null;
      },
      createQueryBuilder: () => {
        let searchedEmail = '';
        const query: any = {
          leftJoinAndSelect: () => query,
          addSelect: () => query,
          where: (_sql: string, params: { email: string }) => {
            searchedEmail = params.email;
            return query;
          },
          getOne: async (): Promise<Usuario | null> => inMemoryUsers.get(searchedEmail) ?? null,
        };
        return query;
      },
    };

    const rolesRepo = {
      findOneBy: async ({ nombre }: { nombre: RolNombre }) => roleMap.get(nombre) ?? null,
    };

    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-seed-secret-at-least-32-chars-long',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController, TestPermisosController],
      providers: [
        AuthService,
        JwtGuard,
        RolesGuard,
        { provide: getRepositoryToken(Usuario), useValue: userRepo },
        { provide: getRepositoryToken(Rol), useValue: rolesRepo },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('valida la configuración de contraseña y rechaza contraseñas no seguras o ausentes', () => {
    delete process.env.DEMO_PASSWORD;
    delete process.env.DEMO_CLIENTE_PASSWORD;
    expect(() => getPasswordForAccount(DEMO_ACCOUNTS[0])).toThrow(/Contraseña no configurada/);

    process.env.DEMO_PASSWORD = testPassword;
    expect(getPasswordForAccount(DEMO_ACCOUNTS[0])).toBe(testPassword);
  });

  it('verifica que cada cuenta demo tiene exactamente y únicamente sus roles asignados', () => {
    for (const acc of DEMO_ACCOUNTS) {
      const u = inMemoryUsers.get(acc.email.toLowerCase());
      expect(u).toBeDefined();
      const rolesAsignados = u!.roles.map((r) => r.nombre).sort();
      const rolesEsperados = [...acc.roles].sort();
      expect(rolesAsignados).toEqual(rolesEsperados);
    }
  });

  it('inicia sesión exitosamente con cada cuenta demo y rechaza credenciales incorrectas', async () => {
    for (const acc of DEMO_ACCOUNTS) {
      // 1. Fallo con contraseña errónea
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: acc.email, password: 'ContrasenaIncorrecta123!' })
        .expect(401);

      // 2. Éxito con contraseña correcta
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: acc.email, password: testPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(acc.email.toLowerCase());
      expect(res.body.user.roles.sort()).toEqual([...acc.roles].sort());
      expect(res.body.user.passwordHash).toBeUndefined();
    }
  }, 15000);

  it('aplica autorización RBAC: deniega acceso a operaciones sin permiso y permite con rol autorizado', async () => {
    // Obtener tokens para cada cuenta
    const tokens: Record<string, string> = {};
    for (const acc of DEMO_ACCOUNTS) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: acc.email, password: testPassword });
      tokens[acc.email] = res.body.accessToken;
    }

    const clienteToken = tokens['demo.cliente@example.com'];
    const artistaToken = tokens['demo.artista@example.com'];
    const orgToken = tokens['demo.organizador@example.com'];
    const verifToken = tokens['demo.verificador@example.com'];
    const adminToken = tokens['demo.admin@example.com'];

    // 1. Cliente: permitido en solo-cliente, denegado (403) en artista, org, verif, admin
    await request(app.getHttpServer()).get('/test-permisos/solo-cliente').set('Authorization', `Bearer ${clienteToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-artista').set('Authorization', `Bearer ${clienteToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-organizador').set('Authorization', `Bearer ${clienteToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-verificador').set('Authorization', `Bearer ${clienteToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-admin').set('Authorization', `Bearer ${clienteToken}`).expect(403);

    // 2. Artista: permitido en artista y cliente, denegado en organizador, verificador, admin
    await request(app.getHttpServer()).get('/test-permisos/solo-artista').set('Authorization', `Bearer ${artistaToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-cliente').set('Authorization', `Bearer ${artistaToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-organizador').set('Authorization', `Bearer ${artistaToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-admin').set('Authorization', `Bearer ${artistaToken}`).expect(403);

    // 3. Organizador: permitido en organizador y cliente, denegado en artista y admin
    await request(app.getHttpServer()).get('/test-permisos/solo-organizador').set('Authorization', `Bearer ${orgToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-cliente').set('Authorization', `Bearer ${orgToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-artista').set('Authorization', `Bearer ${orgToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-admin').set('Authorization', `Bearer ${orgToken}`).expect(403);

    // 4. Verificador: permitido en verificador y cliente, denegado en artista, organizador y admin
    await request(app.getHttpServer()).get('/test-permisos/solo-verificador').set('Authorization', `Bearer ${verifToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-cliente').set('Authorization', `Bearer ${verifToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-artista').set('Authorization', `Bearer ${verifToken}`).expect(403);
    await request(app.getHttpServer()).get('/test-permisos/solo-admin').set('Authorization', `Bearer ${verifToken}`).expect(403);

    // 5. Admin: permitido en admin y cliente
    await request(app.getHttpServer()).get('/test-permisos/solo-admin').set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app.getHttpServer()).get('/test-permisos/solo-cliente').set('Authorization', `Bearer ${adminToken}`).expect(200);
  }, 15000);
});
