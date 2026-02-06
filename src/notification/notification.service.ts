import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationListResponseDto } from './dto/notification.dto';

interface PushLocalisation {
  language: string;
  title: string;
  message: string;
}

interface SendNotificationPayload {
  app_id: string;
  wallet_addresses: string[];
  mini_app_path: string;
  localisations: PushLocalisation[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly PUSH_API_URL =
    'https://developer.worldcoin.org/api/v2/minikit/send-notification';
  private readonly MAX_ADDRESSES_PER_REQUEST = 1000;

  private readonly appId: string | undefined;
  private readonly apiKey: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.appId = this.configService.get<string>('WORLD_APP_ID');
    this.apiKey = this.configService.get<string>('WORLD_APP_API_KEY');

    if (!this.appId || !this.apiKey) {
      this.logger.warn(
        'WORLD_APP_ID or WORLD_APP_API_KEY not configured. Push notifications will be disabled.',
      );
    }
  }

  /**
   * Find notifications for a wallet address with pagination
   */
  async findByWallet(
    walletAddress: string,
    options: { page: number; limit: number },
  ): Promise<NotificationListResponseDto> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { walletAddress },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { walletAddress } }),
    ]);

    return {
      items: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        lotteryId: n.lotteryId,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark specific notifications as read
   */
  async markAsRead(
    walletAddress: string,
    notificationIds: string[],
  ): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        walletAddress,
      },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a wallet
   */
  async markAllAsRead(walletAddress: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { walletAddress, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Send entry confirmed notification
   */
  async sendEntryConfirmedNotification(
    walletAddress: string,
    lotteryId: string,
    lotteryTitle: string,
  ): Promise<void> {
    const title = '응모 완료';
    const message = `${lotteryTitle} 응모가 완료되었습니다.`;

    // Persist to database
    await this.prisma.notification.create({
      data: {
        walletAddress,
        lotteryId,
        type: 'ENTRY_CONFIRMED',
        title,
        message,
      },
    });

    // Send push notification
    const localisations: PushLocalisation[] = [
      { language: 'ko', title, message },
      {
        language: 'en',
        title: 'Entry Confirmed',
        message: `Your entry for ${lotteryTitle} has been confirmed.`,
      },
    ];
    await this.sendPush([walletAddress], lotteryId, localisations);
    this.logger.log(
      `Entry confirmed notification sent to ${walletAddress} for lottery ${lotteryId}`,
    );
  }

  /**
   * Send win notification to winners
   */
  async sendWinNotification(
    winnerAddresses: string[],
    lotteryId: string,
  ): Promise<void> {
    const title = '당첨 알림';
    const message = '복권에 당첨되었습니다! 확인하러 가세요.';

    // Persist to database for each winner
    await Promise.all(
      winnerAddresses.map((walletAddress) =>
        this.prisma.notification.create({
          data: {
            walletAddress,
            lotteryId,
            type: 'WIN',
            title,
            message,
          },
        }),
      ),
    );

    const localisations: PushLocalisation[] = [
      { language: 'ko', title, message },
      {
        language: 'en',
        title: 'Winner Notification',
        message: 'You won the lottery! Check it out.',
      },
    ];

    await this.sendPush(winnerAddresses, lotteryId, localisations);
    this.logger.log(
      `Win notification sent to ${winnerAddresses.length} winners for lottery ${lotteryId}`,
    );
  }

  /**
   * Send refund notification to participants when market fails
   */
  async sendRefundNotification(
    participantAddresses: string[],
    lotteryId: string,
  ): Promise<void> {
    const title = '환불 안내';
    const message = '마켓이 목표에 도달하지 못했습니다. 환불을 받아가세요.';

    // Persist to database for each participant
    await Promise.all(
      participantAddresses.map((walletAddress) =>
        this.prisma.notification.create({
          data: {
            walletAddress,
            lotteryId,
            type: 'REFUND',
            title,
            message,
          },
        }),
      ),
    );

    const localisations: PushLocalisation[] = [
      { language: 'ko', title, message },
      {
        language: 'en',
        title: 'Refund Available',
        message: 'Market did not reach its goal. Claim your refund.',
      },
    ];

    await this.sendPush(participantAddresses, lotteryId, localisations);
    this.logger.log(
      `Refund notification sent to ${participantAddresses.length} participants for lottery ${lotteryId}`,
    );
  }

  /**
   * Send sale complete notification to seller when winner confirms receipt
   */
  async sendSaleCompleteNotification(
    sellerAddress: string,
    lotteryId: string,
  ): Promise<void> {
    const title = '판매 완료';
    const message = '당첨자가 수령을 확인했습니다. 정산이 완료되었습니다.';

    // Persist to database
    await this.prisma.notification.create({
      data: {
        walletAddress: sellerAddress,
        lotteryId,
        type: 'SALE_COMPLETE',
        title,
        message,
      },
    });

    const localisations: PushLocalisation[] = [
      { language: 'ko', title, message },
      {
        language: 'en',
        title: 'Sale Complete',
        message: 'Winner confirmed receipt. Settlement is complete.',
      },
    ];

    await this.sendPush([sellerAddress], lotteryId, localisations);
    this.logger.log(
      `Sale complete notification sent to seller for lottery ${lotteryId}`,
    );
  }

  /**
   * Send push notification to wallet addresses
   * Silent failure: logs errors but doesn't throw
   */
  private async sendPush(
    walletAddresses: string[],
    lotteryId: string,
    localisations: PushLocalisation[],
  ): Promise<void> {
    if (!this.appId || !this.apiKey) {
      this.logger.warn(
        'Push notifications disabled: missing WORLD_APP_ID or WORLD_APP_API_KEY',
      );
      return;
    }

    if (walletAddresses.length === 0) {
      this.logger.debug('No wallet addresses to send notification to');
      return;
    }

    // Deep link to the lottery detail page
    const miniAppPath = `/lottery/${lotteryId}`;

    // Batch addresses if needed (max 1000 per request)
    const batches: string[][] = [];
    for (let i = 0; i < walletAddresses.length; i += this.MAX_ADDRESSES_PER_REQUEST) {
      batches.push(walletAddresses.slice(i, i + this.MAX_ADDRESSES_PER_REQUEST));
    }

    for (const batch of batches) {
      try {
        const payload: SendNotificationPayload = {
          app_id: this.appId,
          wallet_addresses: batch,
          mini_app_path: miniAppPath,
          localisations,
        };

        const response = await fetch(this.PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(
            `Push notification failed: ${response.status} ${errorText}`,
          );
        } else {
          this.logger.debug(
            `Push notification sent successfully to ${batch.length} addresses`,
          );
        }
      } catch (error) {
        // Silent failure - log but don't throw
        this.logger.error('Failed to send push notification', error);
      }
    }
  }
}
