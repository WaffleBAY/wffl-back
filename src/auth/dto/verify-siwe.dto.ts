import {
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class SiwePayloadDto {
  @IsString()
  @IsIn(['success'])
  status: 'success';

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  version: number;
}

export class VerifySiweDto {
  @ValidateNested()
  @Type(() => SiwePayloadDto)
  payload: SiwePayloadDto;

  @IsString()
  @IsNotEmpty()
  nonce: string;
}
