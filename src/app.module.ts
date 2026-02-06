import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import * as Joi from 'joi';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { UploadsModule } from './uploads/uploads.module';
import { LotteryModule } from './lottery/lottery.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { NotificationModule } from './notification/notification.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
        JWT_ACCESS_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        // R2 environment variables (optional for now, required in production)
        R2_ACCOUNT_ID: Joi.string().optional(),
        R2_ACCESS_KEY_ID: Joi.string().optional(),
        R2_SECRET_ACCESS_KEY: Joi.string().optional(),
        R2_BUCKET_NAME: Joi.string().optional(),
        R2_PUBLIC_URL: Joi.string().optional(),
        // World App Push notification variables (required in production)
        WORLD_APP_ID: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required().messages({
            'any.required': 'WORLD_APP_ID is required in production for push notifications',
          }),
          otherwise: Joi.optional(),
        }),
        WORLD_APP_API_KEY: Joi.string().when('NODE_ENV', {
          is: 'production',
          then: Joi.required().messages({
            'any.required': 'WORLD_APP_API_KEY is required in production for push notifications',
          }),
          otherwise: Joi.optional(),
        }),
        WORLD_CHAIN_RPC_URL: Joi.string().default(
          'https://worldchain-sepolia.g.alchemy.com/public',
        ),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    UserModule,
    UploadsModule,
    LotteryModule,
    BlockchainModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
