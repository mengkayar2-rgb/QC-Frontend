import { useState } from 'react'
import { useAccount } from 'wagmi'
import { MasterChefVersion } from '../../config/masterchef'
import { useFarmPools, useFarmStats } from '../../hooks/useFarmData'
import { MasterChefSelector } from './MasterChefSelector'
import { FarmPoolCard } from './FarmPoolCard'

export function FarmPage() {
  const { isConnected } = useAccount()
  const [version, setVersion] = useState<MasterChefVersion>('V1')
  
  const { pools, isLoading } = useFarmPools(version)
  const { poolCount, totalStaked, rewardToken } = useFarmStats(version)

  // Calculate total user rewards
  const totalPendingRewards = pools.reduce((sum, p) => sum + parseFloat(p.pendingRewards), 0)
  const totalUserStaked = pools.reduce((sum, p) => sum + parseFloat(p.stakedAmount), 0)

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold gradient-text">🌾 Farm</h1>
          <p className="text-gray-400 text-sm mt-1">Stake LP tokens to earn QUICK rewards</p>
        </div>
        <MasterChefSelector value={version} onChange={setVersion} />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Active Pools</p>
          <p className="text-2xl font-bold text-white">{poolCount}</p>
        </div>
        
        <div className="glass-card p-4">
          <p className="text-xs text-gray-400 mb-1">Total Staked</p>
          <p className="text-2xl font-bold text-white">
            {parseFloat(totalStaked).toFixed(2)} LP
          </p>
        </div>
        
        {isConnected && (
          <>
            <div className="glass-card p-4">
              <p className="text-xs text-gray-400 mb-1">Your Stake</p>
              <p className="text-2xl font-bold text-primary-400">
                {totalUserStaked.toFixed(4)} LP
              </p>
            </div>
            
            <div className="glass-card p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
              <p className="text-xs text-gray-400 mb-1">Pending Rewards</p>
              <p className="text-2xl font-bold text-green-400">
                {totalPendingRewards.toFixed(4)} {rewardToken}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Info Banner */}
      <div className="glass-card p-4 mb-6 bg-gradient-to-r from-primary-500/5 to-secondary-500/5 border-primary-500/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-white font-medium">How to Farm</p>
            <p className="text-sm text-gray-400 mt-1">
              1. Add liquidity to get LP tokens → 2. Stake LP tokens here → 3. Earn QUICK rewards → 4. Harvest anytime!
            </p>
          </div>
        </div>
      </div>

      {/* Farm Pools */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="glass-card p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Loading farms...</p>
          </div>
        ) : pools.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <span className="text-4xl mb-4 block">🌱</span>
            <p className="text-white font-medium">No farms available yet</p>
            <p className="text-sm text-gray-400 mt-2">Check back soon for new farming opportunities!</p>
          </div>
        ) : (
          pools.map((poolData, index) => (
            <FarmPoolCard
              key={`${poolData.pool.lpToken}-${index}`}
              data={poolData}
              version={version}
            />
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>MasterChef {version} • Rewards: {rewardToken}</p>
      </div>
    </div>
  )
}
