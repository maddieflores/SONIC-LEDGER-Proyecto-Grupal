import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/auth.controller.js';
import {
  AddTrackDto,
  CheckFavoritesDto,
  CreatePlaylistDto,
  FavoriteDto,
  ReorderTracksDto,
  UpdatePlaylistDto,
} from './library.dto.js';
import { LibraryService } from './library.service.js';

type OwnRequest = { user: { id: string } };

@Controller('auth/library')
@UseGuards(JwtGuard)
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  // ==========================================
  // PLAYLISTS (CU09)
  // ==========================================

  @Get('playlists')
  listPlaylists(@Req() req: OwnRequest) {
    return this.library.listPlaylists(req.user.id);
  }

  @Post('playlists')
  createPlaylist(@Req() req: OwnRequest, @Body() dto: CreatePlaylistDto) {
    return this.library.createPlaylist(req.user.id, dto);
  }

  @Get('playlists/:id')
  getPlaylist(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.library.getPlaylist(req.user.id, id);
  }

  @Patch('playlists/:id')
  updatePlaylist(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.library.updatePlaylist(req.user.id, id, dto);
  }

  @Delete('playlists/:id')
  deletePlaylist(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.library.deletePlaylist(req.user.id, id);
  }

  @Post('playlists/:id/tracks')
  addTrack(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AddTrackDto,
  ) {
    return this.library.addTrackToPlaylist(req.user.id, id, dto);
  }

  @Delete('playlists/:id/tracks/:trackId')
  removeTrack(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('trackId') trackId: string,
  ) {
    return this.library.removeTrackFromPlaylist(req.user.id, id, trackId);
  }

  @Put('playlists/:id/tracks')
  reorderTracks(
    @Req() req: OwnRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReorderTracksDto,
  ) {
    return this.library.reorderPlaylistTracks(req.user.id, id, dto.trackIds);
  }

  // ==========================================
  // FAVORITOS (CU10)
  // ==========================================

  @Get('favorites')
  listFavorites(@Req() req: OwnRequest) {
    return this.library.listFavorites(req.user.id);
  }

  @Get('favorites/ids')
  getFavoriteIds(@Req() req: OwnRequest) {
    return this.library.getFavoriteIds(req.user.id);
  }

  @Post('favorites')
  addFavorite(@Req() req: OwnRequest, @Body() dto: FavoriteDto) {
    return this.library.addFavorite(req.user.id, dto);
  }

  @Delete('favorites/:trackId')
  removeFavorite(
    @Req() req: OwnRequest,
    @Param('trackId') trackId: string,
  ) {
    return this.library.removeFavorite(req.user.id, trackId);
  }

  @Post('favorites/check')
  @HttpCode(200)
  checkFavorites(@Req() req: OwnRequest, @Body() dto: CheckFavoritesDto) {
    return this.library.checkFavorites(req.user.id, dto.trackIds);
  }
}
