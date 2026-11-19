export type Genre = { id: string; nombre: string };
export type ProfileUpdate = {
  displayName: string;
  biography: string;
  genreIds: string[];
  moods: string[];
  intensity: number;
  discovery: number;
  energy: number;
};
export type Profile = ProfileUpdate & {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  avatarUploadAvailable: boolean;
  favoriteArtistsAvailable: boolean;
};
export const moods = ["Entrenar", "Relajarme", "Fiesta", "Concentración"];
export const adjustments = [
  ["intensity", "Intensidad de recomendaciones"],
  ["discovery", "Descubrimiento de nueva música"],
  ["energy", "Nivel de energía"],
] as const;
export function profileUpdate(p: Profile): ProfileUpdate {
  return {
    displayName: p.displayName,
    biography: p.biography,
    genreIds: p.genreIds,
    moods: p.moods,
    intensity: p.intensity,
    discovery: p.discovery,
    energy: p.energy,
  };
}
export function toggle(items: string[], value: string) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}
