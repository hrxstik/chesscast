import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { SuperAdminGuard } from 'src/guards/super-admin.guard';
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
    @Query('blocked') blocked?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    const blockedFilter =
      blocked === 'true' ? true : blocked === 'false' ? false : undefined;
    return this.admin.listUsers(
      limitNum,
      Number.isNaN(cursorId) ? undefined : cursorId,
      q,
      blockedFilter,
    );
  }

  @Patch('users/:id/block')
  async blockUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetBlockedDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.admin.setUserBlocked(id, body.blocked, body.reason, req.user.id);
  }

  @Get('organizations')
  async organizations(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('blocked') blocked?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    const blockedFilter =
      blocked === 'true' ? true : blocked === 'false' ? false : undefined;
    return this.admin.listOrganizations(
      limitNum,
      Number.isNaN(cursorId) ? undefined : cursorId,
      q,
      blockedFilter,
    );
  }

  @Get('service-logs')
  async serviceLogs(
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const cursorId = cursor ? parseInt(cursor, 10) : undefined;
    return this.admin.listServiceLogs(
      Number.isFinite(limitNum) ? limitNum : 50,
      type,
      Number.isNaN(cursorId!) ? undefined : cursorId,
    );
  }

  @Patch('organizations/:id/block')
  async blockOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SetBlockedDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.admin.setOrganizationBlocked(
      id,
      body.blocked,
      body.reason,
      req.user.id,
    );
  }
}
