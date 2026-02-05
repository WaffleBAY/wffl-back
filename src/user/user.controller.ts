import { Controller, Get, Post, Body, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from './dto/user-response.dto';
import { WorldIdVerificationDto } from './dto/worldid-verification.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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
}
