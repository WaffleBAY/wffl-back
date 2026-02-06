import { Controller, Get, Patch, Body, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  NotificationListResponseDto,
  MarkAsReadDto,
} from './dto/notification.dto';

@Controller('users/me/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getMyNotifications(
    @CurrentUser('walletAddress') walletAddress: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponseDto> {
    return this.notificationService.findByWallet(walletAddress, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Patch('read')
  async markAsRead(
    @CurrentUser('walletAddress') walletAddress: string,
    @Body() dto: MarkAsReadDto,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAsRead(walletAddress, dto.notificationIds);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser('walletAddress') walletAddress: string,
  ): Promise<{ success: boolean }> {
    await this.notificationService.markAllAsRead(walletAddress);
    return { success: true };
  }
}
