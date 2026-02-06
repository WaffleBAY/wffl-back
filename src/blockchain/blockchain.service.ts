import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createPublicClient, http, type Address } from 'viem';
import { worldChainSepolia, waffleMarketAbi } from './blockchain.constants';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private lastProcessedBlock: bigint = BigInt(0);
  private isProcessing = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>(
      'WORLD_CHAIN_RPC_URL',
      'https://worldchain-sepolia.g.alchemy.com/public',
    );

    try {
      this.client = createPublicClient({
        chain: worldChainSepolia,
        transport: http(rpcUrl),
      });

      // Initialize lastProcessedBlock to current block - 100
      const currentBlock = await this.client.getBlockNumber();
      this.lastProcessedBlock = currentBlock - BigInt(100);

      this.logger.log(
        `BlockchainService initialized. Starting from block ${this.lastProcessedBlock}`,
      );
    } catch (error) {
      this.logger.error('Failed to initialize blockchain client', error);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollContractEvents() {
    if (!this.client) {
      this.logger.warn('Blockchain client not initialized, skipping poll');
      return;
    }

    if (this.isProcessing) {
      this.logger.debug('Already processing events, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      const currentBlock = await this.client.getBlockNumber();

      if (currentBlock <= this.lastProcessedBlock) {
        this.logger.debug('No new blocks to process');
        return;
      }

      this.logger.debug(
        `Polling events from block ${this.lastProcessedBlock + BigInt(1)} to ${currentBlock}`,
      );

      // Get all lotteries with contract addresses
      const lotteries = await this.prisma.lottery.findMany({
        where: {
          contractAddress: {
            not: null,
          },
        },
        select: {
          id: true,
          contractAddress: true,
        },
      });

      for (const lottery of lotteries) {
        if (!lottery.contractAddress) continue;

        const contractAddress = lottery.contractAddress as Address;

        await this.pollWinnerSelected(
          contractAddress,
          lottery.id,
          this.lastProcessedBlock + BigInt(1),
          currentBlock,
        );
        await this.pollMarketFailed(
          contractAddress,
          lottery.id,
          this.lastProcessedBlock + BigInt(1),
          currentBlock,
        );
        await this.pollMarketCompleted(
          contractAddress,
          lottery.id,
          this.lastProcessedBlock + BigInt(1),
          currentBlock,
        );
      }

      this.lastProcessedBlock = currentBlock;
    } catch (error) {
      this.logger.error('Error polling contract events', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async pollWinnerSelected(
    contractAddress: Address,
    lotteryId: string,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    if (!this.client) return;

    try {
      const logs = await this.client.getContractEvents({
        address: contractAddress,
        abi: waffleMarketAbi,
        eventName: 'WinnerSelected',
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const winners = (log.args as { winners?: string[] })?.winners ?? [];

        if (winners.length > 0) {
          this.logger.log(
            `WinnerSelected event detected for lottery ${lotteryId}: ${winners.join(', ')}`,
          );

          // Send win notifications to all winners
          await this.notificationService.sendWinNotification(
            winners,
            lotteryId,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error polling WinnerSelected for ${contractAddress}`,
        error,
      );
    }
  }

  private async pollMarketFailed(
    contractAddress: Address,
    lotteryId: string,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    if (!this.client) return;

    try {
      const logs = await this.client.getContractEvents({
        address: contractAddress,
        abi: waffleMarketAbi,
        eventName: 'MarketFailed',
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const reason = (log.args as { reason?: string })?.reason ?? 'Unknown';

        this.logger.log(
          `MarketFailed event detected for lottery ${lotteryId}: ${reason}`,
        );

        // Get all participant wallets for refund notification
        const participantWallets =
          await this.getParticipantWallets(contractAddress);

        if (participantWallets.length > 0) {
          await this.notificationService.sendRefundNotification(
            participantWallets,
            lotteryId,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error polling MarketFailed for ${contractAddress}`,
        error,
      );
    }
  }

  private async pollMarketCompleted(
    contractAddress: Address,
    lotteryId: string,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
    if (!this.client) return;

    try {
      const logs = await this.client.getContractEvents({
        address: contractAddress,
        abi: waffleMarketAbi,
        eventName: 'MarketCompleted',
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        this.logger.log(
          `MarketCompleted event detected for lottery ${lotteryId}`,
        );

        // Get seller wallet for completion notification
        const sellerWallet = await this.getSellerWallet(contractAddress);

        if (sellerWallet) {
          await this.notificationService.sendSaleCompleteNotification(
            sellerWallet,
            lotteryId,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error polling MarketCompleted for ${contractAddress}`,
        error,
      );
    }
  }

  /**
   * Get lottery ID by contract address (case-insensitive)
   */
  private async getLotteryIdByContract(
    contractAddress: string,
  ): Promise<string | null> {
    const lottery = await this.prisma.lottery.findFirst({
      where: {
        contractAddress: {
          equals: contractAddress,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    return lottery?.id ?? null;
  }

  /**
   * Get all participant wallet addresses from contract
   */
  private async getParticipantWallets(
    contractAddress: Address,
  ): Promise<string[]> {
    if (!this.client) return [];

    try {
      const participants = await this.client.readContract({
        address: contractAddress,
        abi: waffleMarketAbi,
        functionName: 'getParticipants',
      });

      return participants as string[];
    } catch (error) {
      this.logger.error(
        `Error getting participants for ${contractAddress}`,
        error,
      );
      return [];
    }
  }

  /**
   * Get seller wallet address from contract
   */
  private async getSellerWallet(contractAddress: Address): Promise<string | null> {
    if (!this.client) return null;

    try {
      const seller = await this.client.readContract({
        address: contractAddress,
        abi: waffleMarketAbi,
        functionName: 'seller',
      });

      return seller as string;
    } catch (error) {
      this.logger.error(`Error getting seller for ${contractAddress}`, error);
      return null;
    }
  }
}
