import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * UpdateLotteryDto - only allows updating fields that can be safely changed after creation.
 * Does NOT allow changing: ticketPrice, maxTickets, startDate, endDate (immutable after creation)
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

  @IsString()
  @IsOptional()
  region?: string;
}
