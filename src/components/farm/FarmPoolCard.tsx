import { useState } from 'react'
import { useAccount } from 'wagmi'
import { FarmPoolData } from '../../hooks/useFarmData'
import { MasterChefVersion } from '../../config/masterchef'
import { StakeModal } from './StakeModal'
import { HarvestModal } from './HarvestModal'

interface FarmPoolCardProps {
  data: FarmPoolData
  version: MasterChefVersion
}

export function FarmPoolCard({ data, version }: FarmPoolCardProps) {
  const { isConnected } = useAccount()
  const [showStake, setShowStake] = useState(false)
  const [showHarvest, setShowHarvest] = useState(false)

  const { pool, tvl, tvlUSD, apr, stakedAmount, pendingRewards, lpBalance } = data
  const hasStaked = parseFloat(stakedAmount) > 0
  const hasPending = parseFloat(pendingRewards) > 0

  return (
    <>
      <div className="glass-card p-5 hover:border-primary-500/30 transition-all duration-300 hover:shadow-glow">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            {/* Token Pair Icons */}
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm font-bold border-2 border-atlantis-800 z-10">
                {pool.token0.symbol.slice(0, 2)}
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-sm font-bold border-2 border-atlantis-800">
                {pool.token1.symbol.slice(0, 2)}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                {pool.token0.symbol}/{pool.token1.symbol}
              </h3>
              <span className="text-xs text-gray-400">
                V2 Pool • MasterChef {version}
              </span>
            </div>
          </div>
          
          {/* Status Badge */}
          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-atlantis-800/30 rounded-xl p-3 border border-atlantis-700/30">
            <p className="text-xs text-gray-400 mb-1">TVL</p>
            <p className="text-lg font-bold text-white">
              {parseFloat(tvl).toFixed(2)} LP
            </p>
            <p className="text-xs text-gray-500">${tvlUSD.toFixed(2)}</p>
          </div>
          
          <div className="bg-atlantis-800/30 rounded-xl p-3 border border-atlantis-700/30">
            <p className="text-xs text-gray-400 mb-1">APR</p>
            <p className="text-lg font-bold text-green-400 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
              </svg>
              {apr.toFixed(1)}%
            </p>
          </div>
          
          <div className="bg-atlantis-800/30 rounded-xl p-3 border border-atlantis-700/30">
            <p className="text-xs text-gray-400 mb-1">Your Stake</p>
            <p className="text-lg font-bold text-white">
              {parseFloat(stakedAmount).toFixed(4)}
            </p>
            <p className="text-xs text-gray-500">LP Tokens</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl p-3 border border-green-500/20">
            <p className="text-xs text-gray-400 mb-1">Rewards</p>
            <p className="text-lg font-bold text-green-400">
              {parseFloat(pendingRewards).toFixed(4)}
            </p>
            <p className="text-xs text-green-300">QUICK</p>
          </div>
        </div>

        {/* Action Buttons */}
        {!isConnected ? (
          <div className="text-center text-gray-500 py-3 bg-atlantis-800/20 rounded-xl">
            Connect wallet to stake
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowStake(true)}
              className="flex-1 py-3 gradient-button font-semibold rounded-xl"
            >
              {hasStaked ? 'Manage Stake' : 'Stake LP'}
            </button>
            
            <button
              onClick={() => setShowHarvest(true)}
              disabled={!hasPending}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                hasPending
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white hover:shadow-glow'
                  : 'bg-atlantis-700/50 text-gray-500 cursor-not-allowed'
              }`}
            >
              Harvest
            </button>
            
            <button
              className="px-4 py-3 bg-atlantis-700/50 hover:bg-atlantis-600/50 text-gray-300 hover:text-white rounded-xl font-semibold transition-all"
              title="View Pool Details"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* LP Balance Info */}
        {isConnected && parseFloat(lpBalance) > 0 && (
          <div className="mt-3 pt-3 border-t border-atlantis-700/30 flex justify-between text-sm">
            <span className="text-gray-400">Available LP Balance:</span>
            <span className="text-white font-medium">{parseFloat(lpBalance).toFixed(4)} LP</span>
          </div>
        )}
      </div>

      {/* Modals */}
      {showStake && (
        <StakeModal
          pool={pool}
          version={version}
          lpBalance={lpBalance}
          stakedAmount={stakedAmount}
          onClose={() => setShowStake(false)}
        />
      )}
      
      {showHarvest && (
        <HarvestModal
          pool={pool}
          version={version}
          pendingRewards={pendingRewards}
          onClose={() => setShowHarvest(false)}
        />
      )}
    </>
  )
}
