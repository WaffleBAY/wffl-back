import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  IsEnum,
  IsArray,
  Matches,
} from 'class-validator';
import { MarketType } from '@prisma/client';

export class CreateLotteryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsNotEmpty()
  prize: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsEnum(MarketType)
  @IsOptional()
  marketType?: MarketType = MarketType.LOTTERY;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, { message: 'ticketPrice must be a numeric string (wei)' })
  ticketPrice: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, { message: 'goalAmount must be a numeric string (wei)' })
  goalAmount: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  preparedQuantity?: number = 1;

  @IsInt()
  @Min(60) // At least 1 minute
  duration: number;

  @IsInt()
  @Min(1)
  endTime: number; // Unix timestamp in seconds

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  shippingRegions?: string[] = [];

  /**
   * @deprecated Use shippingRegions instead. Kept for backward compatibility.
   */
  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'contractAddress must be a valid Ethereum address',
  })
  contractAddress?: string;
}
