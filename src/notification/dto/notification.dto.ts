import { NotificationType } from '@prisma/client';

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  lotteryId: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export class NotificationListResponseDto {
  items: NotificationResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class MarkAsReadDto {
  notificationIds: string[];
}
