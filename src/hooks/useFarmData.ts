import { useQuery } from '@tanstack/react-query'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { MASTERCHEF_CONFIG, MasterChefVersion } from '../config/masterchef'
import { SUBGRAPH_URL } from '../config/contracts'
import { ERC20_ABI, MASTERCHEF_ABI } from '../config/abis'

// Extended MasterChef ABI for userInfo
const MASTERCHEF_EXTENDED_ABI = [
  ...MASTERCHEF_ABI,
  {
    inputs: [{ name: '_pid', type: 'uint256' }, { name: '_user', type: 'address' }],
    name: 'userInfo',
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'rewardDebt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'poolInfo',
    outputs: [
      { name: 'lpToken', type: 'address' },
      { name: 'allocPoint', type: 'uint256' },
      { name: 'lastRewardBlock', type: 'uint256' },
      { name: 'accQuickPerShare', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalAllocPoint',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'quickPerBlock',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
] as const

async function querySubgraph(query: string) {
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const result = await response.json()
  if (result.errors) throw new Error(result.errors[0].message)
  return result.data
}

export interface PoolInfo {
  pid: number
  lpToken: `0x${string}`
  token0: { symbol: string; address: string }
  token1: { symbol: string; address: string }
  allocPoint: number
  isNative: boolean
}

export interface FarmPoolData {
  pool: PoolInfo
  tvl: string
  tvlUSD: number
  apr: number
  stakedAmount: string
  pendingRewards: string
  lpBalance: string
  totalStaked: string
}

export function useFarmPools(version: MasterChefVersion) {
  const { address } = useAccount()
  const config = MASTERCHEF_CONFIG[version]
  
  // Get pool data from subgraph
  const { data: subgraphData } = useQuery({
    queryKey: ['farmPools', version],
    queryFn: async () => {
      const data = await querySubgraph(`{
        pairs(where: { id: "${config.pools[0].lpToken.toLowerCase()}" }) {
          id
          reserve0
          reserve1
          totalSupply
          token0Price
          token1Price
        }
      }`)
      return data?.pairs?.[0] || null
    },
    refetchInterval: 15000,
  })

  // Get user's LP balance
  const { data: lpBalance } = useReadContract({
    address: config.pools[0].lpToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Get user's staked amount
  const { data: userInfo } = useReadContract({
    address: config.address,
    abi: MASTERCHEF_EXTENDED_ABI,
    functionName: 'userInfo',
    args: address ? [0n, address] : undefined,
    query: { enabled: !!address }
  })

  // Get pending rewards
  const { data: pendingRewards } = useReadContract({
    address: config.address,
    abi: MASTERCHEF_ABI,
    functionName: 'pendingQuick',
    args: address ? [0n, address] : undefined,
    query: { enabled: !!address }
  })

  // Get total staked in MasterChef
  const { data: totalStaked } = useReadContract({
    address: config.pools[0].lpToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [config.address],
  })

  // Calculate TVL and APR
  const tvl = totalStaked ? formatUnits(totalStaked, 18) : '0'
  const reserve0 = subgraphData?.reserve0 ? parseFloat(subgraphData.reserve0) : 0
  const reserve1 = subgraphData?.reserve1 ? parseFloat(subgraphData.reserve1) : 0
  const totalSupply = subgraphData?.totalSupply ? parseFloat(subgraphData.totalSupply) : 1
  
  // Estimate TVL in USD (using QUICK price estimate)
  const quickPrice = 0.5 // Placeholder - should come from oracle
  const monPrice = 1.0 // Placeholder
  const lpPrice = totalSupply > 0 ? ((reserve0 * monPrice) + (reserve1 * quickPrice)) / totalSupply : 0
  const tvlUSD = parseFloat(tvl) * lpPrice

  // Calculate APR
  const rewardPerYear = config.rewardPerBlock * 365 * 24 * 60 * 60 / 2 // ~2 sec blocks
  const apr = tvlUSD > 0 ? (rewardPerYear * quickPrice / tvlUSD) * 100 : 0

  // Convert pool config to PoolInfo type
  const poolInfo: PoolInfo = {
    pid: config.pools[0].pid,
    lpToken: config.pools[0].lpToken,
    token0: { symbol: config.pools[0].token0.symbol, address: config.pools[0].token0.address },
    token1: { symbol: config.pools[0].token1.symbol, address: config.pools[0].token1.address },
    allocPoint: config.pools[0].allocPoint,
    isNative: config.pools[0].isNative,
  }

  const poolData: FarmPoolData = {
    pool: poolInfo,
    tvl,
    tvlUSD,
    apr: Math.min(apr, 999), // Cap at 999%
    stakedAmount: userInfo ? formatUnits(userInfo[0], 18) : '0',
    pendingRewards: pendingRewards ? formatUnits(pendingRewards, 18) : '0',
    lpBalance: lpBalance ? formatUnits(lpBalance, 18) : '0',
    totalStaked: tvl,
  }

  return {
    pools: [poolData],
    config,
    isLoading: false,
  }
}

export function useFarmStats(version: MasterChefVersion) {
  const config = MASTERCHEF_CONFIG[version]
  
  const { data: poolLength } = useReadContract({
    address: config.address,
    abi: MASTERCHEF_ABI,
    functionName: 'poolLength',
  })

  const { data: totalStaked } = useReadContract({
    address: config.pools[0].lpToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [config.address],
  })

  return {
    poolCount: poolLength ? Number(poolLength) : 0,
    totalStaked: totalStaked ? formatUnits(totalStaked, 18) : '0',
    rewardToken: config.rewardToken,
  }
}
