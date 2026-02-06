import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, LotteryStatus, Lottery } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { LotteryListQueryDto } from './dto/lottery-list-query.dto';
import {
  LotteryListResponseDto,
  LotteryResponseDto,
} from './dto/lottery-response.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { CreateEntryDto } from './dto/create-entry.dto';

// Type for lottery with included relations
type LotteryWithRelations = Lottery & {
  creator: {
    id: string;
    username: string | null;
    profilePictureUrl: string | null;
  };
  _count: {
    entries: number;
  };
};

@Injectable()
export class LotteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Map a Lottery entity to LotteryResponseDto
   */
  private mapToResponse(lottery: LotteryWithRelations): LotteryResponseDto {
    return {
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
        username: lottery.creator.username,
        profilePictureUrl: lottery.creator.profilePictureUrl,
      },
      entriesCount: lottery._count.entries,
    };
  }

  async findAll(query: LotteryListQueryDto): Promise<LotteryListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build where clause from filters
    const where: {
      status?: typeof query.status;
      region?: string;
    } = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.region) {
      where.region = query.region;
    }

    // Parallel fetch: items and count
    const [lotteries, total] = await Promise.all([
      this.prisma.lottery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          creator: {
            select: {
              id: true,
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
      this.prisma.lottery.count({ where }),
    ]);

    const items: LotteryResponseDto[] = lotteries.map((lottery) =>
      this.mapToResponse(lottery),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string): Promise<LotteryResponseDto> {
    const lottery = await this.prisma.lottery.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
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
    });

    if (!lottery) {
      throw new NotFoundException(`Lottery with ID "${id}" not found`);
    }

    return this.mapToResponse(lottery);
  }

  async create(
    userId: string,
    dto: CreateLotteryDto,
  ): Promise<LotteryResponseDto> {
    const lottery = await this.prisma.lottery.create({
      data: {
        title: dto.title,
        description: dto.description,
        prize: dto.prize,
        imageUrl: dto.imageUrl,
        marketType: dto.marketType ?? 'LOTTERY',
        ticketPrice: dto.ticketPrice,
        goalAmount: dto.goalAmount,
        preparedQuantity: dto.preparedQuantity ?? 1,
        endTime: new Date(dto.endTime * 1000), // Convert Unix timestamp to Date
        duration: dto.duration,
        shippingRegions: dto.shippingRegions ?? [],
        region: dto.region, // Keep for backward compat
        creatorId: userId,
        status: LotteryStatus.CREATED, // New default status
        contractAddress: dto.contractAddress, // Save contract address from frontend
      },
    });

    return this.findOne(lottery.id);
  }

  async update(id: string, dto: UpdateLotteryDto): Promise<LotteryResponseDto> {
    // Build update data with only provided fields
    const updateData: Prisma.LotteryUpdateInput = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.prize !== undefined) {
      updateData.prize = dto.prize;
    }
    if (dto.imageUrl !== undefined) {
      updateData.imageUrl = dto.imageUrl;
    }
    if (dto.region !== undefined) {
      updateData.region = dto.region;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.contractAddress !== undefined) {
      updateData.contractAddress = dto.contractAddress;
    }

    await this.prisma.lottery.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(id);
  }

  async createEntry(userId: string, lotteryId: string, dto: CreateEntryDto) {
    const ticketCount = dto.ticketCount ?? 1;

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        // Find lottery and check if it exists
        const lottery = await tx.lottery.findUnique({
          where: { id: lotteryId },
        });

        if (!lottery) {
          throw new NotFoundException(
            `Lottery with ID "${lotteryId}" not found`,
          );
        }

        // Check if lottery is open for entries
        if (lottery.status !== LotteryStatus.OPEN) {
          throw new BadRequestException(
            'This lottery is not currently open for entries',
          );
        }

        // Create entry with WorldID fields
        const createdEntry = await tx.entry.create({
          data: {
            userId,
            lotteryId,
            ticketCount,
            nullifierHash: dto.nullifierHash,
            paidAmount: dto.paidAmount,
          },
        });

        // Update participant count
        await tx.lottery.update({
          where: { id: lotteryId },
          data: {
            participantCount: { increment: 1 },
          },
        });

        return createdEntry;
      });

      // Return entry with lottery info
      const lottery = await this.findOne(lotteryId);

      // Send entry confirmed notification (non-blocking)
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });
      if (user) {
        // Fire and forget - don't await to avoid blocking the response
        this.notificationService
          .sendEntryConfirmedNotification(
            user.walletAddress,
            lotteryId,
            lottery.title,
          )
          .catch((err) => {
            // Log but don't throw - notification failure shouldn't fail entry
            console.error('Failed to send entry confirmed notification:', err);
          });
      }

      return {
        id: entry.id,
        ticketCount: entry.ticketCount,
        nullifierHash: entry.nullifierHash,
        paidAmount: entry.paidAmount,
        createdAt: entry.createdAt,
        lottery: {
          id: lottery.id,
          title: lottery.title,
          prize: lottery.prize,
          participantCount: lottery.participantCount,
          goalAmount: lottery.goalAmount,
        },
      };
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'You have already entered this lottery with this WorldID',
          );
        }
      }
      throw error;
    }
  }
}
