import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { CONTRACTS } from '../config/contracts'
import { ROUTER_ABI } from '../config/abis'
import { NATIVE_ADDRESS, type Token } from '../config/tokens'

interface UseAddLiquidityResult {
  addLiquidity: (amountA: string, amountB: string) => Promise<void>
  isLoading: boolean
  isSuccess: boolean
  error: Error | null
  hash: `0x${string}` | undefined
  reset: () => void
}

/**
 * Hook to add liquidity - handles both native MON and ERC20 tokens
 * Automatically uses addLiquidityETH when one token is native MON
 */
export function useAddLiquidity(
  tokenA: Token,
  tokenB: Token,
  slippage: number = 10 // Default 10% slippage for small pools
): UseAddLiquidityResult {
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

  const addLiquidity = async (amountA: string, amountB: string) => {
    if (!address || !publicClient) {
      throw new Error('Wallet not connected')
    }

    if (!amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      throw new Error('Invalid amounts')
    }

    const amountAWei = parseUnits(amountA, tokenA.decimals)
    const amountBWei = parseUnits(amountB, tokenB.decimals)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 minutes
    const slippageMultiplier = BigInt(100 - slippage)

    // Check if either token is native MON
    const isTokenANative = tokenA.address === NATIVE_ADDRESS || tokenA.isNative
    const isTokenBNative = tokenB.address === NATIVE_ADDRESS || tokenB.isNative

    if (isTokenANative || isTokenBNative) {
      // Use addLiquidityETH for native MON
      const nativeAmount = isTokenANative ? amountAWei : amountBWei
      const tokenAmount = isTokenANative ? amountBWei : amountAWei
      const tokenAddress = isTokenANative ? tokenB.address : tokenA.address
      const minToken = (tokenAmount * slippageMultiplier) / 100n
      const minETH = (nativeAmount * slippageMultiplier) / 100n

      // Estimate gas with buffer
      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [tokenAddress, tokenAmount, minToken, minETH, address, deadline],
          value: nativeAmount,
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [tokenAddress, tokenAmount, minToken, minETH, address, deadline],
          value: nativeAmount,
          gas: (gasEstimate * 120n) / 100n, // +20% buffer
        })
      } catch (err) {
        // Fallback without gas estimation
        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidityETH',
          args: [tokenAddress, tokenAmount, minToken, minETH, address, deadline],
          value: nativeAmount,
        })
      }
    } else {
      // Standard addLiquidity for ERC20 pairs
      const minAmountA = (amountAWei * slippageMultiplier) / 100n
      const minAmountB = (amountBWei * slippageMultiplier) / 100n

      try {
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            tokenA.address,
            tokenB.address,
            amountAWei,
            amountBWei,
            minAmountA,
            minAmountB,
            address,
            deadline,
          ],
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            tokenA.address,
            tokenB.address,
            amountAWei,
            amountBWei,
            minAmountA,
            minAmountB,
            address,
            deadline,
          ],
          gas: (gasEstimate * 120n) / 100n,
        })
      } catch (err) {
        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            tokenA.address,
            tokenB.address,
            amountAWei,
            amountBWei,
            minAmountA,
            minAmountB,
            address,
            deadline,
          ],
        })
      }
    }
  }

  return {
    addLiquidity,
    isLoading: isPending || isConfirming,
    isSuccess,
    error: writeError,
    hash,
    reset,
  }
}
