import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { RolNombre } from './rol.entity.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolNombre[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { roles?: string[] } }>();
    const user = request.user;

    if (!user || !Array.isArray(user.roles) || user.roles.length === 0) {
      throw new ForbiddenException('Acceso denegado: usuario sin roles asignados.');
    }

    const hasRole = user.roles.some((userRole) => requiredRoles.includes(userRole as RolNombre));
    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso restringido. Se requiere alguno de los siguientes roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
