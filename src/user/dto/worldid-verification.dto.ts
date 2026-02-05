import { IsString, IsIn } from 'class-validator';

export class WorldIdVerificationDto {
  @IsString()
  nullifierHash: string;

  @IsIn(['orb']) // Only accept Orb verification per CONTEXT.md
  verificationLevel: 'orb';

  @IsString()
  merkleRoot: string;

  @IsString()
  proof: string;
}
