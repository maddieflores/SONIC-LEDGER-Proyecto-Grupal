import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
@Injectable()
export class RecoveryMailService {
 configuration() {
  // Local delivery is intentionally never enabled in production.
  if (process.env.NODE_ENV === 'production' || (process.env.PASSWORD_RESET_MAIL_MODE ?? 'local') !== 'local') {
   throw new ServiceUnavailableException('La recuperación por correo no está configurada.');
  }
  const url = new URL(process.env.PASSWORD_RESET_URL ?? 'http://localhost:5173/restablecer-contrasena');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new ServiceUnavailableException('URL de recuperación inválida.');
  url.search = ''; url.hash = '';
  return url;
 }
 async send(email: string, token: string) {
  const url = this.configuration();
  // Fragment keeps the token out of HTTP access logs and referrer headers.
  url.hash = new URLSearchParams({ token }).toString();
  const directory = resolve(process.cwd(), '.local', 'mail');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({
   to: email, subject: 'Restablece tu contraseña de Sonic Ledger',
   text: `Solicitaste cambiar tu contraseña. Abre este enlace (válido 15 minutos, un solo uso):\n${url.toString()}\nSi no lo solicitaste, ignora este mensaje.`,
   resetUrl: url.toString(), expiresInMinutes: 15,
  }, null, 2), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
 }
}
