import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LotteryOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const lotteryId = request.params?.id;

    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!lotteryId) {
      throw new NotFoundException('Lottery ID not provided');
    }

    const lottery = await this.prisma.lottery.findUnique({
      where: { id: lotteryId },
      select: { creatorId: true },
    });

    if (!lottery) {
      throw new NotFoundException(`Lottery with ID "${lotteryId}" not found`);
    }

    if (lottery.creatorId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this lottery',
      );
    }

    return true;
  }
}
