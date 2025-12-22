import { useEffect, useState } from 'react'
import { useHarvest } from '../../hooks/useHarvest'
import { MasterChefVersion, MASTERCHEF_CONFIG } from '../../config/masterchef'
import { PoolInfo } from '../../hooks/useFarmData'

interface HarvestModalProps {
  pool: PoolInfo
  version: MasterChefVersion
  pendingRewards: string
  onClose: () => void
}

export function HarvestModal({
  pool,
  version,
  pendingRewards,
  onClose,
}: HarvestModalProps) {
  const [showEmergency, setShowEmergency] = useState(false)
  const config = MASTERCHEF_CONFIG[version]

  const {
    harvest,
    emergencyWithdraw,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
    hash,
    statusMessage,
  } = useHarvest(version, pool.pid)

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        reset()
        onClose()
      }, 3000)
    }
  }, [isSuccess, onClose, reset])

  const handleHarvest = async () => {
    console.log('[HarvestModal] 🚀 Starting harvest...')
    console.log('[HarvestModal] Pool:', pool)
    console.log('[HarvestModal] Version:', version)
    console.log('[HarvestModal] MasterChef:', config.address)
    console.log('[HarvestModal] PID:', pool.pid)
    console.log('[HarvestModal] Pending Rewards:', pendingRewards)

    await harvest()
  }

  const handleEmergencyWithdraw = async () => {
    if (
      !confirm(
        '⚠️ Emergency Withdraw will withdraw ALL your staked LP tokens but you will LOSE any pending rewards. Are you sure?'
      )
    ) {
      return
    }
    await emergencyWithdraw()
  }

  const isLoading = isPending || isConfirming
  const rewardAmount = parseFloat(pendingRewards)
  const estimatedUSD = rewardAmount * 0.5 // Placeholder price

  const getButtonText = () => {
    if (isSuccess) return '✓ Harvested!'
    if (isPending) return 'Confirm in wallet...'
    if (isConfirming) return 'Processing...'
    if (rewardAmount <= 0) return 'No rewards to harvest'
    return '🌾 Harvest QUICK'
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-atlantis-700/50">
          <div>
            <h2 className="text-xl font-bold text-white">Harvest Rewards</h2>
            <p className="text-sm text-gray-400 mt-1">
              {pool.token0.symbol}/{pool.token1.symbol} Pool
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 hover:bg-atlantis-700/50 rounded-lg transition-all"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rewards Display */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-6 border border-green-500/20 text-center">
            <p className="text-sm text-gray-400 mb-2">Pending Rewards</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-bold text-green-400">
                {rewardAmount.toFixed(6)}
              </span>
              <span className="text-xl text-green-300">QUICK</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              ≈ ${estimatedUSD.toFixed(4)} USD
            </p>
          </div>

          {/* Info */}
          <div className="bg-atlantis-900/30 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Pool</span>
              <span className="text-white">
                {pool.token0.symbol}/{pool.token1.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MasterChef</span>
              <span className="text-white">{version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pool ID (pid)</span>
              <span className="text-white">{pool.pid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Contract</span>
              <span className="text-white font-mono text-xs">
                {config.address.slice(0, 10)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Reward Token</span>
              <span className="text-white">QUICK</span>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && !error && !isSuccess && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              <p className="text-blue-400 text-sm flex items-center gap-2">
                {isLoading && (
                  <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                )}
                {statusMessage}
              </p>
            </div>
          )}

          {/* Transaction Hash */}
          {hash && !isSuccess && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
              <p className="text-blue-400 text-sm">
                📝 Tx:{' '}
                <a
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

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
              <button
                onClick={reset}
                className="text-xs text-red-300 hover:text-red-200 mt-2 underline"
              >
                Dismiss & Try Again
              </button>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
              <p className="text-green-400 font-medium flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Rewards harvested successfully!
              </p>
              <p className="text-sm text-gray-400 mt-1">
                QUICK tokens sent to your wallet
              </p>
              {hash && (
                <a
                  href={`https://explorer.monad.xyz/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-300 hover:text-green-200 underline mt-2 inline-block"
                >
                  View transaction →
                </a>
              )}
            </div>
          )}

          {/* Harvest Button */}
          <button
            onClick={handleHarvest}
            disabled={isLoading || rewardAmount <= 0 || isSuccess}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
              isSuccess
                ? 'bg-green-500'
                : isLoading
                  ? 'bg-gray-600 cursor-wait'
                  : rewardAmount <= 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 hover:shadow-glow'
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
                ⏳ Please wait... Monad transactions may take up to 2 minutes.
                <br />
                Do NOT close this window or send another transaction.
              </p>
            </div>
          )}

          {rewardAmount <= 0 && !isSuccess && (
            <p className="text-center text-sm text-gray-500">
              No rewards to harvest yet. Stake LP tokens to earn QUICK!
            </p>
          )}

          {/* Emergency Withdraw Section */}
          <div className="pt-4 border-t border-atlantis-700/30">
            <button
              onClick={() => setShowEmergency(!showEmergency)}
              className="text-xs text-gray-500 hover:text-gray-400 underline"
            >
              {showEmergency ? '▼ Hide' : '▶ Show'} Emergency Options
            </button>

            {showEmergency && (
              <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-xs mb-3">
                  ⚠️ Emergency Withdraw will withdraw ALL your staked LP tokens
                  but you will LOSE any pending rewards. Only use if normal
                  harvest/unstake is not working.
                </p>
                <button
                  onClick={handleEmergencyWithdraw}
                  disabled={isLoading}
                  className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  🚨 Emergency Withdraw (Lose Rewards)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
