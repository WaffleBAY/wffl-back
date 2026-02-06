import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [LotteryController],
  providers: [LotteryService],
  exports: [LotteryService],
})
export class LotteryModule {}
