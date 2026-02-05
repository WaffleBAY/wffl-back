import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateEntryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  ticketCount?: number = 1;
}
