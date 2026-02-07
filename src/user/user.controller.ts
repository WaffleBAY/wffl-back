import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';
import { WorldIdVerificationDto } from './dto/worldid-verification.dto';
import { EntryListResponseDto } from './dto/entry-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LotteryListResponseDto } from '../lottery/dto/lottery-response.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUser('userId') userId: string): Promise<UserResponseDto> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Post('me/worldid')
  async verifyWorldId(
    @CurrentUser('userId') userId: string,
    @Body() dto: WorldIdVerificationDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateWorldIdStatus(userId, dto);
  }

  @Get('me/lotteries')
  async getMyLotteries(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<LotteryListResponseDto> {
    return this.userService.findMyLotteries(userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('me/entries')
  async getMyEntries(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<EntryListResponseDto> {
    return this.userService.findEntries(userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('me/winnings')
  async getMyWinnings(
    @CurrentUser('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<EntryListResponseDto> {
    return this.userService.findWinnings(userId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
