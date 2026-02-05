import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { LotteryService } from './lottery.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { LotteryListQueryDto } from './dto/lottery-list-query.dto';
import {
  LotteryListResponseDto,
  LotteryResponseDto,
} from './dto/lottery-response.dto';
import { UpdateLotteryDto } from './dto/update-lottery.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { LotteryOwnerGuard } from './guards/lottery-owner.guard';
import { WorldIdVerifiedGuard } from './guards/worldid-verified.guard';
import { CreateEntryDto } from './dto/create-entry.dto';

@Controller('lotteries')
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Public()
  @Get()
  async findAll(
    @Query() query: LotteryListQueryDto,
  ): Promise<LotteryListResponseDto> {
    return this.lotteryService.findAll(query);
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LotteryResponseDto> {
    return this.lotteryService.findOne(id);
  }

  @Post()
  async create(
    @CurrentUser('userId') userId: string,
    @Body() createLotteryDto: CreateLotteryDto,
  ): Promise<LotteryResponseDto> {
    return this.lotteryService.create(userId, createLotteryDto);
  }

  @UseGuards(LotteryOwnerGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateLotteryDto: UpdateLotteryDto,
  ): Promise<LotteryResponseDto> {
    return this.lotteryService.update(id, updateLotteryDto);
  }

  @UseGuards(WorldIdVerifiedGuard)
  @Post(':id/entries')
  async createEntry(
    @Param('id') lotteryId: string,
    @CurrentUser('userId') userId: string,
    @Body() createEntryDto: CreateEntryDto,
  ) {
    return this.lotteryService.createEntry(userId, lotteryId, createEntryDto);
  }
}
