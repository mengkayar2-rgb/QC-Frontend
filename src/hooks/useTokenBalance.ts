import { useAccount, useBalance, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { NATIVE_ADDRESS } from '../config/tokens'
import { ERC20_ABI } from '../config/abis'

interface TokenBalanceResult {
  balance: bigint
  formatted: string
  symbol: string
  decimals: number
  isLoading: boolean
  error: Error | null
  isNative: boolean
  refetch: () => void
}

/**
 * Hook to get token balance - handles both native MON and ERC20 tokens
 * @param tokenAddress - Token address or NATIVE_ADDRESS for native MON
 * @param decimals - Token decimals (default 18)
 */
export function useTokenBalance(
  tokenAddress: `0x${string}` | undefined,
  decimals: number = 18
): TokenBalanceResult {
  const { address } = useAccount()

  // Check if this is native MON
  const isNative = tokenAddress === NATIVE_ADDRESS || tokenAddress === '0x0000000000000000000000000000000000000000'

  // Native MON balance using wagmi's useBalance
  const {
    data: nativeData,
    isLoading: nativeLoading,
    error: nativeError,
    refetch: refetchNative,
  } = useBalance({
    address,
    query: { enabled: !!address && isNative },
  })

  // ERC20 token balance using useReadContract
  const {
    data: tokenData,
    isLoading: tokenLoading,
    error: tokenError,
    refetch: refetchToken,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress && !isNative },
  })

  if (isNative) {
    return {
      balance: nativeData?.value || 0n,
      formatted: nativeData?.formatted || '0',
      symbol: 'MON',
      decimals: 18,
      isLoading: nativeLoading,
      error: nativeError,
      isNative: true,
      refetch: refetchNative,
    }
  }

  const balance = (tokenData as bigint) || 0n
  return {
    balance,
    formatted: balance ? formatUnits(balance, decimals) : '0',
    symbol: 'TOKEN',
    decimals,
    isLoading: tokenLoading,
    error: tokenError as Error | null,
    isNative: false,
    refetch: refetchToken,
  }
}

/**
 * Hook to get multiple token balances at once
 */
export function useMultipleTokenBalances() {
  const { address } = useAccount()

  // Get native balance
  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: !!address },
  })

  // For ERC20 tokens, we'd need to call useReadContract for each
  // This is a simplified version - for production, consider using multicall
  return {
    nativeBalance: nativeBalance?.value || 0n,
    nativeFormatted: nativeBalance?.formatted || '0',
  }
}
