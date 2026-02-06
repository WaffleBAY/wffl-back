import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { VerifySiweDto } from './dto/verify-siwe.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { verifySiweMessage } from '@worldcoin/minikit-js';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async generateNonce(): Promise<string> {
    // Generate 32-character alphanumeric nonce (16 bytes = 32 hex chars)
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store with 5-minute TTL (300000 ms)
    await this.cacheManager.set(`nonce:${nonce}`, true, 300000);

    return nonce;
  }

  async consumeNonce(nonce: string): Promise<boolean> {
    const cacheKey = `nonce:${nonce}`;
    const exists = await this.cacheManager.get(cacheKey);

    if (!exists) {
      return false;
    }

    // Delete after use (one-time use)
    await this.cacheManager.del(cacheKey);
    return true;
  }

  async verifySiweAndGenerateTokens(dto: VerifySiweDto): Promise<TokenResponse> {
    // 1. Verify SIWE message using MiniKit (nonce is validated within SIWE signature)
    try {
      const result = await verifySiweMessage(dto.payload, dto.nonce);
      if (!result.isValid) {
        throw new UnauthorizedException('Invalid SIWE signature');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('SIWE verification failed');
    }

    // 2.5. Fetch World username (graceful fallback if fails)
    const { username, profilePictureUrl } =
      await this.fetchWorldUsername(dto.payload.address);

    // 3. Find or create user (upsert by wallet address)
    const user = await this.prisma.user.upsert({
      where: { walletAddress: dto.payload.address.toLowerCase() },
      update: {
        updatedAt: new Date(),
        username: username ?? undefined, // Only update if we got a value
        profilePictureUrl: profilePictureUrl ?? undefined,
      },
      create: {
        walletAddress: dto.payload.address.toLowerCase(),
        username,
        profilePictureUrl,
      },
    });

    // 4. Generate and return tokens
    return this.generateTokens(user.id, user.walletAddress);
  }

  /**
   * Fetch username and profile picture from World Usernames API.
   * Gracefully returns null values if the API call fails.
   */
  private async fetchWorldUsername(
    walletAddress: string,
  ): Promise<{ username: string | null; profilePictureUrl: string | null }> {
    try {
      const response = await fetch(
        'https://usernames.worldcoin.org/api/v1/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addresses: [walletAddress.toLowerCase()],
          }),
        },
      );

      if (!response.ok) {
        console.warn(`World Usernames API returned ${response.status}`);
        return { username: null, profilePictureUrl: null };
      }

      const data = await response.json();
      // Response format: { [address]: { username, profile_picture_url } }
      const userInfo = data[walletAddress.toLowerCase()];

      if (userInfo) {
        return {
          username: userInfo.username || null,
          profilePictureUrl: userInfo.profile_picture_url || null,
        };
      }

      return { username: null, profilePictureUrl: null };
    } catch (error) {
      console.warn('Failed to fetch World username:', error);
      return { username: null, profilePictureUrl: null };
    }
  }

  async generateTokens(
    userId: string,
    walletAddress: string,
  ): Promise<TokenResponse> {
    const payload: JwtPayload = {
      sub: userId,
      walletAddress,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // Store hashed refresh token for validation on refresh
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<TokenResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new ForbiddenException('Access denied');
    }

    return this.generateTokens(user.id, user.walletAddress);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}
