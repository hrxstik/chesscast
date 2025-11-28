import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

@Controller('organization')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly uploadService: UploadService,
  ) {}

  @Get(':id')
  async getOrganizationById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Organization> {
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  @Patch(':id')
  async updateOrganizationById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrganizaitonDto: Partial<UpdateOrganizationInfoDto>,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<Organization> {
    if (image) {
      await this.uploadService.saveFile(image, 'organizations-avatars');
    }
    return this.organizationService.updateById(id, updateOrganizaitonDto);
  }

  @Post('create')
  async createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Post(':id/recreate-invite-code')
  @UseGuards(JwtAuthGuard)
  async recreateInviteCode(@Param('id', ParseIntPipe) id: number) {
    return this.organizationService.recreateInviteCode(id);
  }
}
