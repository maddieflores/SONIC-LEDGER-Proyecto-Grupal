import { Body, Controller, Get, HttpCode, Injectable, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';

import type { CanActivate, ExecutionContext } from '@nestjs/common';

import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';

import { LoginDto, RegisterDto } from './auth.dto.js';

type AuthRequest = Request & { user?: Awaited<ReturnType<AuthService['authenticate']>> };

@Injectable()

export class JwtGuard implements CanActivate {

 constructor(private readonly auth: AuthService) {}

 async canActivate(context: ExecutionContext) {

  const req = context.switchToHttp().getRequest<AuthRequest>();

  const [scheme, bearer] = req.headers.authorization?.split(' ') ?? [];
  const cookie = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('sonic_session='))?.slice('sonic_session='.length);
  const token = scheme === 'Bearer' ? bearer : cookie;
  if (!token) throw new UnauthorizedException();

  req.user = await this.auth.authenticate(token);

  return true;

 }

}

@Controller('auth')

export class AuthController {

 constructor(private readonly auth: AuthService) {}

 @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

 @Post('login') @HttpCode(200) async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const result = await this.auth.login(dto);
  if (dto.client === 'web') { res.cookie('sonic_session', result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', ...(dto.remember ? { maxAge: 3600000 } : {}) }); return { user: result.user, expiresIn: result.expiresIn }; }
  return result;
 }

 @Get('me') @UseGuards(JwtGuard) me(@Req() req: AuthRequest) { return req.user; }

 @Post('logout') @HttpCode(200) logout(@Res({ passthrough: true }) res: Response) { res.clearCookie('sonic_session', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' }); return { message: 'Elimina las credenciales del cliente. El JWT vence a la hora de emisión más 3600 segundos.' }; }

}

