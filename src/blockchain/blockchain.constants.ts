import { defineChain } from 'viem';

/**
 * World Chain Sepolia testnet configuration
 */
export const worldChainSepolia = defineChain({
  id: 4801,
  name: 'World Chain Sepolia',
  network: 'world-chain-sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://worldchain-sepolia.g.alchemy.com/public'],
    },
    public: {
      http: ['https://worldchain-sepolia.g.alchemy.com/public'],
    },
  },
  blockExplorers: {
    default: {
      name: 'World Chain Sepolia Explorer',
      url: 'https://worldchain-sepolia.explorer.alchemy.com',
    },
  },
  testnet: true,
});

/**
 * WaffleMarket contract ABI (events only for polling)
 * Source: wffl-front/src/contracts/generated.ts
 */
export const waffleMarketAbi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'participant',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'Entered',
  },
  { type: 'event', anonymous: false, inputs: [], name: 'MarketCompleted' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'reason',
        internalType: 'string',
        type: 'string',
        indexed: false,
      },
    ],
    name: 'MarketFailed',
  },
  { type: 'event', anonymous: false, inputs: [], name: 'MarketOpen' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'winners',
        internalType: 'address[]',
        type: 'address[]',
        indexed: false,
      },
    ],
    name: 'WinnerSelected',
  },
  // Read functions needed for event context
  {
    type: 'function',
    inputs: [],
    name: 'seller',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getParticipants',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getWinners',
    outputs: [{ name: '', internalType: 'address[]', type: 'address[]' }],
    stateMutability: 'view',
  },
] as const;
