import {
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKey } from '../common/decorators/api-key.decorator';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List notifications for authenticated admin' })
  async listAdmin(
    @Request() req,
    @Query('unreadOnly', new ParseBoolPipe({ optional: true }))
    unreadOnly = false,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.notificationsService.listForAdmin(req.user.id, unreadOnly, limit);
  }

  @Patch('admin/:id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark one admin notification as read' })
  async markReadAdmin(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markReadForAdmin(req.user.id, id);
  }

  @Patch('admin/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark all admin notifications as read' })
  async markAllReadAdmin(@Request() req) {
    return this.notificationsService.markAllReadForAdmin(req.user.id);
  }

  @Get('merchant')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiKey()
  @ApiOperation({ summary: 'List notifications for authenticated merchant' })
  async listMerchant(
    @Request() req,
    @Query('unreadOnly', new ParseBoolPipe({ optional: true }))
    unreadOnly = false,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.notificationsService.listForMerchant(
      req.merchant.id,
      unreadOnly,
      limit,
    );
  }

  @Patch('merchant/:id/read')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiKey()
  @ApiOperation({ summary: 'Mark one merchant notification as read' })
  async markReadMerchant(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notificationsService.markReadForMerchant(req.merchant.id, id);
  }

  @Patch('merchant/read-all')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiKey()
  @ApiOperation({ summary: 'Mark all merchant notifications as read' })
  async markAllReadMerchant(@Request() req) {
    return this.notificationsService.markAllReadForMerchant(req.merchant.id);
  }
}
