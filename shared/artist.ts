export type ArtistLinks = Partial<
  Record<"instagram" | "tiktok" | "youtube" | "spotify" | "website", string>
>;
export type ArtistUpdate = {
  nombreArtistico: string;
  biografia: string;
  ciudad: string;
  pais: string;
  genreIds: string[];
  identidad: string[];
  redes: ArtistLinks;
};
export type ArtistProfile = ArtistUpdate & {
  id: string;
  avatarUrl: string | null;
  coverUrl: string | null;
};
export type ArtistResponse = {
  profile: ArtistProfile | null;
  username: string;
  statistics: null;
  mediaUploadAvailable: boolean;
};
export const artistIdentities = [
  "Enérgico",
  "Nocturno",
  "Experimental",
  "Emotivo",
  "Acústico",
  "Urbano",
  "Alternativo",
  "Bailable",
];
export const socialFields = [
  ["instagram", "Instagram", "https://www.instagram.com/tuusuario"],
  ["tiktok", "TikTok", "https://www.tiktok.com/@tuusuario"],
  ["youtube", "YouTube", "https://www.youtube.com/@tucanal"],
  ["spotify", "Spotify", "https://open.spotify.com/artist/..."],
  ["website", "Sitio web", "https://tusitio.com"],
] as const;
export const emptyArtist = (): ArtistUpdate => ({
  nombreArtistico: "",
  biografia: "",
  ciudad: "",
  pais: "",
  genreIds: [],
  identidad: [],
  redes: {},
});
export function artistUpdate(p: ArtistUpdate): ArtistUpdate {
  return {
    nombreArtistico: p.nombreArtistico,
    biografia: p.biografia,
    ciudad: p.ciudad,
    pais: p.pais,
    genreIds: p.genreIds,
    identidad: p.identidad,
    redes: Object.fromEntries(
      Object.entries(p.redes)
        .map(([k, v]) => [k, v?.trim()])
        .filter(([, v]) => v),
    ),
  };
}
export const skyline = [
  34, 54, 39, 73, 48, 91, 56, 79, 46, 66, 99, 63, 84, 51, 70, 44, 89, 61, 77,
  46, 60, 94, 54, 71, 43, 66, 37, 58,
];
