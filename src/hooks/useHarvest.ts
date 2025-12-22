import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { MASTERCHEF_CONFIG, MasterChefVersion } from '../config/masterchef'
import { MASTERCHEF_ABI } from '../config/abis'

// Debug logger
const DEBUG = true
const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[useHarvest]', ...args)
}

interface TxResult {
  success: boolean
  hash?: string
  error?: string
}

export function useHarvest(version: MasterChefVersion, pid: number = 0) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const config = MASTERCHEF_CONFIG[version]

  const [isProcessing, setIsProcessing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

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
  const estimateGasWithBuffer = useCallback(
    async (
      contractAddress: `0x${string}`,
      abi: readonly unknown[],
      functionName: string,
      args: readonly unknown[]
    ): Promise<bigint> => {
      if (!publicClient || !address) return BigInt(300_000)

      try {
        const estimated = await publicClient.estimateContractGas({
          address: contractAddress,
          abi,
          functionName,
          args,
          account: address,
        })
        // 50% buffer for harvest
        const withBuffer = (estimated * 150n) / 100n
        log('⛽ Gas estimated:', estimated.toString(), '→ with buffer:', withBuffer.toString())
        return withBuffer
      } catch (err) {
        log('⚠️ Gas estimation failed, using 300k default')
        return BigInt(300_000)
      }
    },
    [publicClient, address]
  )

  // Wait for tx with timeout
  const waitForTx = useCallback(
    async (hash: `0x${string}`, timeoutMs = 120000): Promise<boolean> => {
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
        await new Promise((r) => setTimeout(r, 2000))
      }

      log('⏰ Tx timeout')
      return false
    },
    [publicClient]
  )

  // Harvest with retry mechanism (deposit 0 to claim rewards)
  const harvest = useCallback(
    async (retries = 3): Promise<TxResult> => {
      log('🚀 Starting HARVEST...', { pid, retries })

      if (!walletClient || !address || !publicClient) {
        return { success: false, error: 'Wallet not connected' }
      }

      setIsProcessing(true)
      setTxError(null)
      setIsSuccess(false)
      setStatusMessage('Preparing harvest transaction...')

      let lastError = ''
      let backoffMs = 3000

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          log(`📤 Harvest attempt ${attempt}/${retries}`)
          setStatusMessage(`Attempt ${attempt}/${retries}... Getting fresh nonce`)

          // Get fresh nonce for each attempt
          const nonce = await getFreshNonce()

          // Estimate gas
          setStatusMessage(`Estimating gas...`)
          const gas = await estimateGasWithBuffer(
            config.address,
            MASTERCHEF_ABI,
            'deposit',
            [BigInt(pid), 0n]
          )

          // Get current gas price with 30% premium
          const gasPrice = await publicClient.getGasPrice()
          const gasPriceWithPremium = (gasPrice * 130n) / 100n

          log('📤 Sending harvest tx:', {
            masterChef: config.address,
            pid,
            amount: '0 (harvest)',
            nonce,
            gas: gas.toString(),
            gasPrice: gasPriceWithPremium.toString(),
          })

          setStatusMessage('Please confirm in wallet...')

          // Harvest = deposit(pid, 0)
          const hash = await walletClient.writeContract({
            address: config.address,
            abi: MASTERCHEF_ABI,
            functionName: 'deposit',
            args: [BigInt(pid), 0n],
            gas,
            nonce,
            gasPrice: gasPriceWithPremium,
          })

          log('✅ Harvest tx sent:', hash)
          setTxHash(hash)
          setStatusMessage('Transaction sent! Waiting for confirmation (up to 2 min)...')

          // Wait for confirmation with longer timeout
          const confirmed = await waitForTx(hash, 120000) // 2 minutes

          if (confirmed) {
            log('✅ Harvest confirmed!')
            setIsSuccess(true)
            setStatusMessage('✅ Harvest successful!')
            setIsProcessing(false)
            return { success: true, hash }
          } else {
            lastError = 'Transaction not confirmed in time'
            log('⚠️ Tx not confirmed, will retry...')
            setStatusMessage(`Tx not confirmed, retrying...`)
          }
        } catch (err: unknown) {
          const error = err as Error & { shortMessage?: string }
          lastError = error?.shortMessage || error?.message || 'Harvest failed'
          log(`❌ Attempt ${attempt} failed:`, lastError)

          // Check if it's a dropped/replaced error
          if (
            lastError.includes('dropped') ||
            lastError.includes('replaced') ||
            lastError.includes('nonce')
          ) {
            log(`⏳ Waiting ${backoffMs}ms before retry...`)
            setStatusMessage(`Transaction issue, waiting ${backoffMs / 1000}s before retry...`)
            await new Promise((r) => setTimeout(r, backoffMs))
            backoffMs *= 2 // Exponential backoff
            continue
          }

          // For other errors, don't retry
          break
        }
      }

      setTxError(lastError)
      setStatusMessage(`❌ ${lastError}`)
      setIsProcessing(false)
      return { success: false, error: lastError }
    },
    [
      walletClient,
      address,
      publicClient,
      config.address,
      pid,
      getFreshNonce,
      estimateGasWithBuffer,
      waitForTx,
    ]
  )

  // Emergency withdraw (withdraws all staked LP without caring about rewards)
  const emergencyWithdraw = useCallback(async (): Promise<TxResult> => {
    log('🚨 Starting EMERGENCY WITHDRAW...', { pid })

    if (!walletClient || !address || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    setIsProcessing(true)
    setTxError(null)
    setStatusMessage('Preparing emergency withdraw...')

    try {
      const nonce = await getFreshNonce()
      const gasPrice = await publicClient.getGasPrice()
      const gasPriceWithPremium = (gasPrice * 130n) / 100n

      setStatusMessage('Please confirm emergency withdraw in wallet...')

      const hash = await walletClient.writeContract({
        address: config.address,
        abi: [
          {
            inputs: [{ name: '_pid', type: 'uint256' }],
            name: 'emergencyWithdraw',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'emergencyWithdraw',
        args: [BigInt(pid)],
        gas: BigInt(300_000),
        nonce,
        gasPrice: gasPriceWithPremium,
      })

      log('✅ Emergency withdraw tx sent:', hash)
      setTxHash(hash)
      setStatusMessage('Waiting for confirmation...')

      const confirmed = await waitForTx(hash, 120000)

      if (confirmed) {
        setIsSuccess(true)
        setStatusMessage('✅ Emergency withdraw successful!')
        setIsProcessing(false)
        return { success: true, hash }
      } else {
        const error = 'Emergency withdraw not confirmed'
        setTxError(error)
        setStatusMessage(`❌ ${error}`)
        setIsProcessing(false)
        return { success: false, error }
      }
    } catch (err: unknown) {
      const error = err as Error & { shortMessage?: string }
      const msg = error?.shortMessage || error?.message || 'Emergency withdraw failed'
      log('❌ Emergency withdraw error:', msg)
      setTxError(msg)
      setStatusMessage(`❌ ${msg}`)
      setIsProcessing(false)
      return { success: false, error: msg }
    }
  }, [walletClient, address, publicClient, config.address, pid, getFreshNonce, waitForTx])

  const reset = useCallback(() => {
    setTxError(null)
    setTxHash(null)
    setIsSuccess(false)
    setStatusMessage('')
  }, [])

  return {
    harvest,
    emergencyWithdraw,
    isPending: isProcessing,
    isConfirming: isProcessing,
    isSuccess,
    error: txError,
    reset,
    hash: txHash,
    statusMessage,
  }
}
