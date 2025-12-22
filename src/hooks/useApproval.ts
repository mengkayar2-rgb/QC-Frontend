import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { CONTRACTS } from '../config/contracts'
import { ERC20_ABI } from '../config/abis'
import { NATIVE_ADDRESS } from '../config/tokens'

interface UseApprovalResult {
  allowance: bigint
  needsApproval: boolean
  approve: () => void
  isApproving: boolean
  isApproveSuccess: boolean
  refetchAllowance: () => void
}

/**
 * Hook to check and execute token approval for the router
 * @param tokenAddress - Token address (native tokens don't need approval)
 * @param amount - Amount to approve (as string)
 * @param decimals - Token decimals
 * @param spender - Spender address (defaults to router)
 */
export function useApproval(
  tokenAddress: `0x${string}` | undefined,
  amount: string,
  decimals: number = 18,
  spender: `0x${string}` = CONTRACTS.ROUTER
): UseApprovalResult {
  const { address } = useAccount()

  // Native tokens don't need approval
  const isNative = tokenAddress === NATIVE_ADDRESS || !tokenAddress

  // Get current allowance
  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, spender] : undefined,
    query: { enabled: !!address && !!tokenAddress && !isNative },
  })

  // Write contract for approval
  const {
    writeContract,
    data: approveHash,
    isPending: isWritePending,
  } = useWriteContract()

  // Wait for approval transaction
  const { isLoading: isConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  // Calculate if approval is needed
  const amountBigInt = amount && parseFloat(amount) > 0 
    ? parseUnits(amount, decimals) 
    : 0n
  
  const currentAllowance = (allowance as bigint) || 0n
  const needsApproval = !isNative && amountBigInt > 0n && currentAllowance < amountBigInt

  // Approve function
  const approve = () => {
    if (!tokenAddress || isNative) return

    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, parseUnits('999999999999', decimals)], // Max approval
    })
  }

  return {
    allowance: currentAllowance,
    needsApproval,
    approve,
    isApproving: isWritePending || isConfirming,
    isApproveSuccess,
    refetchAllowance,
  }
}

/**
 * Hook to check approval for LP tokens (for remove liquidity)
 */
export function useLPApproval(
  lpTokenAddress: `0x${string}` | undefined,
  amount: bigint,
  spender: `0x${string}` = CONTRACTS.ROUTER
): UseApprovalResult {
  const { address } = useAccount()

  // Get current allowance
  const {
    data: allowance,
    refetch: refetchAllowance,
  } = useReadContract({
    address: lpTokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, spender] : undefined,
    query: { enabled: !!address && !!lpTokenAddress },
  })

  // Write contract for approval
  const {
    writeContract,
    data: approveHash,
    isPending: isWritePending,
  } = useWriteContract()

  // Wait for approval transaction
  const { isLoading: isConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  })

  const currentAllowance = (allowance as bigint) || 0n
  const needsApproval = amount > 0n && currentAllowance < amount

  const approve = () => {
    if (!lpTokenAddress) return

    writeContract({
      address: lpTokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, parseUnits('999999999999', 18)],
    })
  }

  return {
    allowance: currentAllowance,
    needsApproval,
    approve,
    isApproving: isWritePending || isConfirming,
    isApproveSuccess,
    refetchAllowance,
  }
}
