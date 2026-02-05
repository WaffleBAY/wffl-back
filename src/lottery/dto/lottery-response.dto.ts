import { LotteryStatus } from '@prisma/client';

export class LotteryCreatorDto {
  id: string;
  username: string | null;
  profilePictureUrl: string | null;
}

export class LotteryResponseDto {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  imageUrl: string | null;
  ticketPrice: string; // Keep as string to preserve Decimal precision
  maxTickets: number;
  soldTickets: number;
  startDate: Date;
  endDate: Date;
  status: LotteryStatus;
  region: string | null;
  creator: LotteryCreatorDto;
  entriesCount: number;
  createdAt: Date;
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
