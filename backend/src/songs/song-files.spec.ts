import { describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import type { Repository } from 'typeorm';
import { SongDto } from './songs.dto.js';
import { ValidationPipe } from '@nestjs/common';
import {
  validateSongCover,
  validateWav,
  type UploadedSongFile,
} from './song-files.js';
import { SongsService } from './songs.service.js';
import { Cancion } from '../musica/cancion.entity.js';
import { Artista } from '../musica/artista.entity.js';
import { Genero } from '../musica/genero.entity.js';
import { Lanzamiento } from '../musica/lanzamiento.entity.js';
function wav(): UploadedSongFile {
  const b = Buffer.alloc(44 + 32000);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(32000, 40);
  for (let i = 0; i < 16000; i++)
    b.writeInt16LE(
      Math.round(Math.sin((i * 440 * 2 * Math.PI) / 16000) * 8000),
      44 + i * 2,
    );
  return { buffer: b, mimetype: 'audio/wav', originalname: 'real.wav' };
}
function png(size: number): UploadedSongFile {
  function crc(b: Buffer) {
    let c = 0xffffffff;
    for (const v of b) {
      c ^= v;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type: string, data: Buffer) {
    const b = Buffer.alloc(data.length + 12);
    b.writeUInt32BE(data.length);
    b.write(type, 4);
    data.copy(b, 8);
    b.writeUInt32BE(crc(b.subarray(4, b.length - 4)), b.length - 4);
    return b;
  }
  const h = Buffer.alloc(13);
  h.writeUInt32BE(size);
  h.writeUInt32BE(size, 4);
  h[8] = 8;
  h[9] = 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  return {
    buffer: Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', h),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
    mimetype: 'image/png',
    originalname: 'cover.png',
  };
}
describe('CU05 validación de audio y portada', () => {
  it('calcula duración de un WAV PCM real y rechaza MP3/FLAC no soportados', () => {
    expect(validateWav(wav())).toBe(1);
    for (const originalname of ['track.mp3', 'track.flac', 'track.jpg'])
      expect(() => validateWav({ ...wav(), originalname })).toThrow();
  });
  it('rechaza MIME falso, cabecera truncada, tamaño inconsistente y PCM corrupto', () => {
    expect(() => validateWav({ ...wav(), mimetype: 'image/png' })).toThrow();
    expect(() =>
      validateWav({ ...wav(), buffer: Buffer.from('RIFF') }),
    ).toThrow();
    for (const [offset, value] of [
      [4, 0],
      [20, 3],
      [22, 5],
      [24, 0],
      [28, 1],
      [32, 3],
      [40, 31999],
    ]) {
      const file = wav();
      file.buffer.writeUInt32LE(value, offset);
      expect(() => validateWav(file)).toThrow();
    }
  });
  it('valida dimensiones y CRC de la portada y rechaza imágenes pequeñas o falsificadas', () => {
    expect(validateSongCover(png(1200))).toBe('png');
    expect(() => validateSongCover(png(100))).toThrow('1200');
    expect(() =>
      validateSongCover({ ...png(1200), mimetype: 'image/jpeg' }),
    ).toThrow();
    const damaged = png(1200);
    damaged.buffer[damaged.buffer.length - 1] ^= 1;
    expect(() => validateSongCover(damaged)).toThrow();
  });
  it('rechaza propiedad, estado y rutas de archivos enviados como metadatos', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const dto = {
      titulo: 'Mi canción',
      descripcion: '',
      generoId: null,
      lanzamientoId: null,
    };
    await expect(
      pipe.transform(dto, { type: 'body', metatype: SongDto }),
    ).resolves.toMatchObject(dto);
    for (const extra of [
      { artistaId: 'otro' },
      { estado: 'publicado' },
      { archivoAudioUrl: '/etc/passwd' },
      { duracionSegundos: 100 },
    ])
      await expect(
        pipe.transform(
          { ...dto, ...extra },
          { type: 'body', metatype: SongDto },
        ),
      ).rejects.toThrow();
  });
  it('compensa la escritura del archivo si falla la transacción de base de datos', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sonic-cu05-'));
    const repository = {
      findOne: async () => ({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      manager: {
        transaction: async () => {
          throw new Error('DB unavailable');
        },
      },
    };
    const service = new SongsService(
      repository as unknown as Repository<Cancion>,
      {
        findOneBy: async () => ({ id: 'artist' }),
      } as unknown as Repository<Artista>,
      {} as Repository<Genero>,
      {} as Repository<Lanzamiento>,
    );
    Object.defineProperty(service, 'directory', { value: directory });
    try {
      await expect(
        service.upload(
          'user',
          '550e8400-e29b-41d4-a716-446655440000',
          'audio',
          wav(),
        ),
      ).rejects.toThrow('DB unavailable');
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rmdir(directory);
    }
  });
});
