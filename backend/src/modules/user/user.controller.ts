import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from '@prisma/client';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import type { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** Должен быть выше :id, иначе "me" парсится как число. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: Request & { user: { id: number } }): Promise<Omit<User, 'password'>> {
    const u = await this.userService.findById(req.user.id);
    const { password: _p, ...safe } = u;
    return safe;
  }

  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteUserById(@Param('id', ParseIntPipe) id: number): Promise<User> {
    return this.userService.deleteById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<User>,
    @Req() req: Request,
  ): Promise<User> {
    return this.userService.updateById(id, updateData);
  }
}
