import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { UpdateOrganizationInfoDto } from 'src/dtos/update/update-organization-info.dto';
import { UploadService } from '../upload/upload.service';
import { CreateOrganizationDto } from 'src/dtos/create/create-organization.dto';
import { Request } from 'express';

@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly uploadService: UploadService,
  ) {}

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchOrganizations(
    @Req() req: Request & { user: { id: number } },
    @Query('q') q?: string,
    @Query('id') id?: string,
  ) {
    const organizationId = id ? parseInt(id, 10) : undefined;
    return this.organizationService.searchOrganizations(
      req.user.id,
      q,
      organizationId != null && !Number.isNaN(organizationId) ? organizationId : undefined,
    );
  }

  @Get(':id')
  async getOrganizationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Organization> {
    return this.organizationService.findById(id);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  async getOrganizationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    await this.organizationService.assertUserHasAccess(req.user.id, id);
    const isActive = await this.organizationService.isOrganizationActive(id);
    return { organizationId: id, isActive };
  }

  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @Patch(':id')
  async updateOrganizationById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrganizaitonDto: Partial<UpdateOrganizationInfoDto>,
    @Req() req: Request & { user: { id: number } },
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<Organization> {
    await this.organizationService.assertUserIsAdmin(req.user.id, id);
    await this.organizationService.assertOrganizationActiveForActions(id);
    if (image) {
      await this.uploadService.saveFile(image, 'organizations-avatars');
    }
    return this.organizationService.updateById(id, updateOrganizaitonDto);
  }

  @Post('create')
  @UseGuards(JwtAuthGuard)
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.organizationService.create(dto, req.user.id);
  }

  @Get('me/list')
  @UseGuards(JwtAuthGuard)
  async listMyOrganizations(@Req() req: Request & { user: { id: number } }) {
    return this.organizationService.listMyOrganizations(req.user.id);
  }

  @Post('join-by-code')
  @UseGuards(JwtAuthGuard)
  async joinByCode(
    @Body('inviteCode') inviteCode: string,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.organizationService.joinByInviteCode(req.user.id, inviteCode);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async getMembers(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.organizationService.getMembers(id, req.user.id);
  }

  @Get(':id/games')
  @UseGuards(JwtAuthGuard)
  async getGames(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
    @Query('status') status?: string,
    @Query('mode') mode?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.organizationService.getGames(id, req.user.id, { status, mode, from, to });
  }

  @Get(':id/logs')
  @UseGuards(JwtAuthGuard)
  async getLogs(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const rows = await this.organizationService.getLogs(id, req.user.id, { type, from, to });
    const lim = limit ? Number(limit) : 100;
    return rows.slice(0, Number.isFinite(lim) ? lim : 100);
  }

  @Post(':id/members/:userId/remove')
  @UseGuards(JwtAuthGuard)
  async removeMember(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.organizationService.removeMember(id, userId, req.user.id);
  }

  @Post(':id/recreate-invite-code')
  @UseGuards(JwtAuthGuard)
  async recreateInviteCode(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    await this.organizationService.assertUserIsAdmin(req.user.id, id);
    await this.organizationService.assertOrganizationActiveForActions(id);
    return this.organizationService.recreateInviteCode(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    await this.organizationService.assertUserIsAdmin(req.user.id, id);
    return this.organizationService.deleteById(id);
  }
}
