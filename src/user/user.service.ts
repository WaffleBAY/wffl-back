import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { WorldIdVerificationDto } from './dto/worldid-verification.dto';
import { EntryListResponseDto } from './dto/entry-response.dto';
import { LotteryListResponseDto } from '../lottery/dto/lottery-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            lotteries: true,
            entries: true,
          },
        },
      },
    });

    if (!user) return null;

    // Count wins (entries where isWinner is true)
    const winsCount = await this.prisma.entry.count({
      where: {
        userId,
        isWinner: true,
      },
    });

    return {
      id: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      profilePictureUrl: user.profilePictureUrl,
      worldIdVerified: !!user.worldIdVerifiedAt,
      worldIdVerifiedAt: user.worldIdVerifiedAt,
      worldIdVerificationLevel: user.worldIdVerificationLevel,
      stats: {
        lotteriesCreated: user._count.lotteries,
        entriesCount: user._count.entries,
        winsCount,
      },
      createdAt: user.createdAt,
    };
  }

  /**
   * Update WorldID verification status for a user.
   * TODO: In production, verify the proof cryptographically via World Developer Portal API.
   * For hackathon, we trust the frontend's MiniKit verification and just store the result.
   */
  async updateWorldIdStatus(
    userId: string,
    dto: WorldIdVerificationDto,
  ): Promise<UserResponseDto> {
    // Check if user already verified
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser?.worldIdVerifiedAt) {
      throw new BadRequestException('WorldID already verified');
    }

    // Check if nullifierHash already used by another user (prevent double-registration)
    const existingNullifier = await this.prisma.user.findUnique({
      where: { nullifierHash: dto.nullifierHash },
    });

    if (existingNullifier && existingNullifier.id !== userId) {
      throw new BadRequestException(
        'This WorldID is already linked to another account',
      );
    }

    // Update user with WorldID verification status
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        nullifierHash: dto.nullifierHash,
        worldIdVerifiedAt: new Date(),
        worldIdVerificationLevel: dto.verificationLevel,
      },
    });

    // Return updated user info
    const result = await this.findById(userId);
    if (!result) {
      throw new BadRequestException('User not found after update');
    }
    return result;
  }

  /**
   * Find paginated entries for a user with lottery details.
   */
  async findEntries(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<EntryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lottery: {
            include: {
              creator: {
                select: {
                  id: true,
                  walletAddress: true,
                  username: true,
                  profilePictureUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.entry.count({ where: { userId } }),
    ]);

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        ticketCount: entry.ticketCount,
        paidAmount: entry.paidAmount,
        isWinner: entry.isWinner,
        depositRefunded: entry.depositRefunded,
        createdAt: entry.createdAt,
        lottery: {
          id: entry.lottery.id,
          title: entry.lottery.title,
          description: entry.lottery.description,
          prize: entry.lottery.prize,
          imageUrl: entry.lottery.imageUrl,
          contractAddress: entry.lottery.contractAddress,
          marketType: entry.lottery.marketType,
          ticketPrice: entry.lottery.ticketPrice,
          status: entry.lottery.status,
          endTime: entry.lottery.endTime,
          creator: entry.lottery.creator,
        },
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
   * Find paginated winning entries for a user with lottery details.
   */
  async findWinnings(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<EntryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.entry.findMany({
        where: { userId, isWinner: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lottery: {
            include: {
              creator: {
                select: {
                  id: true,
                  walletAddress: true,
                  username: true,
                  profilePictureUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.entry.count({ where: { userId, isWinner: true } }),
    ]);

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        ticketCount: entry.ticketCount,
        paidAmount: entry.paidAmount,
        isWinner: entry.isWinner,
        depositRefunded: entry.depositRefunded,
        createdAt: entry.createdAt,
        lottery: {
          id: entry.lottery.id,
          title: entry.lottery.title,
          description: entry.lottery.description,
          prize: entry.lottery.prize,
          imageUrl: entry.lottery.imageUrl,
          contractAddress: entry.lottery.contractAddress,
          marketType: entry.lottery.marketType,
          ticketPrice: entry.lottery.ticketPrice,
          status: entry.lottery.status,
          endTime: entry.lottery.endTime,
          creator: entry.lottery.creator,
        },
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
   * Find paginated lotteries created by this user.
   */
  async findMyLotteries(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<LotteryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [lotteries, total] = await Promise.all([
      this.prisma.lottery.findMany({
        where: { creatorId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
              walletAddress: true,
              username: true,
              profilePictureUrl: true,
            },
          },
          _count: {
            select: {
              entries: true,
            },
          },
        },
      }),
      this.prisma.lottery.count({ where: { creatorId: userId } }),
    ]);

    return {
      items: lotteries.map((lottery) => ({
        id: lottery.id,
        title: lottery.title,
        description: lottery.description,
        prize: lottery.prize,
        imageUrl: lottery.imageUrl,
        contractAddress: lottery.contractAddress,
        marketType: lottery.marketType,
        ticketPrice: lottery.ticketPrice,
        goalAmount: lottery.goalAmount,
        sellerDeposit: lottery.sellerDeposit,
        prizePool: lottery.prizePool,
        participantDeposit: lottery.participantDeposit,
        preparedQuantity: lottery.preparedQuantity,
        endTime: lottery.endTime,
        duration: lottery.duration,
        status: lottery.status,
        participantCount: lottery.participantCount,
        winners: lottery.winners,
        shippingRegions: lottery.shippingRegions,
        region: lottery.region,
        snapshotBlock: lottery.snapshotBlock,
        commitment: lottery.commitment,
        nonce: lottery.nonce,
        createdAt: lottery.createdAt,
        openedAt: lottery.openedAt,
        closedAt: lottery.closedAt,
        revealedAt: lottery.revealedAt,
        completedAt: lottery.completedAt,
        creator: {
          id: lottery.creator.id,
          walletAddress: lottery.creator.walletAddress,
          username: lottery.creator.username,
          profilePictureUrl: lottery.creator.profilePictureUrl,
        },
        entriesCount: lottery._count.entries,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
