import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Plus, ChevronDown, ArrowUpRight, Wallet, Layers, BarChart3, RefreshCw, X, Settings, Info, Minus, ExternalLink } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { CONTRACTS, SUBGRAPH_URL } from '../config/contracts'
import { ROUTER_ABI, ERC20_ABI } from '../config/abis'
import { DEFAULT_TOKENS, type Token, getStoredTokens } from '../config/tokens'
import { TokenModal } from './TokenModal'

const WMON_ADDRESS = '0x3bd359c1119da7da1d913d1c4d2b7c461115433a'
const MON_PRICE_USD = 0.50

function formatUSD(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return num.toFixed(2)
  if (num >= 0.0001) return num.toFixed(4)
  return num.toFixed(6)
}

interface PoolData {
  id: string
  token0: { id: string; symbol: string; name: string }
  token1: { id: string; symbol: string; name: string }
  reserve0: string
  reserve1: string
  volumeToken0: string
  volumeToken1: string
  txCount: string
  totalSupply: string
  liquidityProviderCount: string
}

interface PositionData { pair: PoolData; liquidityTokenBalance: string }

function calculatePoolTVL(pool: PoolData): number {
  const reserve0 = parseFloat(pool.reserve0) || 0
  const reserve1 = parseFloat(pool.reserve1) || 0
  const token0IsWMON = pool.token0.id.toLowerCase() === WMON_ADDRESS
  const token1IsWMON = pool.token1.id.toLowerCase() === WMON_ADDRESS
  if (token0IsWMON) return reserve0 * 2 * MON_PRICE_USD
  if (token1IsWMON) return reserve1 * 2 * MON_PRICE_USD
  return (reserve0 + reserve1) * MON_PRICE_USD * 0.01
}

function calculatePoolVolume(pool: PoolData): number {
  const vol0 = parseFloat(pool.volumeToken0) || 0
  const vol1 = parseFloat(pool.volumeToken1) || 0
  const token0IsWMON = pool.token0.id.toLowerCase() === WMON_ADDRESS
  const token1IsWMON = pool.token1.id.toLowerCase() === WMON_ADDRESS
  if (token0IsWMON) return vol0 * MON_PRICE_USD
  if (token1IsWMON) return vol1 * MON_PRICE_USD
  return (vol0 + vol1) * MON_PRICE_USD * 0.01
}


// Token Pair Icon - Uniswap V3 Style
function TokenPairIcon({ token0, token1, size = 'md' }: { token0: string; token1: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' }
  const textSizes = { sm: 'text-[8px]', md: 'text-xs', lg: 'text-sm' }
  const getGradient = (symbol: string) => {
    const colors: Record<string, string> = {
      'WMON': 'from-purple-500 to-indigo-600',
      'MON': 'from-purple-500 to-indigo-600',
      'QUICK': 'from-blue-500 to-cyan-500',
      'USDT': 'from-green-500 to-emerald-600',
      'USDC': 'from-blue-400 to-blue-600',
      'ETH': 'from-gray-400 to-gray-600',
    }
    return colors[symbol] || 'from-pink-500 to-purple-600'
  }
  return (
    <div className="flex -space-x-2">
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${getGradient(token0)} flex items-center justify-center ring-2 ring-[#191B1F] z-10`}>
        <span className={`${textSizes[size]} font-bold text-white`}>{token0.slice(0, 2)}</span>
      </div>
      <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${getGradient(token1)} flex items-center justify-center ring-2 ring-[#191B1F]`}>
        <span className={`${textSizes[size]} font-bold text-white`}>{token1.slice(0, 2)}</span>
      </div>
    </div>
  )
}

// Fee Badge
function FeeBadge({ fee = '0.5%' }: { fee?: string }) {
  return <span className="px-2 py-0.5 text-xs font-medium bg-[#2C2F36] text-gray-300 rounded-md">{fee}</span>
}

// Remove Liquidity Modal
function RemoveLiquidityModal({ position, onClose, onSuccess }: { position: PositionData; onClose: () => void; onSuccess: () => void }) {
  const { address } = useAccount()
  const [percent, setPercent] = useState(100)
  const pool = position.pair
  const lpBalance = parseFloat(position.liquidityTokenBalance) || 0
  const totalSupply = parseFloat(pool.totalSupply) || 1
  const reserve0 = parseFloat(pool.reserve0) || 0
  const reserve1 = parseFloat(pool.reserve1) || 0
  
  const removeAmount = (lpBalance * percent) / 100
  const token0Amount = (removeAmount / totalSupply) * reserve0
  const token1Amount = (removeAmount / totalSupply) * reserve1
  
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  
  // Check LP token allowance
  const { data: lpAllowance } = useReadContract({
    address: pool.id as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address }
  })
  
  const needsApproval = lpAllowance !== undefined ? lpAllowance < parseUnits(removeAmount.toString(), 18) : true
  
  const handleApprove = () => {
    writeContract({
      address: pool.id as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('999999999999', 18)]
    })
  }
  
  const handleRemove = () => {
    if (!address) return
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
    const liquidity = parseUnits(removeAmount.toFixed(18), 18)
    const amountAMin = parseUnits((token0Amount * 0.95).toFixed(18), 18)
    const amountBMin = parseUnits((token1Amount * 0.95).toFixed(18), 18)
    
    writeContract({
      address: CONTRACTS.ROUTER,
      abi: [{
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
          { name: 'liquidity', type: 'uint256' },
          { name: 'amountAMin', type: 'uint256' },
          { name: 'amountBMin', type: 'uint256' },
          { name: 'to', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ],
        name: 'removeLiquidity',
        outputs: [{ name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
      }] as const,
      functionName: 'removeLiquidity',
      args: [
        pool.token0.id as `0x${string}`,
        pool.token1.id as `0x${string}`,
        liquidity,
        amountAMin,
        amountBMin,
        address,
        deadline
      ]
    })
  }
  
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => { onSuccess(); onClose() }, 2000)
    }
  }, [isSuccess, onClose, onSuccess])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#191B1F] border border-[#2C2F36] rounded-3xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2C2F36]">
          <h2 className="text-lg font-semibold text-white">Remove Liquidity</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Pool Info */}
          <div className="flex items-center gap-3 p-3 bg-[#212429] rounded-xl">
            <TokenPairIcon token0={pool.token0.symbol} token1={pool.token1.symbol} />
            <div>
              <div className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</div>
              <div className="text-sm text-gray-400">LP Balance: {formatNumber(lpBalance)}</div>
            </div>
          </div>
          
          {/* Percent Slider */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Amount to remove</span>
              <span className="text-2xl font-bold text-white">{percent}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={percent}
              onChange={(e) => setPercent(parseInt(e.target.value))}
              className="w-full h-2 bg-[#2C2F36] rounded-lg appearance-none cursor-pointer accent-[#2172E5]"
            />
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setPercent(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    percent === p ? 'bg-[#2172E5] text-white' : 'bg-[#2C2F36] text-gray-400 hover:bg-[#3C3F46]'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          
          {/* Output Preview */}
          <div className="bg-[#212429] rounded-2xl p-4 space-y-3">
            <div className="text-sm text-gray-400 mb-2">You will receive</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-[8px] font-bold">{pool.token0.symbol.slice(0, 2)}</span>
                </div>
                <span className="text-white">{pool.token0.symbol}</span>
              </div>
              <span className="text-white font-medium">{formatNumber(token0Amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <span className="text-[8px] font-bold">{pool.token1.symbol.slice(0, 2)}</span>
                </div>
                <span className="text-white">{pool.token1.symbol}</span>
              </div>
              <span className="text-white font-medium">{formatNumber(token1Amount)}</span>
            </div>
          </div>
          
          {/* Action Button */}
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isPending || isConfirming}
              className="w-full py-4 bg-[#2172E5] hover:bg-[#1a5fc7] disabled:bg-[#2C2F36] disabled:text-gray-400 rounded-2xl font-semibold text-white transition-colors"
            >
              {isPending || isConfirming ? 'Approving...' : 'Approve LP Token'}
            </button>
          ) : (
            <button
              onClick={handleRemove}
              disabled={isPending || isConfirming}
              className="w-full py-4 bg-[#FF6B6B] hover:bg-[#ff5252] disabled:bg-[#2C2F36] disabled:text-gray-400 rounded-2xl font-semibold text-white transition-colors"
            >
              {isPending || isConfirming ? 'Removing...' : 'Remove Liquidity'}
            </button>
          )}
          
          {isSuccess && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center text-green-400 text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/20">
              ✓ Liquidity removed successfully!
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}


// Position Card with Remove functionality
function PositionCard({ position, onRefresh }: { position: PositionData; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const pool = position.pair
  const lpBalance = parseFloat(position.liquidityTokenBalance) || 0
  const totalSupply = parseFloat(pool.totalSupply) || 1
  const sharePercent = (lpBalance / totalSupply) * 100
  const reserve0 = parseFloat(pool.reserve0) || 0
  const reserve1 = parseFloat(pool.reserve1) || 0
  const pooledToken0 = (lpBalance / totalSupply) * reserve0
  const pooledToken1 = (lpBalance / totalSupply) * reserve1
  const positionValue = calculatePoolTVL(pool) * (lpBalance / totalSupply)

  return (
    <>
      <motion.div layout className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl overflow-hidden hover:border-[#3C3F46] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="w-full p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenPairIcon token0={pool.token0.symbol} token1={pool.token1.symbol} />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</span>
                <FeeBadge />
              </div>
              <div className="text-sm text-gray-400">Full Range</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold text-white">{formatUSD(positionValue)}</div>
              <div className="text-xs text-green-400">● In range</div>
            </div>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-[#2C2F36]"
            >
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#212429] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-[8px] font-bold">{pool.token0.symbol.slice(0, 2)}</span>
                      </div>
                      <span className="text-sm text-gray-400">{pool.token0.symbol}</span>
                    </div>
                    <div className="text-lg font-semibold text-white">{formatNumber(pooledToken0)}</div>
                  </div>
                  <div className="bg-[#212429] rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <span className="text-[8px] font-bold">{pool.token1.symbol.slice(0, 2)}</span>
                      </div>
                      <span className="text-sm text-gray-400">{pool.token1.symbol}</span>
                    </div>
                    <div className="text-lg font-semibold text-white">{formatNumber(pooledToken1)}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Pool Share</span>
                    <span className="text-white font-medium">{sharePercent.toFixed(4)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">LP Tokens</span>
                    <span className="text-white font-medium">{formatNumber(lpBalance)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <a
                    href={`https://monadexplorer.com/address/${pool.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 bg-[#2C2F36] hover:bg-[#3C3F46] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> View Pool
                  </a>
                  <button
                    onClick={() => setShowRemoveModal(true)}
                    className="flex-1 py-2.5 bg-[#FF6B6B]/20 hover:bg-[#FF6B6B]/30 text-[#FF6B6B] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Minus className="w-4 h-4" /> Remove
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      <AnimatePresence>
        {showRemoveModal && (
          <RemoveLiquidityModal
            position={position}
            onClose={() => setShowRemoveModal(false)}
            onSuccess={onRefresh}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// Pool Row
function PoolRow({ pool, onSelect }: { pool: PoolData; onSelect: () => void }) {
  const tvl = calculatePoolTVL(pool)
  const volume = calculatePoolVolume(pool)
  const apr = tvl > 0 ? ((volume * 0.005 * 365) / tvl) * 100 : 0

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(44, 47, 54, 0.5)' }}
      className="grid grid-cols-12 gap-4 px-4 py-4 items-center cursor-pointer border-b border-[#2C2F36] last:border-0"
      onClick={onSelect}
    >
      <div className="col-span-4 flex items-center gap-3">
        <TokenPairIcon token0={pool.token0.symbol} token1={pool.token1.symbol} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</span>
            <FeeBadge />
          </div>
          <div className="text-xs text-gray-500">{parseInt(pool.liquidityProviderCount || '0')} LPs</div>
        </div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-white font-medium">{formatUSD(tvl)}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-white font-medium">{formatUSD(volume)}</div>
      </div>
      <div className="col-span-2 text-right">
        <div className="text-green-400 font-medium">{apr.toFixed(2)}%</div>
      </div>
      <div className="col-span-2 text-right">
        <a
          href={`https://monadexplorer.com/address/${pool.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[#2172E5] hover:text-[#4d94ff] text-sm font-medium"
        >
          View <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  )
}


// Add Liquidity Modal - Multi-Token Support
function AddLiquidityModal({ onClose, onSuccess, preselectedPool }: { onClose: () => void; onSuccess: () => void; preselectedPool?: PoolData }) {
  const { address, isConnected } = useAccount()
  const allTokens = [...DEFAULT_TOKENS.filter(t => !t.isNative), ...getStoredTokens()]
  
  const [tokenA, setTokenA] = useState<Token>(preselectedPool 
    ? { address: preselectedPool.token0.id as `0x${string}`, symbol: preselectedPool.token0.symbol, name: preselectedPool.token0.name, decimals: 18 }
    : allTokens[0])
  const [tokenB, setTokenB] = useState<Token>(preselectedPool 
    ? { address: preselectedPool.token1.id as `0x${string}`, symbol: preselectedPool.token1.symbol, name: preselectedPool.token1.name, decimals: 18 }
    : allTokens[1])
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [showTokenModal, setShowTokenModal] = useState<'A' | 'B' | null>(null)
  
  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  
  const { data: allowanceA, refetch: refetchAllowanceA } = useReadContract({
    address: tokenA.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address && !!tokenA.address }
  })
  
  const { data: allowanceB, refetch: refetchAllowanceB } = useReadContract({
    address: tokenB.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address && !!tokenB.address }
  })
  
  const { data: balanceA } = useReadContract({
    address: tokenA.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenA.address }
  })
  
  const { data: balanceB } = useReadContract({
    address: tokenB.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenB.address }
  })
  
  const needsApprovalA = allowanceA !== undefined && amountA && parseFloat(amountA) > 0 
    ? allowanceA < parseUnits(amountA || '0', tokenA.decimals) 
    : false
  const needsApprovalB = allowanceB !== undefined && amountB && parseFloat(amountB) > 0 
    ? allowanceB < parseUnits(amountB || '0', tokenB.decimals) 
    : false
  
  const [approvalStep, setApprovalStep] = useState<'none' | 'A' | 'B'>('none')
  
  const handleApprove = (token: Token, type: 'A' | 'B') => {
    setApprovalStep(type)
    writeContract({
      address: token.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.ROUTER, parseUnits('999999999999', token.decimals)]
    })
  }
  
  const handleAddLiquidity = () => {
    if (!address || !amountA || !amountB) return
    setApprovalStep('none')
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)
    const amountAWei = parseUnits(amountA, tokenA.decimals)
    const amountBWei = parseUnits(amountB, tokenB.decimals)
    writeContract({
      address: CONTRACTS.ROUTER,
      abi: ROUTER_ABI,
      functionName: 'addLiquidity',
      args: [
        tokenA.address,
        tokenB.address,
        amountAWei,
        amountBWei,
        amountAWei * 95n / 100n,
        amountBWei * 95n / 100n,
        address,
        deadline
      ]
    })
  }
  
  const handleTokenSelect = (token: Token, type: 'A' | 'B') => {
    if (type === 'A') {
      if (token.address === tokenB.address) setTokenB(tokenA)
      setTokenA(token)
    } else {
      if (token.address === tokenA.address) setTokenA(tokenB)
      setTokenB(token)
    }
    setShowTokenModal(null)
  }
  
  // Refetch allowances after approval
  useEffect(() => {
    if (isSuccess && approvalStep !== 'none') {
      setTimeout(() => {
        if (approvalStep === 'A') refetchAllowanceA()
        if (approvalStep === 'B') refetchAllowanceB()
        reset()
        setApprovalStep('none')
      }, 1000)
    }
  }, [isSuccess, approvalStep, refetchAllowanceA, refetchAllowanceB, reset])
  
  // Close on successful liquidity add
  useEffect(() => {
    if (isSuccess && approvalStep === 'none') {
      setTimeout(() => { onSuccess(); onClose() }, 2000)
    }
  }, [isSuccess, approvalStep, onClose, onSuccess])

  const getGradient = (symbol: string) => {
    const colors: Record<string, string> = {
      'WMON': 'from-purple-500 to-indigo-600',
      'MON': 'from-purple-500 to-indigo-600',
      'QUICK': 'from-blue-500 to-cyan-500',
    }
    return colors[symbol] || 'from-pink-500 to-purple-600'
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#191B1F] border border-[#2C2F36] rounded-3xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2C2F36]">
          <h2 className="text-lg font-semibold text-white">Add Liquidity</h2>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Token A */}
          <div className="bg-[#212429] rounded-2xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">You deposit</span>
              <button 
                onClick={() => balanceA && setAmountA(formatUnits(balanceA, tokenA.decimals))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Balance: {balanceA ? parseFloat(formatUnits(balanceA, tokenA.decimals)).toFixed(4) : '0'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-3xl font-medium text-white outline-none placeholder-gray-600 min-w-0"
              />
              <button
                onClick={() => setShowTokenModal('A')}
                className="flex items-center gap-2 bg-[#2C2F36] hover:bg-[#3C3F46] rounded-2xl px-3 py-2 transition-colors shrink-0"
              >
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getGradient(tokenA.symbol)} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">{tokenA.symbol.slice(0, 2)}</span>
                </div>
                <span className="font-semibold text-white">{tokenA.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Plus Icon */}
          <div className="flex justify-center -my-1 relative z-10">
            <div className="w-10 h-10 bg-[#191B1F] border-4 border-[#212429] rounded-xl flex items-center justify-center">
              <Plus className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Token B */}
          <div className="bg-[#212429] rounded-2xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">You deposit</span>
              <button 
                onClick={() => balanceB && setAmountB(formatUnits(balanceB, tokenB.decimals))}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Balance: {balanceB ? parseFloat(formatUnits(balanceB, tokenB.decimals)).toFixed(4) : '0'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0"
                className="flex-1 bg-transparent text-3xl font-medium text-white outline-none placeholder-gray-600 min-w-0"
              />
              <button
                onClick={() => setShowTokenModal('B')}
                className="flex items-center gap-2 bg-[#2C2F36] hover:bg-[#3C3F46] rounded-2xl px-3 py-2 transition-colors shrink-0"
              >
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getGradient(tokenB.symbol)} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">{tokenB.symbol.slice(0, 2)}</span>
                </div>
                <span className="font-semibold text-white">{tokenB.symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Fee Tier */}
          <div className="bg-[#212429] rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Fee tier</span>
                <Info className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">0.5%</span>
                <span className="text-xs text-gray-500 bg-[#2C2F36] px-2 py-0.5 rounded">Best for most pairs</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {!isConnected ? (
            <button className="w-full py-4 bg-[#2C2F36] rounded-2xl font-semibold text-gray-400 cursor-not-allowed">
              Connect Wallet
            </button>
          ) : needsApprovalA ? (
            <button
              onClick={() => handleApprove(tokenA, 'A')}
              disabled={isPending || isConfirming}
              className="w-full py-4 bg-[#2172E5] hover:bg-[#1a5fc7] disabled:bg-[#2C2F36] disabled:text-gray-400 rounded-2xl font-semibold text-white transition-colors"
            >
              {isPending || isConfirming ? 'Approving...' : `Approve ${tokenA.symbol}`}
            </button>
          ) : needsApprovalB ? (
            <button
              onClick={() => handleApprove(tokenB, 'B')}
              disabled={isPending || isConfirming}
              className="w-full py-4 bg-[#2172E5] hover:bg-[#1a5fc7] disabled:bg-[#2C2F36] disabled:text-gray-400 rounded-2xl font-semibold text-white transition-colors"
            >
              {isPending || isConfirming ? 'Approving...' : `Approve ${tokenB.symbol}`}
            </button>
          ) : (
            <button
              onClick={handleAddLiquidity}
              disabled={isPending || isConfirming || !amountA || !amountB || parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0}
              className="w-full py-4 bg-[#2172E5] hover:bg-[#1a5fc7] disabled:bg-[#2C2F36] disabled:text-gray-400 rounded-2xl font-semibold text-white transition-colors"
            >
              {isPending || isConfirming ? 'Adding Liquidity...' : 'Add Liquidity'}
            </button>
          )}

          {isSuccess && approvalStep === 'none' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center text-green-400 text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/20">
              ✓ Liquidity added successfully!
            </motion.div>
          )}
        </div>

        {showTokenModal && (
          <TokenModal
            onSelect={(token) => handleTokenSelect(token, showTokenModal)}
            onClose={() => setShowTokenModal(null)}
            onImport={() => {}}
          />
        )}
      </motion.div>
    </div>
  )
}


// Main LiquidityCard Component
export function LiquidityCard() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'pools' | 'positions'>('pools')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedPool, setSelectedPool] = useState<PoolData | undefined>()
  const [pools, setPools] = useState<PoolData[]>([])
  const [positions, setPositions] = useState<PositionData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const poolsRes = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            pairs(first: 50, orderBy: txCount, orderDirection: desc) {
              id
              token0 { id symbol name }
              token1 { id symbol name }
              reserve0
              reserve1
              volumeToken0
              volumeToken1
              txCount
              totalSupply
              liquidityProviderCount
            }
          }`
        })
      })
      const poolsData = await poolsRes.json()
      if (poolsData.data?.pairs) setPools(poolsData.data.pairs)

      if (address) {
        const posRes = await fetch(SUBGRAPH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{
              user(id: "${address.toLowerCase()}") {
                liquidityPositions(where: { liquidityTokenBalance_gt: "0" }) {
                  liquidityTokenBalance
                  pair {
                    id
                    token0 { id symbol name }
                    token1 { id symbol name }
                    reserve0
                    reserve1
                    volumeToken0
                    volumeToken1
                    txCount
                    totalSupply
                    liquidityProviderCount
                  }
                }
              }
            }`
          })
        })
        const posData = await posRes.json()
        if (posData.data?.user?.liquidityPositions) setPositions(posData.data.user.liquidityPositions)
        else setPositions([])
      }
    } catch (err) {
      console.error('Failed to fetch pool data:', err)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [address])

  const totalTVL = pools.reduce((sum, p) => sum + calculatePoolTVL(p), 0)
  const totalVolume = pools.reduce((sum, p) => sum + calculatePoolVolume(p), 0)
  const totalFees = totalVolume * 0.005
  const totalLPs = pools.reduce((sum, p) => sum + parseInt(p.liquidityProviderCount || '0'), 0)

  const filteredPools = pools.filter(p =>
    p.token0.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.token1.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handlePoolSelect = (pool: PoolData) => {
    setSelectedPool(pool)
    setShowAddModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Layers className="w-4 h-4" />
            <span>TVL</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">{formatUSD(totalTVL)}</div>
        </div>
        <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Volume</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">{formatUSD(totalVolume)}</div>
        </div>
        <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            <span>Fees (0.5%)</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">{formatUSD(totalFees)}</div>
        </div>
        <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Wallet className="w-4 h-4" />
            <span>LP Providers</span>
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">{totalLPs}</div>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-[#191B1F] border border-[#2C2F36] rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-[#2C2F36]">
          <div className="flex items-center gap-1 bg-[#212429] rounded-xl p-1">
            <button
              onClick={() => setActiveTab('pools')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pools' ? 'bg-[#2C2F36] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Pools
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'positions' ? 'bg-[#2C2F36] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              My Positions {positions.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-[#2172E5] rounded text-xs">{positions.length}</span>}
            </button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={fetchData} className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setSelectedPool(undefined); setShowAddModal(true) }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#2172E5] hover:bg-[#1a5fc7] text-white font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Position
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'pools' ? (
          <div>
            <div className="p-4 border-b border-[#2C2F36]">
              <input
                type="text"
                placeholder="Search pools by token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#212429] border border-[#2C2F36] rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#2172E5] transition-colors"
              />
            </div>

            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-[#2C2F36]">
              <div className="col-span-4">Pool</div>
              <div className="col-span-2 text-right">TVL</div>
              <div className="col-span-2 text-right">Volume</div>
              <div className="col-span-2 text-right">APR</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : filteredPools.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {searchQuery ? 'No pools found' : 'No pools available'}
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  {filteredPools.map((pool) => (
                    <PoolRow key={pool.id} pool={pool} onSelect={() => handlePoolSelect(pool)} />
                  ))}
                </div>
                {/* Mobile View */}
                <div className="md:hidden p-4 space-y-3">
                  {filteredPools.map((pool) => {
                    const tvl = calculatePoolTVL(pool)
                    const volume = calculatePoolVolume(pool)
                    const apr = tvl > 0 ? ((volume * 0.005 * 365) / tvl) * 100 : 0
                    return (
                      <div
                        key={pool.id}
                        onClick={() => handlePoolSelect(pool)}
                        className="bg-[#212429] rounded-xl p-4 cursor-pointer hover:bg-[#2C2F36] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TokenPairIcon token0={pool.token0.symbol} token1={pool.token1.symbol} size="sm" />
                            <span className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</span>
                            <FeeBadge />
                          </div>
                          <span className="text-green-400 font-medium">{apr.toFixed(2)}% APR</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-400">TVL:</span> <span className="text-white">{formatUSD(tvl)}</span></div>
                          <div><span className="text-gray-400">Volume:</span> <span className="text-white">{formatUSD(volume)}</span></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-4">
            {!isConnected ? (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">Connect your wallet to view positions</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-gray-500 animate-spin" />
              </div>
            ) : positions.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">You don't have any liquidity positions</p>
                <button
                  onClick={() => { setSelectedPool(undefined); setShowAddModal(true) }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#2172E5] hover:bg-[#1a5fc7] text-white font-semibold rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Liquidity
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {positions.map((pos, i) => (
                  <PositionCard key={i} position={pos} onRefresh={fetchData} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Liquidity Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddLiquidityModal
            onClose={() => { setShowAddModal(false); setSelectedPool(undefined) }}
            onSuccess={fetchData}
            preselectedPool={selectedPool}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
