import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';
import { Genero } from '../musica/genero.entity.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Usuario } from './usuario.entity.js';
import { Rol } from './rol.entity.js';
import { AuthService } from './auth.service.js';
import { AuthController, JwtGuard } from './auth.controller.js';
import { RolesGuard } from './roles.guard.js';
import { PasswordRecoveryController, RecoveryRateGuard } from './password-recovery.controller.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { RecoveryMailService } from './recovery-mail.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol, Genero]),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32 || secret.startsWith('REEMPLAZAR')) {
          throw new Error('Configura JWT_SECRET aleatorio de al menos 32 caracteres.');
        }
        return {
          secret,
          signOptions: { expiresIn: '1h', issuer: 'sonic-ledger', audience: 'sonic-clients' },
          verifyOptions: { issuer: 'sonic-ledger', audience: 'sonic-clients', algorithms: ['HS256'] },
        };
      },
    }),
  ],
  controllers: [ProfileController, AuthController, PasswordRecoveryController],
  providers: [
    ProfileService,
    AuthService,
    JwtGuard,
    RolesGuard,
    PasswordRecoveryService,
    RecoveryMailService,
    RecoveryRateGuard,
  ],
  exports: [AuthService, JwtGuard, RolesGuard],
})
export class AuthModule {}
