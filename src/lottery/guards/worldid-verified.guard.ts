import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorldIdVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { worldIdVerifiedAt: true, nullifierHash: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.worldIdVerifiedAt || !user.nullifierHash) {
      throw new ForbiddenException(
        'WorldID verification required to enter lotteries',
      );
    }

    return true;
  }
}
