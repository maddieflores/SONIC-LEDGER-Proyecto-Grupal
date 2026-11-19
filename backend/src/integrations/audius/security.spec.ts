import { describe, it, expect, vi } from 'vitest';
import { assertAudiusDestination } from './destination.js';
import { AudiusService } from './audius.service.js';
import type { AudiusClient } from './audius.client.js';
describe('Audius integration security', () => {
  it('only permits HTTPS official destinations, rejecting deceptive hosts and credentials', () => {
    expect(assertAudiusDestination('https://creatornode.audius.co/tracks/x').hostname).toBe('creatornode.audius.co');
    for (const url of ['http://creatornode.audius.co/x','https://audius.co.evil.test/x','https://127.0.0.1/x','https://x@creatornode.audius.co/x','https://creatornode.audius.co:8443/x']) expect(() => assertAudiusDestination(url)).toThrow();
  });
  it.each([{is_stream_gated:true},{access:{stream:false}},{is_streamable:false},{is_available:false},{is_delete:true}])('denies restricted streaming %j', async restriction => {
    const client = {getTrackById:vi.fn().mockResolvedValue({id:'abc',...restriction}),resolveTrackStreamUrl:vi.fn()};
    const service = new AudiusService(client as unknown as AudiusClient);
    await expect(service.resolveStream('abc')).rejects.toThrow();
    expect(client.resolveTrackStreamUrl).not.toHaveBeenCalled();
  });
});
