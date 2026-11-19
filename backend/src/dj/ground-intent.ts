import { BadRequestException } from '@nestjs/common';
import type { DjIntent } from './dj.types.js';
import { genreKey, validateIntent } from './intent.js';

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
// Vocabulary, not canned responses. Literal mentions are authoritative hard constraints.
const genres = [
  'rock',
  'pop',
  'jazz',
  'blues',
  'soul',
  'funk',
  'metal',
  'punk',
  'reggae',
  'reggaeton',
  'hip hop',
  'rap',
  'clasica',
  'classical',
  'electronica',
  'electronic',
  'synthwave',
  'techno',
  'house',
  'ambient',
  'folk',
  'folklore',
  'cumbia',
  'salsa',
  'bachata',
  'country',
  'disco',
  'r&b',
  'k-pop',
  'indie',
];
const numberWords = [
  'cero',
  'una',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciseis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
];
export type GroundingResult = { intent: DjIntent; correctedFields: string[] };
export function groundIntent(
  prompt: string,
  candidate: unknown,
): GroundingResult {
  const raw = validateIntent(candidate);
  const text = normalize(prompt);
  const out: DjIntent = {
    genres: null,
    excludedGenres: null,
    removeExcludedGenres: null,
    activity: null,
    mood: null,
    favorites: null,
    count: null,
    action: 'select',
    unsupported: [],
  };
  const vocabulary = [
    ...new Set(
      [
        ...genres,
        ...(raw.genres || []),
        ...(raw.excludedGenres || []),
        ...(raw.removeExcludedGenres || []),
      ].map(normalize),
    ),
  ].filter(
    (g) =>
      genres.includes(g) ||
      (text.includes(g) &&
        g.length <= 40 &&
        !/\b(?:sin|no|para|favoritas|parecidas|calm|relajante|energetico|select|add)\b/.test(
          g,
        )),
  );
  const mentions = vocabulary
    .flatMap((g) => {
      const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return [
        ...text.matchAll(new RegExp('(?<![a-z])' + escaped + '(?![a-z])', 'g')),
      ].map((m) => ({ genre: g, index: m.index!, end: m.index! + g.length }));
    })
    .sort((a, b) => a.index - b.index);
  const included: string[] = [],
    excluded: string[] = [],
    removed: string[] = [];
  let negative = false,
    allow = false,
    last = 0;
  for (const mention of mentions) {
    const prefix = text.slice(last, mention.index);
    if (/[.;]|\b(?:pero|ahora|mant[eé]n)\b/.test(prefix)) {
      negative = false;
      allow = false;
    }
    if (
      /\b(?:permite|permitir|vuelve a incluir|ya no excluyas|deja de excluir)\b/.test(
        prefix,
      )
    ) {
      allow = true;
      negative = false;
    } else if (
      /\b(?:sin|excepto|excluye|excluir|evita|evitar|no quiero|nada de|quita|elimina)\b/.test(
        prefix,
      )
    ) {
      negative = true;
      allow = false;
    } else if (
      /\b(?:con|quiero|incluye|mant[eé]n|cambia a|prefiero)\b/.test(prefix)
    ) {
      negative = false;
      allow = false;
    }
    const canonical =
      genreKey(mention.genre) === 'electronic'
        ? 'Electrónica'
        : mention.genre[0].toUpperCase() + mention.genre.slice(1);
    (allow ? removed : negative ? excluded : included).push(canonical);
    last = mention.end;
  }
  if (included.length) out.genres = [...new Set(included)];
  if (excluded.length) out.excludedGenres = [...new Set(excluded)];
  if (removed.length) out.removeExcludedGenres = [...new Set(removed)];
  if (
    /\b(?:quita|elimina|borra)\b.*\b(?:todas las exclusiones|todos los generos excluidos)\b/.test(
      text,
    )
  )
    out.excludedGenres = [];
  if (
    /\b(?:sin filtro de genero|todos los generos|quita el filtro de genero)\b/.test(
      text,
    )
  )
    out.genres = [];
  if (/\b(?:agrega|agregar|anade|anadir|suma|mas canciones)\b/.test(text))
    out.action = 'add';
  else if (
    /\b(?:cambia|cambiar|sustituye|sustituir|reemplaza)\b.*\b(?:esta cancion|esta pista|la cancion|la pista)\b/.test(
      text,
    )
  )
    out.action = 'replace';
  else if (
    /\b(?:repetidas|duplicadas|duplicados|repetidos)\b/.test(text) &&
    /\b(?:quita|elimina|borra|sin)\b/.test(text)
  )
    out.action = 'deduplicate';
  else if (
    raw.action !== 'select' &&
    /\b(?:incorpora|amplia|extiende)\b/.test(text)
  )
    out.action = raw.action;
  const digit = text.match(/\b(\d{1,3})\s*(?:cancion(?:es)?|pistas?|temas?)\b/);
  const word = text.match(
    new RegExp(
      '\\b(' +
        [...numberWords.slice(1), 'un', 'uno'].join('|') +
        ')\\s+(?:cancion(?:es)?|pistas?|temas?)\\b',
    ),
  );
  if (digit) out.count = Number(digit[1]);
  else if (word)
    out.count = ['un', 'uno'].includes(word[1])
      ? 1
      : numberWords.indexOf(word[1]);
  else if (
    out.action === 'add' &&
    raw.count !== null &&
    (text.includes(String(raw.count)) ||
      text.includes(numberWords[raw.count] || '\u0000'))
  )
    out.count = raw.count;
  if (out.count !== null && (out.count < 1 || out.count > 30))
    throw new BadRequestException('La sesión admite entre 1 y 30 canciones.');
  const activity = text.match(
    /\b(?:estudiar|entrenar|correr|dormir|trabajar|bailar|fiesta|leer|meditar)\b/,
  );
  if (activity) out.activity = activity[0];
  else if (
    raw.activity &&
    /\b(?:para|mientras|durante|al)\s+/.test(text) &&
    text.includes(normalize(raw.activity)) &&
    !mentions.some((m) => normalize(raw.activity!) === m.genre)
  )
    out.activity = raw.activity;
  if (/\b(?:tranquil[oa]|relajante|relajad[oa]|calma|calmad[oa])\b/.test(text))
    out.mood = 'calm';
  if (/\b(?:energetic[oa]|energia|intens[oa]|intensidad)\b/.test(text))
    out.mood = /\b(?:menos|baja|reduce)\b/.test(text) ? 'calm' : 'energetic';
  if (
    /\b(?:quita|elimina|sin)\b.*\b(?:filtro de energia|filtro de intensidad|restriccion de energia)\b/.test(
      text,
    )
  )
    out.mood = 'none';
  if (
    out.mood &&
    out.mood !== 'none' &&
    /\b(?:mas|menos|sube|baja|reduce|aumenta)\b/.test(text)
  )
    out.intensityChange = out.mood === 'calm' ? 'lower' : 'higher';
  if (/\bfavoritas?\b/.test(text))
    out.favorites = !/\b(?:ignora|sin|no uses|deja de usar)\b.*favorit/.test(
      text,
    );
  // Preserve model interpretations beyond the vocabulary only with literal grounding.
  out.unsupported = raw.unsupported.filter((s) => text.includes(normalize(s)));
  if (
    /\b(?:instrumental|sin letras explicitas|en ingles|en frances|sin anuncios)\b/.test(
      text,
    )
  )
    out.unsupported.push(
      'El catálogo no verifica idioma, contenido explícito o instrumentación.',
    );
  if (
    !mentions.length &&
    !activity &&
    !out.mood &&
    out.favorites === null &&
    out.count === null &&
    out.action === 'select' &&
    !/\b(?:musica|cancion(?:es)?|sesion|algo|temas?)\b/.test(text)
  )
    throw new BadRequestException(
      'La interpretación no está respaldada por la petición. Reformula con géneros o una acción musical.',
    );
  const intent = validateIntent(out);
  return {
    intent,
    correctedFields: [
      ...new Set([...Object.keys(raw), ...Object.keys(intent)]),
    ].filter(
      (k) =>
        JSON.stringify(raw[k as keyof DjIntent]) !==
        JSON.stringify(intent[k as keyof DjIntent]),
    ),
  };
}
