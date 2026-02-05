import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, LotteryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { LotteryListQueryDto } from './dto/lottery-list-query.dto';
import {
  LotteryListResponseDto,
  LotteryResponseDto,
} from './dto/lottery-response.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { CreateEntryDto } from './dto/create-entry.dto';

@Injectable()
export class LotteryService {
  constructor(private readonly prisma: PrismaService) {}

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

    const items: LotteryResponseDto[] = lotteries.map((lottery) => ({
      id: lottery.id,
      title: lottery.title,
      description: lottery.description,
      prize: lottery.prize,
      imageUrl: lottery.imageUrl,
      ticketPrice: lottery.ticketPrice.toString(), // Convert Decimal to string
      maxTickets: lottery.maxTickets,
      soldTickets: lottery.soldTickets,
      startDate: lottery.startDate,
      endDate: lottery.endDate,
      status: lottery.status,
      region: lottery.region,
      creator: {
        id: lottery.creator.id,
        username: lottery.creator.username,
        profilePictureUrl: lottery.creator.profilePictureUrl,
      },
      entriesCount: lottery._count.entries,
      createdAt: lottery.createdAt,
    }));

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

    return {
      id: lottery.id,
      title: lottery.title,
      description: lottery.description,
      prize: lottery.prize,
      imageUrl: lottery.imageUrl,
      ticketPrice: lottery.ticketPrice.toString(), // Convert Decimal to string
      maxTickets: lottery.maxTickets,
      soldTickets: lottery.soldTickets,
      startDate: lottery.startDate,
      endDate: lottery.endDate,
      status: lottery.status,
      region: lottery.region,
      creator: {
        id: lottery.creator.id,
        username: lottery.creator.username,
        profilePictureUrl: lottery.creator.profilePictureUrl,
      },
      entriesCount: lottery._count.entries,
      createdAt: lottery.createdAt,
    };
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
        ticketPrice: new Prisma.Decimal(dto.ticketPrice),
        maxTickets: dto.maxTickets,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        region: dto.region,
        creatorId: userId,
        status: 'PENDING',
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

        // Check if lottery is active
        if (lottery.status !== LotteryStatus.ACTIVE) {
          throw new BadRequestException(
            'This lottery is not currently active',
          );
        }

        // Check if tickets are available
        if (lottery.soldTickets + ticketCount > lottery.maxTickets) {
          throw new BadRequestException('Not enough tickets available');
        }

        // Create entry
        const createdEntry = await tx.entry.create({
          data: {
            userId,
            lotteryId,
            ticketCount,
          },
        });

        // Update sold tickets
        await tx.lottery.update({
          where: { id: lotteryId },
          data: {
            soldTickets: { increment: ticketCount },
          },
        });

        return createdEntry;
      });

      // Return entry with lottery info
      const lottery = await this.findOne(lotteryId);

      return {
        id: entry.id,
        ticketCount: entry.ticketCount,
        createdAt: entry.createdAt,
        lottery: {
          id: lottery.id,
          title: lottery.title,
          prize: lottery.prize,
          soldTickets: lottery.soldTickets,
          maxTickets: lottery.maxTickets,
        },
      };
    } catch (error) {
      // Handle Prisma unique constraint violation (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'You have already entered this lottery',
          );
        }
      }
      throw error;
    }
  }
}
