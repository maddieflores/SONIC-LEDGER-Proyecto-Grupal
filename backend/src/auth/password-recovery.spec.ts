import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { compare } from 'bcryptjs';
import { Usuario } from './usuario.entity.js';
import { PasswordRecoveryService, RECOVERY_MESSAGE } from './password-recovery.service.js';
import { RecoveryMailService } from './recovery-mail.service.js';
describe('Password recovery', () => {
 afterEach(()=>vi.unstubAllEnvs());
 function setup(found: boolean, affected = 1) {
  const query = { update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({affected}) };
  const repo = { findOneBy: vi.fn().mockResolvedValue(found ? {id:'test-id',email:'listener@example.com'} : null), update: vi.fn().mockResolvedValue({affected:1}), createQueryBuilder: () => query };
  const mail = { configuration: vi.fn(), send: vi.fn().mockResolvedValue(undefined) };
  const service = new PasswordRecoveryService(repo as unknown as Repository<Usuario>, mail as unknown as RecoveryMailService);
  return {repo,query,mail,service};
 }
 it('returns a generic response for existing and missing accounts and stores only the token hash',async()=>{
  const existing=setup(true);const missing=setup(false);
  expect(await existing.service.forgot('LISTENER@example.com')).toEqual({message:RECOVERY_MESSAGE});
  expect(await missing.service.forgot('missing@example.com')).toEqual({message:RECOVERY_MESSAGE});
  expect(missing.mail.send).not.toHaveBeenCalled();
  const token=existing.mail.send.mock.calls[0][1];
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(existing.repo.update.mock.calls[0][1].passwordResetHash).toBe(createHash('sha256').update(token).digest('hex'));
  expect(existing.repo.findOneBy).toHaveBeenCalledWith({email:'listener@example.com'});
 });
 it('hashes the new password, consumes the token atomically and increments the session version',async()=>{
  const {service,query}=setup(true);await service.reset('a'.repeat(64),'NuevaClave123!');
  const update=query.set.mock.calls[0][0];expect(await compare('NuevaClave123!',update.passwordHash)).toBe(true);
  expect(update.passwordResetHash).toBeNull();expect(update.passwordResetExpiresAt).toBeNull();expect(update.authVersion()).toBe('"authVersion" + 1');
  expect(query.where.mock.calls[0][0]).toContain('CURRENT_TIMESTAMP');
 });
 it('rejects expired/consumed tokens and passwords exceeding bcrypt byte limit',async()=>{
  const {service}=setup(false,0);
  await expect(service.reset('a'.repeat(64),'NuevaClave123!')).rejects.toBeInstanceOf(BadRequestException);
  await expect(service.reset('a'.repeat(64),'🔒'.repeat(30))).rejects.toBeInstanceOf(BadRequestException);
 });
 it('disables local test email in production',()=>{
  vi.stubEnv('NODE_ENV','production');expect(()=>new RecoveryMailService().configuration()).toThrow(ServiceUnavailableException);
 });
});
