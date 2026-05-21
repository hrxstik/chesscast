import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service';
import {
  multerImageLimits,
  multerImageMemory,
} from '../upload/multer-memory';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly uploadService: UploadService,
  ) {}

  /** Должен быть выше :id, иначе "me" парсится как число. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request & { user: { id: number } }): Promise<Omit<User, 'password'>> {
    const u = await this.userService.findById(req.user.id);
    const { password: _p, ...safe } = u;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/dashboard-summary')
  async getMeDashboardSummary(@Req() req: Request & { user: { id: number } }) {
    return this.userService.getDashboardSummary(req.user.id);
  }

  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getPublicProfileById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteUserById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ): Promise<User> {
    if (req.user.id !== id) {
      throw new ForbiddenException('Можно удалить только свой профиль');
    }
    return this.userService.deleteById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/change-password')
  async changeMyPassword(
    @Req() req: Request & { user: { id: number } },
    @Body('currentPassword') currentPassword: string,
    @Body('newPassword') newPassword: string,
  ) {
    return this.userService.changePassword(req.user.id, currentPassword, newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('me/delete')
  async deleteMyAccount(
    @Req() req: Request & { user: { id: number } },
    @Body('password') password: string,
  ) {
    return this.userService.deleteByIdWithPassword(req.user.id, password);
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multerImageMemory,
      limits: multerImageLimits,
    }),
  )
  @Post('me/avatar')
  async uploadMyAvatar(
    @Req() req: Request & { user: { id: number } },
    @UploadedFile() image?: Express.Multer.File,
  ) {
    if (!image) {
      return { success: false, message: 'Файл не передан' };
    }
    const avatar = await this.uploadService.saveFile(image, 'users-avatars');
    const updated = await this.userService.updateById(req.user.id, { avatar });
    const { password: _p, ...safe } = updated;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<User>,
    @Req() req: Request & { user: { id: number } },
  ): Promise<User> {
    if (req.user.id !== id) {
      throw new ForbiddenException('Можно изменять только свой профиль');
    }
    return this.userService.updateById(id, updateData);
  }
}
