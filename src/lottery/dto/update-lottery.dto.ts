import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  Matches,
} from 'class-validator';
import { LotteryStatus } from '@prisma/client';

/**
 * UpdateLotteryDto - only allows updating fields that can be safely changed after creation.
 * Includes admin fields: status, contractAddress
 */
export class UpdateLotteryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  prize?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  /**
   * @deprecated Use shippingRegions instead. Kept for backward compatibility.
   */
  @IsString()
  @IsOptional()
  region?: string;

  // Admin fields

  @IsEnum(LotteryStatus)
  @IsOptional()
  status?: LotteryStatus;

  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'contractAddress must be a valid Ethereum address',
  })
  contractAddress?: string;
}
