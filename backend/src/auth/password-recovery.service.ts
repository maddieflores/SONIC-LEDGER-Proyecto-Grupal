import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { hash } from 'bcryptjs';
import { Usuario } from './usuario.entity.js';
import { RecoveryMailService } from './recovery-mail.service.js';
export const RECOVERY_MESSAGE = 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.';
@Injectable()
export class PasswordRecoveryService {
 private readonly logger = new Logger(PasswordRecoveryService.name);
 constructor(@InjectRepository(Usuario) private readonly users: Repository<Usuario>, private readonly mail: RecoveryMailService) {}
 async forgot(email: string) {
  this.mail.configuration();
  const start = Date.now();
  try {
   const token = randomBytes(32).toString('hex');
   const digest = createHash('sha256').update(token).digest('hex');
   const user = await this.users.findOneBy({ email: email.trim().toLowerCase() });
   if (user) {
    await this.users.update(user.id, { passwordResetHash: digest, passwordResetExpiresAt: new Date(Date.now() + 15 * 60_000) });
    try { await this.mail.send(user.email, token); }
    catch {
     // Do not expose account existence or log a recovery link/token.
     await this.users.createQueryBuilder().update(Usuario).set({ passwordResetHash: null, passwordResetExpiresAt: null }).where('id = :id AND "passwordResetHash" = :digest', { id: user.id, digest }).execute();
     this.logger.error('No se pudo guardar el correo local de recuperación.');
    }
   }
   return { message: RECOVERY_MESSAGE };
  } finally { await delay(Math.max(0, 500 - (Date.now() - start))); }
 }
 async reset(token: string, password: string) {
  if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('La contraseña admite un máximo de 72 bytes.');
  const digest = createHash('sha256').update(token).digest('hex');
  const passwordHash = await hash(password, 12);
  // Single atomic update: only one concurrent request can consume a valid token.
  const result = await this.users.createQueryBuilder().update(Usuario).set({
   passwordHash, passwordResetHash: null, passwordResetExpiresAt: null, authVersion: () => '"authVersion" + 1',
  }).where('"passwordResetHash" = :digest AND "passwordResetExpiresAt" > CURRENT_TIMESTAMP', { digest }).execute();
  if (result.affected !== 1) throw new BadRequestException('El enlace no es válido o ha expirado. Solicita uno nuevo.');
  return { message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' };
 }
}
