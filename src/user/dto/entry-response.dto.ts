export class EntryLotteryCreatorDto {
  id: string;
  username: string | null;
  profilePictureUrl: string | null;
}

export class EntryLotteryDto {
  id: string;
  title: string;
  description: string | null;
  prize: string;
  imageUrl: string | null;
  contractAddress: string | null;
  status: string;
  endTime: Date;
  creator: EntryLotteryCreatorDto;
}

export class EntryResponseDto {
  id: string;
  ticketCount: number;
  paidAmount: string;
  isWinner: boolean;
  depositRefunded: boolean;
  createdAt: Date;
  lottery: EntryLotteryDto;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class EntryListResponseDto {
  items: EntryResponseDto[];
  pagination: PaginationDto;
}
