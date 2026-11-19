import { describe, it, expect, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './profile.dto.js';
import type { Repository } from 'typeorm';
import type { Usuario } from './usuario.entity.js';
import type { Genero } from '../musica/genero.entity.js';
const valid = {
  displayName: 'Mi nombre',
  biography: 'Música',
  genreIds: [],
  moods: ['Entrenar'],
  intensity: 80,
  discovery: 70,
  energy: 60,
};
describe('CU03 perfil', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = (body: unknown) =>
    pipe.transform(body, { type: 'body', metatype: UpdateProfileDto });
  it('acepta preferencias y rechaza campos de otra cuenta, roles y correo', async () => {
    await expect(validate(valid)).resolves.toMatchObject(valid);
    for (const extra of [
      { id: 'otro' },
      { userId: 'otro' },
      { roles: ['ADMIN'] },
      { email: 'otro@example.com' },
      { username: 'otro' },
    ])
      await expect(validate({ ...valid, ...extra })).rejects.toThrow();
  });
  it('valida rangos, texto, géneros y estados de ánimo', async () => {
    for (const extra of [
      { displayName: ' ' },
      { biography: 'a'.repeat(301) },
      { genreIds: ['inventado'] },
      { moods: ['inventado'] },
      { energy: 101 },
      { intensity: -1 },
      { discovery: 1.2 },
      { energy: null },
    ])
      await expect(validate({ ...valid, ...extra })).rejects.toThrow();
  });
  it('actualiza exclusivamente el id autenticado y recupera preferencias', async () => {
    let stored = {
      id: 'actual',
      username: 'usuario',
      email: 'u@example.com',
      musicPreferences: {},
    };
    const update = vi.fn((id: string, data: object) => {
      expect(id).toBe('actual');
      stored = { ...stored, ...data };
      return { affected: 1 };
    });
    const users = { update, findOneBy: vi.fn(() => stored) };
    const service = new ProfileService(
      users as unknown as Repository<Usuario>,
      { countBy: vi.fn(() => 0) } as unknown as Repository<Genero>,
    );
    await expect(service.update('actual', valid)).resolves.toMatchObject(valid);
    expect(update.mock.calls[0][1]).not.toHaveProperty('roles');
    await expect(service.get('actual')).resolves.toMatchObject(valid);
    await expect(
      service.update('actual', {
        ...valid,
        genreIds: ['550e8400-e29b-41d4-a716-446655440000'],
      }),
    ).rejects.toThrow('Selecciona');
  });
});
