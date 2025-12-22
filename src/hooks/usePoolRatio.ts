// hooks/usePoolRatio.ts
// Auto-ratio calculator for liquidity pools
import { useState, useEffect, useCallback } from 'react'
import { SUBGRAPH_URL, CONTRACTS } from '../config/contracts'
import { type Token, NATIVE_ADDRESS } from '../config/tokens'

interface PoolReserves {
  reserve0: string
  reserve1: string
  totalSupply: string
  token0: { id: string; symbol: string }
  token1: { id: string; symbol: string }
}

interface UsePoolRatioResult {
  ratio: number // tokenB per tokenA
  reverseRatio: number // tokenA per tokenB
  reserveA: string
  reserveB: string
  poolExists: boolean
  loading: boolean
  error: string | null
  calculateAmountB: (amountA: string) => string
  calculateAmountA: (amountB: string) => string
  refetch: () => void
}

/**
 * Hook to fetch pool reserves and calculate token ratios
 * Automatically handles token sorting (V2 pools sort by address)
 */
export function usePoolRatio(tokenA: Token | null, tokenB: Token | null): UsePoolRatioResult {
  const [reserves, setReserves] = useState<PoolReserves | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTokenAFirst, setIsTokenAFirst] = useState(true)

  // Get actual addresses (WMON for native MON)
  const getActualAddress = (token: Token): string => {
    if (token.address === NATIVE_ADDRESS || token.isNative) {
      return CONTRACTS.WMON.toLowerCase()
    }
    return token.address.toLowerCase()
  }

  // Fetch pool reserves from subgraph
  const fetchReserves = useCallback(async () => {
    if (!tokenA || !tokenB) {
      setReserves(null)
      return
    }

    const addressA = getActualAddress(tokenA)
    const addressB = getActualAddress(tokenB)

    // Skip if same token
    if (addressA === addressB) {
      setError('Same token selected')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Sort addresses to match V2 pool ordering
      const [token0Addr, token1Addr] = [addressA, addressB].sort()
      setIsTokenAFirst(addressA === token0Addr)

      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            pairs(where: { 
              token0_: { id: "${token0Addr}" }, 
              token1_: { id: "${token1Addr}" } 
            }, first: 1) {
              id
              reserve0
              reserve1
              totalSupply
              token0 { id symbol }
              token1 { id symbol }
            }
          }`,
        }),
      })

      const data = await response.json()
      
      if (data.errors) {
        throw new Error(data.errors[0].message)
      }

      if (data.data?.pairs?.[0]) {
        setReserves(data.data.pairs[0])
      } else {
        // Pool doesn't exist yet
        setReserves(null)
        setError('Pool not found - this will create a new pool')
      }
    } catch (err) {
      console.error('Failed to fetch pool reserves:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch reserves')
    } finally {
      setLoading(false)
    }
  }, [tokenA, tokenB])

  // Fetch on token change
  useEffect(() => {
    fetchReserves()
  }, [fetchReserves])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchReserves, 10000)
    return () => clearInterval(interval)
  }, [fetchReserves])

  // Calculate reserves for tokenA and tokenB based on sorting
  const reserveA = reserves 
    ? (isTokenAFirst ? reserves.reserve0 : reserves.reserve1)
    : '0'
  const reserveB = reserves 
    ? (isTokenAFirst ? reserves.reserve1 : reserves.reserve0)
    : '0'

  // Calculate ratio (tokenB per tokenA)
  const reserveANum = parseFloat(reserveA) || 0
  const reserveBNum = parseFloat(reserveB) || 0
  const ratio = reserveANum > 0 ? reserveBNum / reserveANum : 1
  const reverseRatio = reserveBNum > 0 ? reserveANum / reserveBNum : 1

  // Calculate amount B from amount A
  const calculateAmountB = useCallback((amountA: string): string => {
    if (!amountA || parseFloat(amountA) <= 0) return ''
    if (!reserves || reserveANum === 0) return amountA // New pool: 1:1 ratio
    
    const numA = parseFloat(amountA)
    const calculatedB = numA * ratio
    
    // Return with appropriate precision
    if (calculatedB < 0.000001) return calculatedB.toExponential(4)
    if (calculatedB < 1) return calculatedB.toFixed(8)
    if (calculatedB < 1000) return calculatedB.toFixed(6)
    return calculatedB.toFixed(4)
  }, [reserves, ratio, reserveANum])

  // Calculate amount A from amount B
  const calculateAmountA = useCallback((amountB: string): string => {
    if (!amountB || parseFloat(amountB) <= 0) return ''
    if (!reserves || reserveBNum === 0) return amountB // New pool: 1:1 ratio
    
    const numB = parseFloat(amountB)
    const calculatedA = numB * reverseRatio
    
    // Return with appropriate precision
    if (calculatedA < 0.000001) return calculatedA.toExponential(4)
    if (calculatedA < 1) return calculatedA.toFixed(8)
    if (calculatedA < 1000) return calculatedA.toFixed(6)
    return calculatedA.toFixed(4)
  }, [reserves, reverseRatio, reserveBNum])

  return {
    ratio,
    reverseRatio,
    reserveA,
    reserveB,
    poolExists: !!reserves,
    loading,
    error,
    calculateAmountB,
    calculateAmountA,
    refetch: fetchReserves,
  }
}
