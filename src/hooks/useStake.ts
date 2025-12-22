import { useState, useCallback, useEffect } from 'react'
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useReadContract,
} from 'wagmi'
import { parseUnits, maxUint256, formatUnits } from 'viem'
import { MASTERCHEF_CONFIG, MasterChefVersion } from '../config/masterchef'
import { MASTERCHEF_ABI, ERC20_ABI } from '../config/abis'

// Debug logger
const DEBUG = true
const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[useStake]', ...args)
}

// Zero address constant
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

interface TxResult {
  success: boolean
  hash?: string
  error?: string
}

export function useStake(version: MasterChefVersion, pid: number = 0) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  
  const config = MASTERCHEF_CONFIG[version]
  const pool = config.pools[pid]

  const [isProcessing, setIsProcessing] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({})
  const [poolVerified, setPoolVerified] = useState(false)
  const [poolError, setPoolError] = useState<string | null>(null)

  // Check allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: pool.lpToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, config.address] : undefined,
    query: { enabled: !!address },
  })

  // Check LP balance
  const { data: lpBalance } = useReadContract({
    address: pool.lpToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // Debug info
  useEffect(() => {
    const info = {
      version,
      pid,
      userAddress: address,
      masterChefAddress: config.address,
      lpTokenAddress: pool.lpToken,
      allowance: allowance ? formatUnits(allowance, 18) : '0',
      lpBalance: lpBalance ? formatUnits(lpBalance, 18) : '0',
    }
    setDebugInfo(info)
    log('🔧 Config:', info)
  }, [version, pid, address, config.address, pool.lpToken, allowance, lpBalance])

  // Get fresh nonce
  const getFreshNonce = useCallback(async (): Promise<number> => {
    if (!publicClient || !address) throw new Error('Not connected')
    
    const nonce = await publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    })
    log('📊 Fresh nonce:', nonce)
    return nonce
  }, [publicClient, address])

  // Estimate gas with buffer
  const estimateGasWithBuffer = useCallback(async (
    contractAddress: `0x${string}`,
    abi: readonly unknown[],
    functionName: string,
    args: readonly unknown[]
  ): Promise<bigint> => {
    if (!publicClient || !address) return BigInt(500_000)
    
    try {
      const estimated = await publicClient.estimateContractGas({
        address: contractAddress,
        abi,
        functionName,
        args,
        account: address,
      })
      // 80% buffer for Monad
      const withBuffer = (estimated * 180n) / 100n
      log('⛽ Gas estimated:', estimated.toString(), '→ with buffer:', withBuffer.toString())
      return withBuffer
    } catch (err) {
      log('⚠️ Gas estimation failed, using 500k default')
      return BigInt(500_000)
    }
  }, [publicClient, address])

  // Wait for tx with timeout
  const waitForTx = useCallback(async (hash: `0x${string}`, timeoutMs = 120000): Promise<boolean> => {
    if (!publicClient) return false
    
    log('⏳ Waiting for tx:', hash)
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash })
        if (receipt) {
          log('✅ Tx confirmed:', receipt.status)
          return receipt.status === 'success'
        }
      } catch {
        // Tx not found yet, continue waiting
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    
    log('⏰ Tx timeout')
    return false
  }, [publicClient])

  // Verify pool exists in MasterChef
  const verifyPool = useCallback(async (): Promise<boolean> => {
    if (!publicClient) {
      setPoolError('Public client not available')
      return false
    }

    log('🔍 Verifying pool configuration...')
    setPoolError(null)

    try {
      // Check pool length
      const poolLength = await publicClient.readContract({
        address: config.address,
        abi: MASTERCHEF_ABI,
        functionName: 'poolLength',
      }) as bigint

      log('📊 Pool length:', poolLength.toString())

      if (BigInt(pid) >= poolLength) {
        const error = `Pool ID ${pid} does not exist. MasterChef only has ${poolLength} pools.`
        log('❌', error)
        setPoolError(error)
        return false
      }

      // Check pool info
      const poolInfo = await publicClient.readContract({
        address: config.address,
        abi: MASTERCHEF_ABI,
        functionName: 'poolInfo',
        args: [BigInt(pid)],
      }) as [string, bigint, bigint, bigint]

      const [lpToken, allocPoint] = poolInfo
      log('📊 Pool info:', { lpToken, allocPoint: allocPoint.toString() })

      if (lpToken.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
        const error = `Pool ${pid} has zero address LP token. Pool not properly configured.`
        log('❌', error)
        setPoolError(error)
        return false
      }

      // Verify LP token matches config
      if (lpToken.toLowerCase() !== pool.lpToken.toLowerCase()) {
        const error = `LP token mismatch! Contract: ${lpToken}, Config: ${pool.lpToken}`
        log('⚠️', error)
        // This is a warning, not a blocking error
      }

      if (allocPoint === 0n) {
        const error = `Pool ${pid} has 0 allocation points. No rewards will be distributed.`
        log('⚠️', error)
        // This is a warning, not a blocking error
      }

      log('✅ Pool verified successfully!')
      setPoolVerified(true)
      return true

    } catch (err: unknown) {
      const error = err as Error
      const msg = `Pool verification failed: ${error.message}`
      log('❌', msg)
      setPoolError(msg)
      return false
    }
  }, [publicClient, config.address, pid, pool.lpToken])

  // Auto-verify pool on mount
  useEffect(() => {
    if (publicClient && !poolVerified && !poolError) {
      verifyPool()
    }
  }, [publicClient, poolVerified, poolError, verifyPool])

  // Approve with retry
  const approve = useCallback(async (): Promise<TxResult> => {
    log('🚀 Starting APPROVE...')
    
    if (!walletClient || !address || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsApproving(true)
    setTxError(null)
    setIsSuccess(false)

    try {
      const nonce = await getFreshNonce()
      const gas = await estimateGasWithBuffer(
        pool.lpToken,
        ERC20_ABI,
        'approve',
        [config.address, maxUint256]
      )

      log('📤 Sending approve tx:', {
        lpToken: pool.lpToken,
        spender: config.address,
        nonce,
        gas: gas.toString(),
      })

      const hash = await walletClient.writeContract({
        address: pool.lpToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [config.address, maxUint256],
        gas,
        nonce,
      })

      log('✅ Approve tx sent:', hash)
      setTxHash(hash)

      // Wait for confirmation
      const confirmed = await waitForTx(hash)
      
      if (confirmed) {
        log('✅ Approve confirmed!')
        await new Promise(r => setTimeout(r, 3000)) // Extra wait
        await refetchAllowance()
        setIsSuccess(true)
        return { success: true, hash }
      } else {
        return { success: false, error: 'Approval not confirmed' }
      }

    } catch (err: unknown) {
      const error = err as Error & { shortMessage?: string }
      log('❌ Approve error:', error)
      const msg = error?.shortMessage || error?.message || 'Approval failed'
      setTxError(msg)
      return { success: false, error: msg }
    } finally {
      setIsApproving(false)
    }
  }, [walletClient, address, publicClient, pool.lpToken, config.address, getFreshNonce, estimateGasWithBuffer, waitForTx, refetchAllowance])

  // Stake with retry mechanism
  const stake = useCallback(async (amount: string, retries = 3): Promise<TxResult> => {
    log('🚀 Starting STAKE...', { amount, retries })
    
    if (!walletClient || !address || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Invalid amount' }
    }

    // Verify pool first
    if (!poolVerified) {
      log('🔍 Pool not verified, verifying now...')
      const isValid = await verifyPool()
      if (!isValid) {
        return { success: false, error: poolError || 'Pool verification failed' }
      }
    }

    setIsProcessing(true)
    setTxError(null)
    setIsSuccess(false)

    const amountWei = parseUnits(amount, 18)
    log('📊 Amount:', amount, '→ Wei:', amountWei.toString())

    // Validate balance
    if (lpBalance && amountWei > lpBalance) {
      setIsProcessing(false)
      return { success: false, error: 'Insufficient LP balance' }
    }

    // Check allowance
    if (!allowance || allowance < amountWei) {
      setIsProcessing(false)
      return { success: false, error: 'Please approve LP tokens first' }
    }

    let lastError = ''
    let backoffMs = 3000

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        log(`📤 Stake attempt ${attempt}/${retries}`)
        
        // Get fresh nonce for each attempt
        const nonce = await getFreshNonce()
        
        // Estimate gas
        const gas = await estimateGasWithBuffer(
          config.address,
          MASTERCHEF_ABI,
          'deposit',
          [BigInt(pid), amountWei]
        )

        // Get current gas price with 30% premium
        const gasPrice = await publicClient.getGasPrice()
        const gasPriceWithPremium = (gasPrice * 130n) / 100n

        log('📤 Sending stake tx:', {
          masterChef: config.address,
          pid,
          amount: amountWei.toString(),
          nonce,
          gas: gas.toString(),
          gasPrice: gasPriceWithPremium.toString(),
        })

        const hash = await walletClient.writeContract({
          address: config.address,
          abi: MASTERCHEF_ABI,
          functionName: 'deposit',
          args: [BigInt(pid), amountWei],
          gas,
          nonce,
          gasPrice: gasPriceWithPremium,
        })

        log('✅ Stake tx sent:', hash)
        setTxHash(hash)

        // Wait for confirmation with longer timeout
        const confirmed = await waitForTx(hash, 180000) // 3 minutes

        if (confirmed) {
          log('✅ Stake confirmed!')
          setIsSuccess(true)
          setIsProcessing(false)
          return { success: true, hash }
        } else {
          lastError = 'Transaction not confirmed in time'
          log('⚠️ Tx not confirmed, will retry...')
        }

      } catch (err: unknown) {
        const error = err as Error & { shortMessage?: string }
        lastError = error?.shortMessage || error?.message || 'Stake failed'
        log(`❌ Attempt ${attempt} failed:`, lastError)

        // Check if it's a dropped/replaced error
        if (lastError.includes('dropped') || lastError.includes('replaced') || lastError.includes('nonce')) {
          log(`⏳ Waiting ${backoffMs}ms before retry...`)
          await new Promise(r => setTimeout(r, backoffMs))
          backoffMs *= 2 // Exponential backoff
          continue
        }

        // For other errors, don't retry
        break
      }
    }

    setTxError(lastError)
    setIsProcessing(false)
    return { success: false, error: lastError }
  }, [walletClient, address, publicClient, lpBalance, allowance, config.address, pid, getFreshNonce, estimateGasWithBuffer, waitForTx])

  // Unstake with retry mechanism
  const unstake = useCallback(async (amount: string, retries = 3): Promise<TxResult> => {
    log('🚀 Starting UNSTAKE...', { amount, retries })
    
    if (!walletClient || !address || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (!amount || parseFloat(amount) <= 0) {
      return { success: false, error: 'Invalid amount' }
    }

    setIsProcessing(true)
    setTxError(null)
    setIsSuccess(false)

    const amountWei = parseUnits(amount, 18)
    let lastError = ''
    let backoffMs = 3000

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        log(`📤 Unstake attempt ${attempt}/${retries}`)
        
        const nonce = await getFreshNonce()
        const gas = await estimateGasWithBuffer(
          config.address,
          MASTERCHEF_ABI,
          'withdraw',
          [BigInt(pid), amountWei]
        )

        const gasPrice = await publicClient.getGasPrice()
        const gasPriceWithPremium = (gasPrice * 130n) / 100n

        const hash = await walletClient.writeContract({
          address: config.address,
          abi: MASTERCHEF_ABI,
          functionName: 'withdraw',
          args: [BigInt(pid), amountWei],
          gas,
          nonce,
          gasPrice: gasPriceWithPremium,
        })

        log('✅ Unstake tx sent:', hash)
        setTxHash(hash)

        const confirmed = await waitForTx(hash, 180000)

        if (confirmed) {
          log('✅ Unstake confirmed!')
          setIsSuccess(true)
          setIsProcessing(false)
          return { success: true, hash }
        } else {
          lastError = 'Transaction not confirmed in time'
        }

      } catch (err: unknown) {
        const error = err as Error & { shortMessage?: string }
        lastError = error?.shortMessage || error?.message || 'Unstake failed'
        log(`❌ Attempt ${attempt} failed:`, lastError)

        if (lastError.includes('dropped') || lastError.includes('replaced') || lastError.includes('nonce')) {
          await new Promise(r => setTimeout(r, backoffMs))
          backoffMs *= 2
          continue
        }
        break
      }
    }

    setTxError(lastError)
    setIsProcessing(false)
    return { success: false, error: lastError }
  }, [walletClient, address, publicClient, config.address, pid, getFreshNonce, estimateGasWithBuffer, waitForTx])

  const needsApproval = useCallback((amount: string) => {
    if (!amount || !allowance) return true
    try {
      const amountWei = parseUnits(amount, 18)
      return allowance < amountWei
    } catch {
      return true
    }
  }, [allowance])

  const reset = useCallback(() => {
    setTxError(null)
    setTxHash(null)
    setIsSuccess(false)
  }, [])

  return {
    stake,
    unstake,
    approve,
    needsApproval,
    isPending: isProcessing,
    isApproving,
    isConfirming: isProcessing,
    isSuccess,
    error: txError,
    reset,
    refetchAllowance,
    hash: txHash,
    allowance: allowance ? formatUnits(allowance, 18) : '0',
    lpBalance: lpBalance ? formatUnits(lpBalance, 18) : '0',
    debugInfo,
    poolVerified,
    poolError,
    verifyPool,
  }
}
