import { LotteryStatus, MarketType } from '@prisma/client';

export class LotteryCreatorDto {
  id: string;
  walletAddress: string;
  username: string | null;
  profilePictureUrl: string | null;
}

export class LotteryResponseDto {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  imageUrl: string | null;

  // Contract identification
  contractAddress: string | null;

  // Market type
  marketType: MarketType;

  // Economic fields (all as strings for BigInt precision)
  ticketPrice: string;
  goalAmount: string;
  sellerDeposit: string;
  prizePool: string;
  participantDeposit: string;

  // Conditions
  preparedQuantity: number;
  endTime: Date;
  duration: number | null;

  // Current state
  status: LotteryStatus;
  participantCount: number;

  // Winners
  winners: string[];

  // Shipping
  shippingRegions: string[];

  /**
   * @deprecated Use shippingRegions instead. Kept for backward compatibility.
   */
  region: string | null;

  // Randomness (optional)
  snapshotBlock: number | null;
  commitment: string | null;
  nonce: number | null;

  // Timestamps
  createdAt: Date;
  openedAt: Date | null;
  closedAt: Date | null;
  revealedAt: Date | null;
  completedAt: Date | null;

  // Creator info
  creator: LotteryCreatorDto;
  entriesCount: number;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class LotteryListResponseDto {
  items: LotteryResponseDto[];
  pagination: PaginationDto;
}
