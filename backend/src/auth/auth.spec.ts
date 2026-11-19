import { Test } from '@nestjs/testing';
import { Controller, Get, UseGuards, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import request from 'supertest';
import { AuthService } from './auth.service.js';
import { AuthController, JwtGuard } from './auth.controller.js';
import { Usuario } from './usuario.entity.js';
import { Rol, RolNombre } from './rol.entity.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { INestApplication } from '@nestjs/common';

@Controller('test-roles')
class TestRolesController {
  @Get('artista-only')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ARTISTA)
  artistaOnly() {
    return { ok: true, section: 'panel-artista' };
  }

  @Get('cliente-only')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.CLIENTE)
  clienteOnly() {
    return { ok: true, section: 'oyente' };
  }
}

describe('CU01 / CU02 HTTP y Modelo Multirrol (repository double)', () => {
  let app: INestApplication;
  let saved: Usuario | undefined;

  const mockClienteRol: Rol = {
    id: 'role-uuid-cliente',
    nombre: RolNombre.CLIENTE,
    descripcion: 'Rol inicial',
    createdAt: new Date(),
  };

  const mockArtistaRol: Rol = {
    id: 'role-uuid-artista',
    nombre: RolNombre.ARTISTA,
    descripcion: 'Perfil artístico',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    saved = undefined;

    const userRepo = {
      create: (u: Partial<Usuario>) => Object.assign(new Usuario(), u),
      save: async (u: Usuario) => {
        if (saved) throw Object.assign(new Error(), { code: '23505' });
        saved = Object.assign(new Usuario(), u, {
          id: '11111111-1111-4111-8111-111111111111',
          roles: u.roles ?? [mockClienteRol],
        });
        return saved;
      },
      createQueryBuilder: () => {
        const query: any = {
          leftJoinAndSelect: () => query,
          addSelect: () => query,
          where: (_sql: string, params: { email: string }) => {
            query.getOne = async () => (saved?.email === params.email ? saved : null);
            return query;
          },
          getOne: async (): Promise<Usuario | null> => saved ?? null,
        };
        return query;
      },
      findOneBy: async ({ id }: { id: string }) => (saved?.id === id ? saved : null),
      findOne: async ({ where }: { where: { id: string } }) => (saved?.id === where.id ? saved : null),
    };

    const rolesRepo = {
      findOneBy: async ({ nombre }: { nombre: RolNombre }) => {
        if (nombre === RolNombre.CLIENTE) return mockClienteRol;
        if (nombre === RolNombre.ARTISTA) return mockArtistaRol;
        return null;
      },
    };

    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-only-secret-at-least-32-characters',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AuthController, TestRolesController],
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

  afterEach(async () => {
    if (app) await app.close();
  });

  const body = {
    username: 'Oyente',
    email: 'Listener@example.com',
    password: 'Correcta123!',
    acceptedTerms: true,
  };

  it('registers hashed basic user with CLIENTE role by default, rejects duplicate and never returns hash', async () => {
    const response = await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    expect(response.body).toMatchObject({
      email: 'listener@example.com',
      role: 'CLIENTE',
      roles: ['CLIENTE'],
    });
    expect(response.body.passwordHash).toBeUndefined();
    expect(saved?.passwordHash).not.toBe(body.password);
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(409);
  });

  it('rejects privileged fields (admin, artista), missing terms and short passwords', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, role: 'admin' }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, role: 'ARTISTA' }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, roles: ['ADMIN'] }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, acceptedTerms: false }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({ ...body, password: 'short' }).expect(400);
  });

  it('uses an HttpOnly persistent web cookie and clears it on logout', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: body.email, password: body.password, client: 'web', remember: true })
      .expect(200);
    expect(login.body.accessToken).toBeUndefined();
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Max-Age=3600');
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie.split(';')[0]).expect(200);
    const logout = await request(app.getHttpServer()).post('/auth/logout').send({}).expect(200);
    expect(String(logout.headers['set-cookie'])).toContain('sonic_session=;');
  });

  it('checks login, JWT access, tampering and logout semantics', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    await request(app.getHttpServer()).post('/auth/login').send({ email: body.email, password: 'wrong' }).expect(401);
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.roles).toContain('CLIENTE');
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', 'Bearer corrupted').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + response.body.accessToken)
      .expect(200);
    await request(app.getHttpServer()).post('/auth/logout').send({}).expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + response.body.accessToken)
      .expect(200);
  });

  it('verifies multi-role authorization with RolesGuard in backend', async () => {
    // 1. Register base user (gets CLIENTE)
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200);
    const token = loginRes.body.accessToken;

    // 2. Can access clienteOnly route
    await request(app.getHttpServer())
      .get('/test-roles/cliente-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // 3. Denied from artistaOnly route (403 Forbidden)
    await request(app.getHttpServer())
      .get('/test-roles/artista-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    // 4. Assign ARTISTA role (user now has multiple roles: CLIENTE + ARTISTA)
    saved!.roles = [mockClienteRol, mockArtistaRol];

    // 5. Backend check evaluates live DB state and now allows access
    const allowedRes = await request(app.getHttpServer())
      .get('/test-roles/artista-only')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(allowedRes.body.ok).toBe(true);
  });

  it('generates a short-lived stream ticket and restricts its scope', async () => {
    await request(app.getHttpServer()).post('/auth/register').send(body).expect(201);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email: body.email, password: body.password }).expect(200);
    const token = login.body.accessToken;

    await request(app.getHttpServer()).get('/auth/stream-ticket').set('Authorization', 'Bearer ' + token).expect(400);

    const ticketRes = await request(app.getHttpServer())
      .get('/auth/stream-ticket?trackId=audius:track123')
      .set('Authorization', 'Bearer ' + token)
      .expect(200);
    expect(ticketRes.body.ticket).toBeDefined();

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer ' + ticketRes.body.ticket)
      .expect(401);
  });
});
