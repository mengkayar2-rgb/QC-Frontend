import { useQuery } from '@tanstack/react-query'
import { SUBGRAPH_URL } from '../config/contracts'

async function querySubgraph(query: string, variables?: Record<string, unknown>) {
  console.log('🔄 Querying subgraph:', SUBGRAPH_URL)
  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const result = await response.json()
  console.log('📥 RAW RESPONSE:', result)
  
  if (result.errors) {
    console.error('❌ Subgraph errors:', result.errors)
    throw new Error(result.errors[0].message)
  }
  return result.data
}

export function useFactoryStats() {
  return useQuery({
    queryKey: ['factoryStats'],
    queryFn: async () => {
      const data = await querySubgraph(`{
        factories(first: 1) {
          id
          pairCount
          totalVolumeMON
          totalLiquidityMON
          txCount
        }
      }`)
      console.log('📊 Factory data:', data?.factories?.[0])
      return data?.factories?.[0] || null
    },
    refetchInterval: 30000,
    retry: 2,
  })
}

export function usePairs() {
  return useQuery({
    queryKey: ['pairs'],
    queryFn: async () => {
      const data = await querySubgraph(`{
        pairs(first: 50, orderBy: txCount, orderDirection: desc) {
          id
          token0 { id symbol name }
          token1 { id symbol name }
          reserve0
          reserve1
          volumeToken0
          volumeToken1
          txCount
          totalSupply
          liquidityProviderCount
          token0Price
          token1Price
        }
      }`)
      console.log('📊 Pairs count:', data?.pairs?.length || 0)
      return data?.pairs || []
    },
    refetchInterval: 15000,
    retry: 2,
  })
}

export function useRecentSwaps() {
  return useQuery({
    queryKey: ['recentSwaps'],
    queryFn: async () => {
      const data = await querySubgraph(`{
        swaps(first: 20, orderBy: timestamp, orderDirection: desc) {
          id
          timestamp
          amount0In
          amount1In
          amount0Out
          amount1Out
          pair { token0 { symbol } token1 { symbol } }
        }
      }`)
      console.log('📊 Swaps count:', data?.swaps?.length || 0)
      return data?.swaps || []
    },
    refetchInterval: 10000,
    retry: 2,
  })
}

export function useUserPositions(userAddress: string | undefined) {
  return useQuery({
    queryKey: ['userPositions', userAddress],
    queryFn: async () => {
      if (!userAddress) return []
      const data = await querySubgraph(`{
        liquidityPositions(where: { user: "${userAddress.toLowerCase()}", liquidityTokenBalance_gt: "0" }) {
          id
          liquidityTokenBalance
          pair {
            id
            token0 { id symbol name }
            token1 { id symbol name }
            reserve0
            reserve1
            totalSupply
          }
        }
      }`)
      console.log('📊 User positions:', data?.liquidityPositions?.length || 0)
      return data?.liquidityPositions || []
    },
    enabled: !!userAddress,
    refetchInterval: 30000,
    retry: 2,
  })
}
