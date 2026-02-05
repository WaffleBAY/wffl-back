import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { WorldIdVerificationDto } from './dto/worldid-verification.dto';

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

    // Count wins (entries where lottery.winnerId matches userId)
    const winsCount = await this.prisma.entry.count({
      where: {
        userId,
        lottery: { winnerId: userId },
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
}
