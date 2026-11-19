import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Usuario } from './usuario.entity.js';
import { Rol, RolNombre } from './rol.entity.js';
import type { LoginDto, RegisterDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly users: Repository<Usuario>,
    @InjectRepository(Rol) private readonly rolesRepo: Repository<Rol>,
    private readonly jwt: JwtService,
  ) {}

  publicUser(user: Usuario) {
    const roleNames =
      user.roles && user.roles.length > 0
        ? user.roles.map((r) => r.nombre)
        : user.role
          ? [user.role.toLowerCase() === 'admin' ? RolNombre.ADMIN : RolNombre.CLIENTE]
          : [RolNombre.CLIENTE];

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      roles: roleNames,
      role: roleNames[0] ?? RolNombre.CLIENTE,
    };
  }

  async register(dto: RegisterDto) {
    const username = dto.username.trim();
    if (username.length < 2 || Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException('Nombre o contraseña inválidos (máximo 72 bytes).');
    }

    const clienteRole = await this.rolesRepo.findOneBy({ nombre: RolNombre.CLIENTE });
    if (!clienteRole) {
      throw new Error('El rol CLIENTE no está configurado en el sistema.');
    }

    try {
      const user = this.users.create({
        username,
        email: dto.email.trim().toLowerCase(),
        passwordHash: await hash(dto.password, 12),
        roles: [clienteRole],
        role: 'usuario',
      });

      const saved = await this.users.save(user);
      return this.publicUser(saved);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Este correo ya está registrado.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.roles', 'r')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email.trim().toLowerCase() })
      .getOne();

    const fallback = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid = await compare(dto.password, user?.passwordHash ?? fallback);

    if (!user || !valid || Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const roleNames =
      user.roles && user.roles.length > 0
        ? user.roles.map((r) => r.nombre)
        : user.role
          ? [user.role.toLowerCase() === 'admin' ? RolNombre.ADMIN : RolNombre.CLIENTE]
          : [RolNombre.CLIENTE];

    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        version: user.authVersion ?? 0,
        roles: roleNames,
      }),
      user: this.publicUser(user),
      expiresIn: 3600,
    };
  }

  async authenticate(token: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; version?: number; roles?: string[] }>(token);
      const user = await this.users.findOne({
        where: { id: payload.sub },
        relations: { roles: true },
      });

      if (!user || (payload.version ?? 0) !== (user.authVersion ?? 0)) {
        throw new Error();
      }

      return this.publicUser(user);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }
  }

  // Métodos de autorización y gestión interna de roles
  async assignRole(userId: string, roleName: RolNombre): Promise<Usuario> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const role = await this.rolesRepo.findOneBy({ nombre: roleName });
    if (!role) {
      throw new NotFoundException(`Rol ${roleName} no encontrado.`);
    }

    const alreadyHas = user.roles.some((r) => r.nombre === roleName);
    if (!alreadyHas) {
      user.roles.push(role);
      await this.users.save(user);
    }

    return user;
  }

  async removeRole(userId: string, roleName: RolNombre): Promise<Usuario> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    user.roles = user.roles.filter((r) => r.nombre !== roleName);
    await this.users.save(user);
    return user;
  }
}
