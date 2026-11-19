import {
  AudiusTrack,
  AudiusUser,
  NormalizedArtist,
  NormalizedTrack,
  StreamResolution,
} from './audius.types.js';

export class AudiusMapper {
  private static readonly ID_PREFIX = 'audius:';
  private static readonly BASE_AUDIUS_WEB = 'https://audius.co';

  /**
   * Prefija un identificador externo para que no colisione con el catálogo local.
   */
  static toInternalId(externalId: string): string {
    if (!externalId) return '';
    return externalId.startsWith(this.ID_PREFIX)
      ? externalId
      : `${this.ID_PREFIX}${externalId}`;
  }

  /**
   * Extrae el ID original de Audius a partir de un ID interno o externo.
   */
  static extractExternalId(id: string): string {
    if (!id) return '';
    return id.startsWith(this.ID_PREFIX) ? id.slice(this.ID_PREFIX.length) : id;
  }

  /**
   * Determina si un ID pertenece a la fuente externa de Audius.
   */
  static isAudiusId(id: string): boolean {
    return typeof id === 'string' && id.startsWith(this.ID_PREFIX);
  }

  /**
   * Mapea un usuario/artista de Audius a un artista normalizado de Sonic Ledger.
   */
  static toNormalizedArtist(user: AudiusUser): NormalizedArtist {
    const externalId = String(user.id || user.user_id || '');
    const profilePic =
      user.profile_picture?.['480x480'] ||
      user.profile_picture?.['150x150'] ||
      user.profile_picture?.['1000x1000'] ||
      null;
    const coverPhoto =
      user.cover_photo?.['2000x'] ||
      user.cover_photo?.['640x'] ||
      null;

    const handle = user.handle || 'unknown';
    const externalUrl = `${this.BASE_AUDIUS_WEB}/${encodeURIComponent(handle)}`;

    return {
      id: this.toInternalId(externalId),
      source: 'AUDIUS',
      externalId,
      name: user.name || handle,
      handle,
      bio: user.bio || null,
      profilePictureUrl: profilePic,
      coverPhotoUrl: coverPhoto,
      followerCount: Number(user.follower_count || 0),
      isVerified: Boolean(user.is_verified),
      externalUrl,
    };
  }

  /**
   * Mapea una pista de Audius a una pista normalizada de Sonic Ledger.
   */
  static toNormalizedTrack(track: AudiusTrack): NormalizedTrack {
    const externalId = String(track.id || track.track_id || '');
    const artwork =
      track.artwork?.['480x480'] ||
      track.artwork?.['1000x1000'] ||
      track.artwork?.['150x150'] ||
      null;

    const user = track.user;
    const artistExternalId = String(user?.id || track.user_id || '');
    const artistHandle = user?.handle || 'unknown';
    const artistName = user?.name || artistHandle;
    const artistProfilePic =
      user?.profile_picture?.['480x480'] ||
      user?.profile_picture?.['150x150'] ||
      null;

    // Determinación estricta de reproducibilidad según derechos y gating de Audius
    const isStreamable = track.is_streamable !== false;
    const isStreamGated = Boolean(track.is_stream_gated);
    const isAvailable = track.is_available !== false && !track.is_delete;
    const hasAccess = track.access?.stream !== false;
    const isPlayable = isStreamable && !isStreamGated && isAvailable && hasAccess;

    // Enlace público en audius.co para atribución
    const externalUrl = track.permalink
      ? `${this.BASE_AUDIUS_WEB}${track.permalink}`
      : `${this.BASE_AUDIUS_WEB}/${encodeURIComponent(artistHandle)}/${encodeURIComponent(track.title || externalId)}`;

    return {
      id: this.toInternalId(externalId),
      source: 'AUDIUS',
      externalId,
      title: (track.title || 'Pista sin título').trim(),
      artist: {
        id: this.toInternalId(artistExternalId),
        externalId: artistExternalId,
        name: artistName,
        handle: artistHandle,
        profilePictureUrl: artistProfilePic,
      },
      artworkUrl: artwork,
      durationSeconds: typeof track.duration === 'number' ? Math.round(track.duration) : null,
      genre: track.genre || null,
      mood: track.mood || null,
      releaseDate: track.release_date || track.created_at || null,
      playCount: Number(track.play_count || 0),
      isPlayable,
      isStreamGated,
      externalUrl,
      streamUrl: null,
    };
  }

  /**
   * Genera el objeto de resolución de streaming seguro y con atribución.
   */
  static toStreamResolution(
    track: AudiusTrack,
    resolvedStreamUrl?: string,
  ): StreamResolution {
    const normalized = this.toNormalizedTrack(track);
    const streamUrl = normalized.isPlayable
      ? resolvedStreamUrl || track.stream?.url || null
      : null;

    return {
      trackId: normalized.id,
      externalId: normalized.externalId,
      source: 'AUDIUS',
      isPlayable: normalized.isPlayable,
      streamUrl,
      mirrors: track.stream?.mirrors || track.artwork?.mirrors || [],
      attribution: {
        artistName: normalized.artist.name,
        artistHandle: normalized.artist.handle,
        trackTitle: normalized.title,
        sourceName: 'Audius',
        platformUrl: normalized.externalUrl,
      },
    };
  }
}
