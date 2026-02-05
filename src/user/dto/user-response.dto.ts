export class UserStatsDto {
  lotteriesCreated: number;
  entriesCount: number;
  winsCount: number;
}

export class UserResponseDto {
  id: string;
  walletAddress: string;
  username: string | null;
  profilePictureUrl: string | null;
  worldIdVerified: boolean;
  worldIdVerifiedAt: Date | null;
  worldIdVerificationLevel: string | null;
  stats: UserStatsDto;
  createdAt: Date;
}
