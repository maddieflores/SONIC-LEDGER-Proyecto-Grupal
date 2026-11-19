import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { ArtistService } from './artist.service.js';
const prefix = '/api/auth/artist-profile/media/';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const dimensions = (w: number, h: number) =>
  w > 0 && h > 0 && w <= 4096 && h <= 4096 && w * h <= 8000000;
function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function validateArtistImage(
  buffer: Buffer,
  mime: string,
): 'png' | 'jpg' {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
    throw new BadRequestException('La imagen debe ocupar entre 1 byte y 2 MB.');
  if (
    mime === 'image/png' &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    let offset = 8,
      header = false,
      end = false;
    const data: Buffer[] = [];
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      if (length > buffer.length - offset - 12) break;
      const type = buffer.toString('ascii', offset + 4, offset + 8),
        chunk = buffer.subarray(offset + 8, offset + 8 + length);
      if (
        crc32(buffer.subarray(offset + 4, offset + 8 + length)) !==
        buffer.readUInt32BE(offset + 8 + length)
      )
        break;
      if (!header) {
        if (
          type !== 'IHDR' ||
          length !== 13 ||
          !dimensions(chunk.readUInt32BE(0), chunk.readUInt32BE(4))
        )
          break;
        header = true;
      } else if (type === 'IHDR') break;
      if (type === 'acTL')
        throw new BadRequestException('Selecciona una imagen estática.');
      if (type === 'IDAT') data.push(chunk);
      offset += length + 12;
      if (type === 'IEND') {
        end = length === 0 && offset === buffer.length;
        break;
      }
    }
    if (header && end && data.length) {
      try {
        const decoded = inflateSync(Buffer.concat(data), {
          maxOutputLength: 64 * 1024 * 1024,
        });
        if (decoded.length) return 'png';
      } catch {
        /* invalid compression */
      }
    }
  }
  if (
    mime === 'image/jpeg' &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[buffer.length - 2] === 255 &&
    buffer[buffer.length - 1] === 217
  ) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset++] !== 255) break;
      while (buffer[offset] === 255) offset++;
      const marker = buffer[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > buffer.length) break;
      const length = buffer.readUInt16BE(offset);
      if (length < 2 || offset + length > buffer.length) break;
      if (
        [192, 193, 194].includes(marker) &&
        length >= 8 &&
        dimensions(
          buffer.readUInt16BE(offset + 5),
          buffer.readUInt16BE(offset + 3),
        )
      )
        return 'jpg';
      offset += length;
    }
  }
  throw new BadRequestException(
    'Selecciona un PNG o JPEG válido, estático, de hasta 4096 px y 8 megapíxeles.',
  );
}
@Injectable()
export class ArtistMediaService {
  private readonly directory = resolve(process.cwd(), 'uploads', 'artists');
  constructor(private readonly artists: ArtistService) {}
  async upload(
    userId: string,
    kind: 'avatar' | 'cover',
    file?: { buffer: Buffer; mimetype: string },
  ) {
    if (process.env.NODE_ENV === 'production')
      throw new ForbiddenException(
        'El almacenamiento local solo está habilitado en desarrollo.',
      );
    if (!(await this.artists.own(userId)))
      throw new NotFoundException('Guarda primero tu perfil artístico.');
    if (!file)
      throw new BadRequestException('Adjunta una imagen en el campo file.');
    const extension = validateArtistImage(file.buffer, file.mimetype);
    const name = randomUUID() + '.' + extension;
    await mkdir(this.directory, { recursive: true });
    const path = join(this.directory, name);
    await writeFile(path, file.buffer, { flag: 'wx', mode: 0o600 });
    try {
      await this.artists.setMedia(userId, kind, prefix + name);
    } catch (e) {
      await unlink(path);
      throw e;
    }
    return { reference: prefix + name };
  }
  async read(userId: string, name: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(png|jpg)$/.test(
        name,
      )
    )
      throw new NotFoundException();
    const artist = await this.artists.own(userId);
    if (!artist || ![artist.avatarUrl, artist.coverUrl].includes(prefix + name))
      throw new NotFoundException();
    try {
      return {
        buffer: await readFile(join(this.directory, name)),
        mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      };
    } catch {
      throw new NotFoundException('La imagen no está disponible.');
    }
  }
}
