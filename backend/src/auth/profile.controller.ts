import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from './auth.controller.js';
import { ProfileService } from './profile.service.js';
import { UpdateProfileDto } from './profile.dto.js';
@Controller('auth/profile')
@UseGuards(JwtGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}
  @Get() get(@Req() req: { user: { id: string } }) {
    return this.profiles.get(req.user.id);
  }
  @Get('genres') genres() {
    return this.profiles.genresList();
  }
  @Post() update(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.update(req.user.id, dto);
  }
}
