import 'reflect-metadata';
import { DjSessionEntity } from './dj/dj-session.entity.js';
import { DjSessions1794494000000 } from './migrations/1794494000000-DjSessions.js';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Usuario } from './auth/usuario.entity.js';
import { Rol } from './auth/rol.entity.js';
import { Artista } from './musica/artista.entity.js';
import { Genero } from './musica/genero.entity.js';
import { Lanzamiento } from './musica/lanzamiento.entity.js';
import { Cancion } from './musica/cancion.entity.js';
import { Playlist } from './library/playlist.entity.js';
import { PlaylistTrack } from './library/playlist-track.entity.js';
import { FavoriteTrack } from './library/favorite-track.entity.js';
import { ListeningHistory } from './history/listening-history.entity.js';
import { Concierto } from './conciertos/concierto.entity.js';
import { ConciertoArtista } from './conciertos/concierto-artista.entity.js';
import { ConciertoCategoria } from './conciertos/concierto-categoria.entity.js';
import { OrdenCompra } from './ticketing/orden-compra.entity.js';
import { OrdenItem } from './ticketing/orden-item.entity.js';
import { ReservaCupo } from './ticketing/reserva-cupo.entity.js';
import { Ticket } from './ticketing/ticket.entity.js';
import { ConciertoVerificador } from './ticketing/concierto-verificador.entity.js';
import { TicketValidacion } from './ticketing/ticket-validacion.entity.js';
import { Reembolso } from './ticketing/reembolso.entity.js';
import { CreateUsuarios1794480000000 } from './migrations/1794480000000-CreateUsuarios.js';
import { PasswordRecovery1794481000000 } from './migrations/1794481000000-PasswordRecovery.js';
import { RolesYCatalogoMusical1794482000000 } from './migrations/1794482000000-RolesYCatalogoMusical.js';

import { PerfilPreferencias1794483000000 } from './migrations/1794483000000-PerfilPreferencias.js';

import { GenerosPerfil1794484000000 } from './migrations/1794484000000-GenerosPerfil.js';

import { PerfilArtistico1794485000000 } from './migrations/1794485000000-PerfilArtistico.js';

import { PublicarCanciones1794486000000 } from './migrations/1794486000000-PublicarCanciones.js';
import { OrganizarLanzamientos1794487000000 } from './migrations/1794487000000-OrganizarLanzamientos.js';
import { PlaylistsYFavoritos1794488000000 } from './migrations/1794488000000-PlaylistsYFavoritos.js';
import { ListeningHistory1794489000000 } from './migrations/1794489000000-ListeningHistory.js';
import { ConciertosEntradas1794490000000 } from './migrations/1794490000000-ConciertosEntradas.js';
import { TicketingYValidaciones1794491000000 } from './migrations/1794491000000-TicketingYValidaciones.js';
import { CancelacionConciertosYReembolsos1794492000000 } from './migrations/1794492000000-CancelacionConciertosYReembolsos.js';
import { ReembolsosYSandbox1794493000000 } from './migrations/1794493000000-ReembolsosYSandbox.js';

await ConfigModule.forRoot();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    DjSessionEntity,
    Usuario,
    Rol,
    Artista,
    Genero,
    Lanzamiento,
    Cancion,
    Playlist,
    PlaylistTrack,
    FavoriteTrack,
    ListeningHistory,
    Concierto,
    ConciertoArtista,
    ConciertoCategoria,
    OrdenCompra,
    OrdenItem,
    ReservaCupo,
    Ticket,
    ConciertoVerificador,
    TicketValidacion,
    Reembolso,
  ],
  migrations: [
    DjSessions1794494000000,
    ReembolsosYSandbox1794493000000,
    CancelacionConciertosYReembolsos1794492000000,
    TicketingYValidaciones1794491000000,
    ConciertosEntradas1794490000000,
    ListeningHistory1794489000000,
    PlaylistsYFavoritos1794488000000,
    OrganizarLanzamientos1794487000000,
    PublicarCanciones1794486000000,
    PerfilArtistico1794485000000,
    PerfilPreferencias1794483000000,
    GenerosPerfil1794484000000,
    CreateUsuarios1794480000000,
    PasswordRecovery1794481000000,
    RolesYCatalogoMusical1794482000000,
  ],
  synchronize: false,
});
