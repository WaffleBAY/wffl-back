import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService, TokenResponse } from './auth.service';
import { Public } from './decorators/public.decorator';
import { VerifySiweDto } from './dto/verify-siwe.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('nonce')
  async getNonce(): Promise<{ nonce: string }> {
    const nonce = await this.authService.generateNonce();
    return { nonce };
  }

  @Public()
  @Post('verify')
  async verifySiwe(@Body() dto: VerifySiweDto): Promise<TokenResponse> {
    return this.authService.verifySiweAndGenerateTokens(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refreshTokens(@Req() req: Request): Promise<TokenResponse> {
    const user = req.user as { userId: string; refreshToken: string };
    return this.authService.refreshTokens(user.userId, user.refreshToken);
  }

  @Post('logout')
  async logout(
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean }> {
    await this.authService.logout(userId);
    return { success: true };
  }
}
