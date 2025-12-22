// MasterChef Configuration
export const MASTERCHEF_CONFIG = {
  V1: {
    address: '0x1CF67a6Ac3E049E78E6BC22642126C6AB8511d03' as `0x${string}`,
    name: 'MasterChef V1',
    rewardToken: 'QUICK',
    rewardPerBlock: 0.1, // QUICK per block
    pools: [
      {
        pid: 0,
        lpToken: '0xcf4dc3db3223ee91ff52da4e110ba8abfb943843' as `0x${string}`,
        token0: { symbol: 'WMON', address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' },
        token1: { symbol: 'QUICK', address: '0x6d42eFC8B2EC16cC61B47BfC2ABb38D570Faabb5' },
        allocPoint: 100,
        isNative: false,
      },
    ],
  },
  V2: {
    address: '0x1CF67a6Ac3E049E78E6BC22642126C6AB8511d03' as `0x${string}`, // Same for now
    name: 'MasterChef V2',
    rewardToken: 'QUICK',
    rewardPerBlock: 0.15,
    pools: [
      {
        pid: 0,
        lpToken: '0xcf4dc3db3223ee91ff52da4e110ba8abfb943843' as `0x${string}`,
        token0: { symbol: 'WMON', address: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' },
        token1: { symbol: 'QUICK', address: '0x6d42eFC8B2EC16cC61B47BfC2ABb38D570Faabb5' },
        allocPoint: 150,
        isNative: false,
      },
    ],
  },
} as const

export type MasterChefVersion = 'V1' | 'V2'
