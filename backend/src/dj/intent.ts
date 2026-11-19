import { BadRequestException } from '@nestjs/common';
import type { DjIntent, DjConstraints } from './dj.types.js';
export const intentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    genres: {
      anyOf: [
        {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', maxLength: 80 },
        },
        { type: 'null' },
      ],
    },
    excludedGenres: {
      anyOf: [
        {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', maxLength: 80 },
        },
        { type: 'null' },
      ],
    },
    removeExcludedGenres: {
      anyOf: [
        {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', maxLength: 80 },
        },
        { type: 'null' },
      ],
    },
    activity: { type: ['string', 'null'], maxLength: 100 },
    mood: { enum: ['calm', 'energetic', 'none', null] },
    intensityChange: { enum: ['lower', 'higher', null] },
    favorites: { type: ['boolean', 'null'] },
    count: { type: ['integer', 'null'], minimum: 1, maximum: 30 },
    action: { enum: ['select', 'add', 'replace', 'deduplicate'] },
    unsupported: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', maxLength: 150 },
    },
  },
  required: [
    'genres',
    'excludedGenres',
    'removeExcludedGenres',
    'activity',
    'mood',
    'favorites',
    'count',
    'action',
    'unsupported',
  ],
};
export function validateIntent(value: unknown): DjIntent {
  const fail = () => {
    throw new BadRequestException(
      'Interpretación del DJ inválida; intenta reformular la petición.',
    );
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  const o = value as Record<string, unknown>;
  if (
    Object.keys(o).some((k) => !Object.hasOwn(intentSchema.properties, k)) ||
    intentSchema.required.some((k) => !(k in o))
  )
    return fail();
  for (const k of [
    'genres',
    'excludedGenres',
    'removeExcludedGenres',
    'unsupported',
  ]) {
    const a = o[k];
    if (a === null && k !== 'unsupported') continue;
    if (
      !Array.isArray(a) ||
      a.length > 20 ||
      a.some(
        (s) =>
          typeof s !== 'string' ||
          !s.trim() ||
          s.length > (k === 'unsupported' ? 150 : 80),
      )
    )
      return fail();
  }
  if (
    o.activity !== null &&
    (typeof o.activity !== 'string' || o.activity.length > 100)
  )
    return fail();
  if (![null, 'calm', 'energetic', 'none'].includes(o.mood as string | null))
    return fail();
  if (
    'intensityChange' in o &&
    ![null, 'lower', 'higher'].includes(o.intensityChange as string | null)
  )
    return fail();
  if (o.favorites !== null && typeof o.favorites !== 'boolean') return fail();
  if (
    o.count !== null &&
    (!Number.isInteger(o.count) || Number(o.count) < 1 || Number(o.count) > 30)
  )
    return fail();
  if (!['select', 'add', 'replace', 'deduplicate'].includes(String(o.action)))
    return fail();
  return o as DjIntent;
}
export function mergeConstraints(
  previous: DjConstraints,
  intent: DjIntent,
): DjConstraints {
  const next = { ...previous };
  for (const key of [
    'genres',
    'excludedGenres',
    'activity',
    'mood',
    'favorites',
    'count',
  ] as const) {
    if (intent[key] !== null) Object.assign(next, { [key]: intent[key] });
  }
  if (intent.excludedGenres?.length)
    next.excludedGenres = [
      ...new Set([
        ...(previous.excludedGenres || []),
        ...intent.excludedGenres,
      ]),
    ];
  if (intent.removeExcludedGenres?.length)
    next.excludedGenres = (next.excludedGenres || []).filter(
      (g) =>
        !intent.removeExcludedGenres!.some((r) => genreKey(r) === genreKey(g)),
    );
  return next;
}
export function genreKey(s: string) {
  const key = s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
  return [
    'electronica',
    'electronic',
    'electronics',
    'electronico',
    'electronicos',
  ].includes(key)
    ? 'electronic'
    : key;
}
