import { useState, useEffect } from 'react'
import { useStake } from '../../hooks/useStake'
import { MasterChefVersion, MASTERCHEF_CONFIG } from '../../config/masterchef'
import { PoolInfo } from '../../hooks/useFarmData'

interface StakeModalProps {
  pool: PoolInfo
  version: MasterChefVersion
  lpBalance: string
  stakedAmount: string
  onClose: () => void
}

// Debug Panel Component
function DebugPanel({ data }: { data: Record<string, unknown> }) {
  const [show, setShow] = useState(false)
  
  return (
    <div className="mb-4">
      <button 
        onClick={() => setShow(!show)}
        className="text-xs text-yellow-400 hover:text-yellow-300 underline"
      >
        {show ? '▼ Hide' : '▶ Show'} Debug Info
      </button>
      {show && (
        <div className="mt-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 font-mono text-xs text-yellow-300 overflow-auto max-h-48">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export function StakeModal({ pool, version, lpBalance, stakedAmount, onClose }: StakeModalProps) {
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'stake' | 'unstake'>('stake')
  const [statusMessage, setStatusMessage] = useState('')
  
  const config = MASTERCHEF_CONFIG[version]
  
  const { 
    stake, 
    unstake, 
    approve, 
    needsApproval, 
    isPending, 
    isApproving,
    isSuccess, 
    error,
    reset,
    refetchAllowance,
    debugInfo,
    allowance: hookAllowance,
    hash,
    poolVerified,
    poolError,
    verifyPool,
  } = useStake(version, pool.pid)

  const maxAmount = mode === 'stake' ? lpBalance : stakedAmount
  const requiresApproval = mode === 'stake' && needsApproval(amount)

  // Debug log on mount
  useEffect(() => {
    console.log('[StakeModal] Mounted with:', {
      pool,
      version,
      lpBalance,
      stakedAmount,
      masterChefAddress: config.address,
    })
  }, [pool, version, lpBalance, stakedAmount, config.address])

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      setStatusMessage('✅ Transaction successful!')
      setTimeout(() => {
        reset()
        onClose()
      }, 3000)
    }
  }, [isSuccess, onClose, reset])

  // Reset amount when mode changes
  useEffect(() => {
    setAmount('')
    setStatusMessage('')
  }, [mode])

  const handleMax = () => setAmount(maxAmount)
  
  const handlePercent = (pct: number) => {
    const val = (parseFloat(maxAmount) * pct / 100)
    setAmount(val > 0 ? val.toFixed(8).replace(/\.?0+$/, '') : '0')
  }

  const validateAmount = (): string | null => {
    if (!amount || amount === '') return 'Enter an amount'
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return 'Amount must be greater than 0'
    if (amountNum > parseFloat(maxAmount)) return `Insufficient ${mode === 'stake' ? 'LP' : 'staked'} balance`
    return null
  }

  const handleApprove = async () => {
    console.log('[StakeModal] 🚀 Starting approve...')
    setStatusMessage('⏳ Approving LP tokens...')
    
    const result = await approve()
    console.log('[StakeModal] Approve result:', result)
    
    if (result.success) {
      setStatusMessage('✅ Approved! Now you can stake.')
      await new Promise(r => setTimeout(r, 2000))
      await refetchAllowance()
      setStatusMessage('')
    } else {
      setStatusMessage(`❌ Approval failed: ${result.error}`)
    }
  }

  const handleStake = async () => {
    const validationError = validateAmount()
    if (validationError) {
      setStatusMessage(`❌ ${validationError}`)
      return
    }
    
    console.log('[StakeModal] 🚀 Starting stake with amount:', amount)
    setStatusMessage('⏳ Processing stake... Please wait up to 3 minutes.')
    
    const result = await stake(amount)
    console.log('[StakeModal] Stake result:', result)
    
    if (!result.success) {
      setStatusMessage(`❌ Stake failed: ${result.error}`)
    }
  }

  const handleUnstake = async () => {
    const validationError = validateAmount()
    if (validationError) {
      setStatusMessage(`❌ ${validationError}`)
      return
    }
    
    console.log('[StakeModal] 🚀 Starting unstake with amount:', amount)
    setStatusMessage('⏳ Processing unstake... Please wait up to 3 minutes.')
    
    const result = await unstake(amount)
    console.log('[StakeModal] Unstake result:', result)
    
    if (!result.success) {
      setStatusMessage(`❌ Unstake failed: ${result.error}`)
    }
  }

  const handleSubmit = async () => {
    console.log('[StakeModal] Submit clicked, mode:', mode, 'requiresApproval:', requiresApproval)
    
    if (mode === 'stake') {
      if (requiresApproval) {
        await handleApprove()
      } else {
        await handleStake()
      }
    } else {
      await handleUnstake()
    }
  }

  const isLoading = isPending || isApproving
  const validationError = validateAmount()
  const isDisabled = isLoading || (!!validationError && amount !== '')

  const getButtonText = () => {
    if (isSuccess) return '✓ Success!'
    if (isApproving) return '⏳ Approving...'
    if (isPending) return '⏳ Processing... (may take 3 min)'
    if (validationError && amount !== '') return validationError
    if (requiresApproval) return '🔓 Approve LP Token'
    return mode === 'stake' ? '🔒 Stake LP' : '🔓 Unstake LP'
  }

  // Prepare debug data
  const debugData = {
    ...debugInfo,
    modalProps: {
      poolPid: pool.pid,
      lpToken: pool.lpToken,
      lpBalance,
      stakedAmount,
      version,
    },
    currentState: {
      mode,
      amount,
      requiresApproval,
      hookAllowance,
      isLoading,
      error,
      hash,
      poolVerified,
      poolError,
    },
    contractAddresses: {
      masterChef: config.address,
      lpToken: pool.lpToken,
    },
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-card max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-atlantis-700/50">
          <div>
            <h2 className="text-xl font-bold text-white">
              {mode === 'stake' ? '🔒 Stake' : '🔓 Unstake'} LP Tokens
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {pool.token0.symbol}/{pool.token1.symbol} Pool
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white p-2 hover:bg-atlantis-700/50 rounded-lg transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Debug Panel */}
          <DebugPanel data={debugData} />

          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-atlantis-800/30 rounded-xl border border-atlantis-700/30">
            <button
              onClick={() => setMode('stake')}
              disabled={isLoading}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'stake' 
                  ? 'bg-gradient-to-r from-primary-500/20 to-secondary-500/20 text-white border border-primary-500/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Stake
            </button>
            <button
              onClick={() => setMode('unstake')}
              disabled={isLoading}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                mode === 'unstake' 
                  ? 'bg-gradient-to-r from-secondary-500/20 to-primary-500/20 text-white border border-secondary-500/30' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Unstake
            </button>
          </div>

          {/* Balance Info */}
          <div className="bg-atlantis-800/30 rounded-xl p-4 border border-atlantis-700/30">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400">
                {mode === 'stake' ? 'Available LP' : 'Staked LP'}
              </span>
              <button 
                onClick={handleMax}
                disabled={isLoading}
                className="text-primary-400 hover:text-primary-300 font-medium"
              >
                Max: {parseFloat(maxAmount).toFixed(6)} LP
              </button>
            </div>
            
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              disabled={isLoading}
              className="w-full bg-transparent text-2xl text-white outline-none font-semibold placeholder-gray-600"
            />

            {/* Quick Percent Buttons */}
            <div className="flex gap-2 mt-3">
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => handlePercent(pct)}
                  disabled={isLoading}
                  className="flex-1 py-1.5 text-xs font-medium bg-atlantis-700/50 hover:bg-atlantis-600/50 text-gray-300 hover:text-white rounded-lg transition-all disabled:opacity-50"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Contract Info */}
          <div className="bg-atlantis-900/30 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Pool</span>
              <span className="text-white">{pool.token0.symbol}/{pool.token1.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MasterChef</span>
              <span className="text-white font-mono text-xs">{config.address.slice(0, 10)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pool ID (pid)</span>
              <span className="text-white">{pool.pid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current Allowance</span>
              <span className="text-white">{parseFloat(hookAllowance).toFixed(4)}</span>
            </div>
          </div>

          {/* Pool Verification Status */}
          {poolError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm font-semibold">🚨 Pool Configuration Error</p>
              <p className="text-red-300 text-xs mt-1">{poolError}</p>
              <button 
                onClick={() => verifyPool()}
                className="text-xs text-red-300 hover:text-red-200 mt-2 underline"
              >
                Retry Verification
              </button>
            </div>
          )}

          {poolVerified && !poolError && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2">
              <p className="text-green-400 text-xs flex items-center gap-1">
                ✅ Pool verified on MasterChef
              </p>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className={`rounded-xl p-3 text-sm ${
              statusMessage.includes('✅') 
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : statusMessage.includes('❌')
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                  : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
            }`}>
              {statusMessage}
            </div>
          )}

          {/* Approval Warning */}
          {mode === 'stake' && requiresApproval && amount && parseFloat(amount) > 0 && !statusMessage && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <p className="text-yellow-400 text-sm flex items-center gap-2">
                ⚠️ LP token approval required (one-time)
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && !statusMessage && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
              <button 
                onClick={reset}
                className="text-xs text-red-300 hover:text-red-200 mt-2 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Transaction Hash */}
          {hash && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              <p className="text-blue-400 text-sm">
                📝 Tx: <a 
                  href={`https://explorer.monad.xyz/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-300"
                >
                  {hash.slice(0, 10)}...{hash.slice(-8)}
                </a>
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              isSuccess
                ? 'bg-green-500'
                : isLoading
                  ? 'bg-gray-600 cursor-wait'
                  : validationError && amount !== ''
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'gradient-button hover:shadow-glow'
            } disabled:opacity-70`}
          >
            {isLoading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            )}
            {getButtonText()}
          </button>

          {/* Processing Warning */}
          {isLoading && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
              <p className="text-yellow-400 text-xs">
                ⏳ Please wait... Monad transactions may take up to 3 minutes.
                <br/>
                Do NOT close this window or send another transaction.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
