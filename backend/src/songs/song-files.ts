import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { validateArtistImage } from '../artist/artist-media.service.js';
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export type UploadedSongFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};
export function validateWav(file: UploadedSongFile): number {
  const b = file.buffer;
  const invalid = () =>
    new BadRequestException(
      'Audio no compatible. Selecciona un WAV PCM sin compresión válido (8/16/24/32 bits, 1–2 canales, 8–192 kHz, máximo 50 MB). MP3 y FLAC todavía no están habilitados.',
    );
  if (
    extname(file.originalname).toLowerCase() !== '.wav' ||
    !['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'].includes(
      file.mimetype,
    ) ||
    b.length < 44 ||
    b.length > MAX_AUDIO_BYTES ||
    b.toString('ascii', 0, 4) !== 'RIFF' ||
    b.toString('ascii', 8, 12) !== 'WAVE' ||
    b.readUInt32LE(4) !== b.length - 8
  )
    throw invalid();
  let offset = 12,
    rate = 0,
    align = 0,
    data = 0,
    hasFormat = false;
  while (offset + 8 <= b.length) {
    const tag = b.toString('ascii', offset, offset + 4),
      size = b.readUInt32LE(offset + 4),
      start = offset + 8;
    if (size > b.length - start) throw invalid();
    if (tag === 'fmt ') {
      if (hasFormat || size < 16) throw invalid();
      hasFormat = true;
      const encoding = b.readUInt16LE(start),
        channels = b.readUInt16LE(start + 2),
        sampleRate = b.readUInt32LE(start + 4),
        byteRate = b.readUInt32LE(start + 8),
        block = b.readUInt16LE(start + 12),
        bits = b.readUInt16LE(start + 14);
      if (
        encoding !== 1 ||
        ![1, 2].includes(channels) ||
        sampleRate < 8000 ||
        sampleRate > 192000 ||
        ![8, 16, 24, 32].includes(bits) ||
        block !== (channels * bits) / 8 ||
        byteRate !== sampleRate * block
      )
        throw invalid();
      rate = byteRate;
      align = block;
    }
    if (tag === 'data') {
      if (!hasFormat || !size || size % align) throw invalid();
      data += size;
    }
    offset = start + size + (size % 2);
  }
  if (offset !== b.length || !rate || !data) throw invalid();
  const duration = data / rate;
  if (duration < 0.1 || duration > 21600) throw invalid();
  return Math.max(1, Math.round(duration));
}
export function validateSongCover(file: UploadedSongFile): 'png' | 'jpg' {
  const extension = extname(file.originalname).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(extension))
    throw new BadRequestException('La portada debe ser PNG o JPG.');
  const format = validateArtistImage(file.buffer, file.mimetype);
  if (
    (format === 'png' && extension !== '.png') ||
    (format === 'jpg' && !['.jpg', '.jpeg'].includes(extension))
  )
    throw new BadRequestException(
      'La extensión no coincide con el tipo de portada.',
    );
  const b = file.buffer;
  let width = 0,
    height = 0;
  if (format === 'png') {
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
  } else {
    let offset = 2;
    while (offset + 4 < b.length) {
      if (b[offset++] !== 255) break;
      while (b[offset] === 255) offset++;
      const marker = b[offset++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const size = b.readUInt16BE(offset);
      if (size < 2 || offset + size > b.length) break;
      if ([192, 193, 194].includes(marker)) {
        height = b.readUInt16BE(offset + 3);
        width = b.readUInt16BE(offset + 5);
        break;
      }
      offset += size;
    }
  }
  if (width !== height || width < 1200)
    throw new BadRequestException(
      'La portada debe ser cuadrada, mínimo 1200 × 1200 px, máximo 4096 px y 8 megapíxeles (2 MB).',
    );
  return format;
}
