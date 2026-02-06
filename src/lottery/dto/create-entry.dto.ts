import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsNotEmpty,
  Matches,
} from 'class-validator';

export class CreateEntryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'nullifierHash must be a 66-character hex string (0x + 64 hex chars)',
  })
  nullifierHash: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]+$/, {
    message: 'paidAmount must be a numeric string (wei)',
  })
  paidAmount: string;

  /**
   * @deprecated Contract model is 1 entry per WorldID per lottery.
   * Kept for backward compatibility with default value of 1.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  ticketCount?: number = 1;
}
