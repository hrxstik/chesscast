import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
import { PlatformRole } from '@prisma/client';
import { AdminManagementService } from './admin-management.service';
import { SetBlockedDto } from 'src/dtos/admin/set-blocked.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminManagementController {
  constructor(private readonly admin: AdminManagementService) {}

  @Get('users')
  async users(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    return this.admin.listUsers(limitNum, Number.isNaN(cursorId) ? undefined : cursorId, q);
  }

  @Patch('users/:id/block')
  async blockUser(@Param('id', ParseIntPipe) id: number, @Body() body: SetBlockedDto) {
    return this.admin.setUserBlocked(id, body.blocked, body.reason);
  }

  @Patch('users/:id/role')
  async setUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('platformRole') platformRole: PlatformRole,
  ) {
    return this.admin.setUserPlatformRole(id, platformRole);
  }

  @Get('organizations')
  async organizations(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    return this.admin.listOrganizations(limitNum, Number.isNaN(cursorId) ? undefined : cursorId, q);
  }

  @Patch('organizations/:id/block')
  async blockOrganization(@Param('id', ParseIntPipe) id: number, @Body() body: SetBlockedDto) {
    return this.admin.setOrganizationBlocked(id, body.blocked, body.reason);
  }
}
