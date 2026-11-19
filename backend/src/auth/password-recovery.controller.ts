import { Body, Controller, HttpCode, HttpException, Injectable, Post, UseGuards } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { ForgotPasswordDto, ResetPasswordDto } from './auth.dto.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
@Injectable()
export class RecoveryRateGuard implements CanActivate {
 private readonly attempts = new Map<string, { count: number; until: number }>();
 canActivate(context: ExecutionContext) {
  const req = context.switchToHttp().getRequest<Request>();
  const now = Date.now();
  for (const [key, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(key);
  const route = context.getHandler().name;
  const keys: [string, number][] = [[`${route}:ip:${req.ip}`, 20]];
  if (route === 'forgot' && typeof req.body?.email === 'string') keys.push([`email:${createHash('sha256').update(req.body.email.trim().toLowerCase()).digest('hex')}`, 3]);
  for (const [key, limit] of keys) {
   const entry = this.attempts.get(key);
   if (entry && entry.count >= limit) throw new HttpException('Demasiados intentos. Inténtalo de nuevo en 15 minutos.', 429);
  }
  if (this.attempts.size > 10_000) throw new HttpException('Demasiados intentos. Inténtalo más tarde.', 429);
  for (const [key] of keys) {
   const entry = this.attempts.get(key);
   if (entry) entry.count++; else this.attempts.set(key, { count: 1, until: now + 15 * 60_000 });
  }
  return true;
 }
}
@Controller('auth')
@UseGuards(RecoveryRateGuard)
export class PasswordRecoveryController {
 constructor(private readonly recovery: PasswordRecoveryService) {}
 @Post('forgot-password') @HttpCode(202) forgot(@Body() dto: ForgotPasswordDto) { return this.recovery.forgot(dto.email); }
 @Post('reset-password') @HttpCode(200) reset(@Body() dto: ResetPasswordDto) { return this.recovery.reset(dto.token, dto.password); }
}
