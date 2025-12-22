import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { CONTRACTS } from '../config/contracts'
import { ROUTER_ABI } from '../config/abis'

interface UseRemoveLiquidityResult {
  removeLiquidity: (
    lpAmount: bigint,
    token0Address: `0x${string}`,
    token1Address: `0x${string}`,
    minAmount0: bigint,
    minAmount1: bigint,
    hasWMON: boolean
  ) => Promise<void>
  isLoading: boolean
  isSuccess: boolean
  error: Error | null
  hash: `0x${string}` | undefined
  reset: () => void
}

/**
 * Hook to remove liquidity - handles both standard and ETH pairs
 * Automatically uses removeLiquidityETH when one token is WMON
 */
export function useRemoveLiquidity(slippage: number = 10): UseRemoveLiquidityResult {
  const { address } = useAccount()
  const publicClient = usePublicClient()

  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
    reset,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const removeLiquidity = async (
    lpAmount: bigint,
    token0Address: `0x${string}`,
    token1Address: `0x${string}`,
    minAmount0: bigint,
    minAmount1: bigint,
    hasWMON: boolean
  ) => {
    if (!address || !publicClient) {
      throw new Error('Wallet not connected')
    }

    if (lpAmount <= 0n) {
      throw new Error('Invalid LP amount')
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes
    const slippageMultiplier = BigInt(100 - slippage)
    const minOut0 = (minAmount0 * slippageMultiplier) / 100n
    const minOut1 = (minAmount1 * slippageMultiplier) / 100n

    if (hasWMON) {
      // Use removeLiquidityETH to get native MON back
      const isToken0WMON = token0Address.toLowerCase() === CONTRACTS.WMON.toLowerCase()
      const tokenAddress = isToken0WMON ? token1Address : token0Address
      const minTokenAmount = isToken0WMON ? minOut1 : minOut0
      const minETHAmount = isToken0WMON ? minOut0 : minOut1

      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddress, lpAmount, minTokenAmount, minETHAmount, address, deadline],
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddress, lpAmount, minTokenAmount, minETHAmount, address, deadline],
          gas: (gasEstimate * 120n) / 100n,
        })
      } catch (err) {
        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddress, lpAmount, minTokenAmount, minETHAmount, address, deadline],
        })
      }
    } else {
      // Standard removeLiquidity for ERC20 pairs
      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [token0Address, token1Address, lpAmount, minOut0, minOut1, address, deadline],
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [token0Address, token1Address, lpAmount, minOut0, minOut1, address, deadline],
          gas: (gasEstimate * 120n) / 100n,
        })
      } catch (err) {
        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [token0Address, token1Address, lpAmount, minOut0, minOut1, address, deadline],
        })
      }
    }
  }

  return {
    removeLiquidity,
    isLoading: isPending || isConfirming,
    isSuccess,
    error: writeError,
    hash,
    reset,
  }
}
