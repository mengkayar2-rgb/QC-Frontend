// QuickSwap Monad Mainnet Contract Addresses
export const CONTRACTS = {
  FACTORY: '0x5D36Bfea5074456d383e47F5b4df12186eD6e858' as `0x${string}`,
  ROUTER: '0xa45cc7A52C5179BD24076994Ef253Eb1FB1A9929' as `0x${string}`,
  WMON: '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' as `0x${string}`,
  QUICK: '0x6d42eFC8B2EC16cC61B47BfC2ABb38D570Faabb5' as `0x${string}`,
  MASTERCHEF: '0x1CF67a6Ac3E049E78E6BC22642126C6AB8511d03' as `0x${string}`,
  WMON_QUICK_PAIR: '0xcf4dc3db3223ee91ff52da4e110ba8abfb943843' as `0x${string}`,
} as const

export const INIT_CODE_HASH = '0xc5046c562153e8288204e770fc7fec0968c4fb899ad6d483cec04005fa165600'

export const FEE = {
  TOTAL_PERCENT: 0.5,
  LP_PERCENT: 0.4,
  PROTOCOL_PERCENT: 0.1,
} as const

export const SUBGRAPH_URL = 'https://api.goldsky.com/api/public/project_cmj7jnjbsro2301stdkaz9yfm/subgraphs/quickswap-monad/v3/gn'

export const TOKENS = [
  { address: CONTRACTS.WMON, symbol: 'WMON', name: 'Wrapped MON', decimals: 18 },
  { address: CONTRACTS.QUICK, symbol: 'QUICK', name: 'QuickSwap', decimals: 18 },
]
