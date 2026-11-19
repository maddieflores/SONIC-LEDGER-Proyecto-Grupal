import { BadGatewayException } from '@nestjs/common';
export function assertAudiusDestination(value: string) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.port || u.username || u.password ||
      !(u.hostname === 'api.audius.co' || u.hostname.endsWith('.audius.co') || u.hostname === 'validator.eeba4a6ca56a0d87af802270217c2a51.r2.cloudflarestorage.com')) {
    throw new BadGatewayException('Destino Audius no autorizado');
  }
  return u;
}
