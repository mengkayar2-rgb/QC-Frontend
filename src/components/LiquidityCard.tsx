import { useState, useEffect, useCallback } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useBalance,
  usePublicClient,
} from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import {
  Plus,
  ChevronDown,
  Wallet,
  Layers,
  RefreshCw,
  X,
  Minus,
  AlertTriangle,
  TrendingUp,
  Eye,
  Zap,
  Filter,
  BarChart3,
  Users,
  DollarSign,
  Lock,
  Unlock,
  Info,
} from 'lucide-react'
import { CONTRACTS, SUBGRAPH_URL } from '../config/contracts'
import { ROUTER_ABI, ERC20_ABI } from '../config/abis'
import { TokenModal } from './TokenModal'
import { TokenImportModal } from './TokenImportModal'
import { type Token, MON_TOKEN, QUICK_TOKEN } from '../config/tokens'
import { usePoolRatio } from '../hooks/usePoolRatio'

// Constants
const WMON_ADDRESS = CONTRACTS.WMON.toLowerCase()
const MON_PRICE_USD = 0.5

function formatUSD(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

function formatNum(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return num.toFixed(4)
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

interface PositionData {
  pair: PoolData
  liquidityTokenBalance: string
}

interface FactoryStats {
  pairCount: string
  totalVolumeMON: string
  totalLiquidityMON: string
  txCount: string
}

function calculatePoolTVL(pool: PoolData): number {
  const r0 = parseFloat(pool.reserve0) || 0
  const r1 = parseFloat(pool.reserve1) || 0
  if (pool.token0.id.toLowerCase() === WMON_ADDRESS) return r0 * 2 * MON_PRICE_USD
  if (pool.token1.id.toLowerCase() === WMON_ADDRESS) return r1 * 2 * MON_PRICE_USD
  return (r0 + r1) * MON_PRICE_USD * 0.01
}

function calculatePoolVolume(pool: PoolData): number {
  const v0 = parseFloat(pool.volumeToken0) || 0
  const v1 = parseFloat(pool.volumeToken1) || 0
  if (pool.token0.id.toLowerCase() === WMON_ADDRESS) return v0 * MON_PRICE_USD
  if (pool.token1.id.toLowerCase() === WMON_ADDRESS) return v1 * MON_PRICE_USD
  return (v0 + v1) * MON_PRICE_USD * 0.01
}

// Token Icon Component
function TokenIcon({ symbol, size = 24 }: { symbol: string; size?: number }) {
  const colors: Record<string, string> = {
    WMON: 'from-purple-500 to-purple-700',
    MON: 'from-purple-400 to-purple-600',
    QUICK: 'from-blue-500 to-blue-700',
    USDC: 'from-blue-400 to-blue-600',
    MMF: 'from-pink-500 to-pink-700',
  }
  return (
    <div
      className={`bg-gradient-to-br ${colors[symbol] || 'from-gray-500 to-gray-700'} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {symbol.slice(0, 2)}
    </div>
  )
}

function TokenPairIcon({ token0, token1 }: { token0: string; token1: string }) {
  return (
    <div className="flex -space-x-2">
      <div className="z-10 ring-2 ring-[#191B1F] rounded-full">
        <TokenIcon symbol={token0} size={32} />
      </div>
      <div className="ring-2 ring-[#191B1F] rounded-full">
        <TokenIcon symbol={token1} size={32} />
      </div>
    </div>
  )
}

// Token Selector Button Component
function TokenSelectorButton({
  token,
  onClick,
  disabled,
}: {
  token: Token | null
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 bg-[#2C2F36] hover:bg-[#3C3F46] rounded-xl transition-all min-w-[120px] disabled:opacity-50"
    >
      {token ? (
        <>
          <TokenIcon symbol={token.symbol} size={24} />
          <span className="font-semibold text-white">{token.symbol}</span>
          {token.isNative && (
            <span className="text-[10px] px-1 py-0.5 bg-purple-500/30 text-purple-300 rounded">
              NATIVE
            </span>
          )}
        </>
      ) : (
        <span className="text-gray-400">Select</span>
      )}
      <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
    </button>
  )
}

// ============ POOL HEADER STATS ============
function PoolHeaderStats({ pools }: { stats: FactoryStats | null; pools: PoolData[] }) {
  // Calculate totals from pools
  const totalTVL = pools.reduce((acc, pool) => acc + calculatePoolTVL(pool), 0)
  const totalVolume = pools.reduce((acc, pool) => acc + calculatePoolVolume(pool), 0)
  const totalFees = totalVolume * 0.005 // 0.5% fee
  const totalLPs = pools.reduce((acc, pool) => acc + parseInt(pool.liquidityProviderCount || '0'), 0)

  const statItems = [
    {
      label: 'Total Value Locked',
      value: formatUSD(totalTVL),
      icon: DollarSign,
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-400',
    },
    {
      label: '24h Trading Volume',
      value: formatUSD(totalVolume),
      icon: BarChart3,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
    },
    {
      label: '24h Fees',
      value: formatUSD(totalFees),
      icon: TrendingUp,
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-400',
    },
    {
      label: 'LP Providers',
      value: totalLPs.toLocaleString(),
      icon: Users,
      gradient: 'from-orange-500/20 to-amber-500/20',
      iconColor: 'text-orange-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {statItems.map((stat) => (
        <div
          key={stat.label}
          className={`bg-gradient-to-br ${stat.gradient} backdrop-blur-sm rounded-2xl p-4 border border-slate-700/50`}
        >
          <div className="flex items-center gap-2 mb-2">
            <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            <p className="text-slate-400 text-xs">{stat.label}</p>
          </div>
          <p className="text-white text-xl font-bold">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

// ============ POOL CARD COMPONENT ============
function PoolCard({ pool }: { pool: PoolData }) {
  const tvl = calculatePoolTVL(pool)
  const volume = calculatePoolVolume(pool)
  const apr = tvl > 0 ? ((volume * 0.005 * 365) / tvl) * 100 : 0

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-blue-500/30 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TokenPairIcon token0={pool.token0.symbol} token1={pool.token1.symbol} />
          <div>
            <div className="font-semibold text-white text-lg">
              {pool.token0.symbol}/{pool.token1.symbol}
            </div>
            <div className="text-xs text-slate-400">V2 Pool • 0.5% Fee</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm px-3 py-1 bg-green-500/20 text-green-400 rounded-full font-medium">
            {apr.toFixed(1)}% APR
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">TVL</div>
          <div className="text-sm font-semibold text-white">{formatUSD(tvl)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Volume 24h</div>
          <div className="text-sm font-semibold text-white">{formatUSD(volume)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Transactions</div>
          <div className="text-sm font-semibold text-white">{parseInt(pool.txCount).toLocaleString()}</div>
        </div>
      </div>

      {/* Actions - NO REMOVE BUTTON in All Pools view */}
      <div className="flex gap-2">
        <a
          href={`https://monadscan.com/address/${pool.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl text-sm text-slate-300 hover:text-white transition-all"
        >
          <Eye className="w-4 h-4" />
          View
        </a>
      </div>
    </div>
  )
}

// ============ POSITION CARD COMPONENT ============
function PositionCard({
  position,
  onRemove,
  onAdd,
}: {
  position: PositionData
  onRemove: (position: PositionData) => void
  onAdd?: () => void
}) {
  const lpBalance = parseFloat(position.liquidityTokenBalance)
  const totalSupply = parseFloat(position.pair.totalSupply) || 1
  const sharePercent = (lpBalance / totalSupply) * 100
  const tvl = calculatePoolTVL(position.pair)
  const myValue = tvl * (lpBalance / totalSupply)
  const pooled0 = parseFloat(position.pair.reserve0) * (lpBalance / totalSupply)
  const pooled1 = parseFloat(position.pair.reserve1) * (lpBalance / totalSupply)

  // Check if staked (placeholder - would need MasterChef integration)
  const isStaked = false

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 border border-slate-700/50 hover:border-blue-500/30 transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <TokenPairIcon token0={position.pair.token0.symbol} token1={position.pair.token1.symbol} />
          <div>
            <h3 className="font-semibold text-white text-lg">
              {position.pair.token0.symbol}/{position.pair.token1.symbol}
            </h3>
            <span className="text-xs text-slate-400">V2 Pool</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isStaked && (
            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Zap size={12} /> Staked
            </span>
          )}
          <div className="text-right">
            <div className="text-lg font-bold text-white">{formatUSD(myValue)}</div>
            <div className="text-xs text-slate-500">{sharePercent.toFixed(4)}% share</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 p-3 bg-slate-900/50 rounded-xl">
        <div>
          <p className="text-slate-500 text-xs mb-1">Your Share</p>
          <p className="text-white font-semibold">{sharePercent.toFixed(4)}%</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Pooled {position.pair.token0.symbol}</p>
          <p className="text-white font-semibold">{formatNum(pooled0)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">Pooled {position.pair.token1.symbol}</p>
          <p className="text-white font-semibold">{formatNum(pooled1)}</p>
        </div>
        <div>
          <p className="text-slate-500 text-xs mb-1">LP Balance</p>
          <p className="text-white font-semibold">{formatNum(lpBalance)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onAdd}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm text-white font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
        <button
          onClick={() => onRemove(position)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-sm text-red-400 font-semibold transition-all"
        >
          <Minus className="w-4 h-4" />
          Remove
        </button>
        <a
          href={`https://monadscan.com/address/${position.pair.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl text-sm text-slate-300 hover:text-white transition-all"
        >
          <Eye className="w-4 h-4" />
          View
        </a>
        <select className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm">
          <option>Stake V2</option>
          <option>Stake V1</option>
        </select>
      </div>
    </div>
  )
}


// ============ ADD LIQUIDITY MODAL ============
function AddLiquidityModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // Token state
  const [tokenA, setTokenA] = useState<Token>(MON_TOKEN)
  const [tokenB, setTokenB] = useState<Token>(QUICK_TOKEN)
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [slippage, setSlippage] = useState(10)
  
  // Auto-ratio state
  const [isLocked, setIsLocked] = useState(true) // Lock ratio mode by default
  const [lastChanged, setLastChanged] = useState<'a' | 'b' | null>(null)

  // Modal state
  const [showTokenModalA, setShowTokenModalA] = useState(false)
  const [showTokenModalB, setShowTokenModalB] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importingFor, setImportingFor] = useState<'A' | 'B'>('A')

  // Contract interactions
  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Pool ratio hook
  const {
    ratio,
    poolExists,
    loading: ratioLoading,
    calculateAmountB,
    calculateAmountA,
    refetch: refetchRatio,
  } = usePoolRatio(tokenA, tokenB)

  // Native MON balance
  const { data: nativeBalance } = useBalance({ address })

  // Token A balance (ERC20)
  const { data: balAData } = useReadContract({
    address: tokenA.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !tokenA.isNative },
  })

  // Token B balance (ERC20)
  const { data: balBData } = useReadContract({
    address: tokenB.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !tokenB.isNative },
  })

  // Allowances (only for non-native tokens)
  const { data: allowA, refetch: refetchAllowA } = useReadContract({
    address: tokenA.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address && !tokenA.isNative },
  })

  const { data: allowB, refetch: refetchAllowB } = useReadContract({
    address: tokenB.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address && !tokenB.isNative },
  })

  // Calculate balances
  const balanceA = tokenA.isNative
    ? nativeBalance
      ? parseFloat(formatUnits(nativeBalance.value, 18))
      : 0
    : balAData
      ? parseFloat(formatUnits(balAData, tokenA.decimals))
      : 0

  const balanceB = tokenB.isNative
    ? nativeBalance
      ? parseFloat(formatUnits(nativeBalance.value, 18))
      : 0
    : balBData
      ? parseFloat(formatUnits(balBData, tokenB.decimals))
      : 0

  const amtAWei = amountA && parseFloat(amountA) > 0 ? parseUnits(amountA, tokenA.decimals) : 0n
  const amtBWei = amountB && parseFloat(amountB) > 0 ? parseUnits(amountB, tokenB.decimals) : 0n

  // Native tokens don't need approval
  const needsApproveA = !tokenA.isNative && allowA !== undefined && amtAWei > 0n && allowA < amtAWei
  const needsApproveB = !tokenB.isNative && allowB !== undefined && amtBWei > 0n && allowB < amtBWei

  const [step, setStep] = useState<'input' | 'approveA' | 'approveB' | 'add'>('input')

  // Auto-calculate when amount changes (only in locked mode)
  useEffect(() => {
    if (!isLocked || ratioLoading) return

    if (lastChanged === 'a' && amountA) {
      const calcB = calculateAmountB(amountA)
      if (calcB && calcB !== amountB) {
        setAmountB(calcB)
      }
    } else if (lastChanged === 'b' && amountB) {
      const calcA = calculateAmountA(amountB)
      if (calcA && calcA !== amountA) {
        setAmountA(calcA)
      }
    }
  }, [amountA, amountB, isLocked, lastChanged, ratioLoading, calculateAmountA, calculateAmountB])

  // Handle amount A input with auto-ratio
  const handleAmountAChange = (value: string) => {
    setLastChanged('a')
    setAmountA(value)
  }

  // Handle amount B input with auto-ratio
  const handleAmountBChange = (value: string) => {
    setLastChanged('b')
    setAmountB(value)
  }

  // Format number for display
  const formatRatioNum = (num: number): string => {
    if (num === 0) return '0'
    if (num < 0.0001) return num.toExponential(2)
    if (num < 1) return num.toFixed(6)
    if (num < 1000) return num.toFixed(4)
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(2)
  }

  // Handle token selection
  const handleSelectTokenA = (token: Token) => {
    if (token.address === tokenB.address) {
      setTokenB(tokenA)
    }
    setTokenA(token)
    setShowTokenModalA(false)
    setAmountA('')
    setAmountB('')
  }

  const handleSelectTokenB = (token: Token) => {
    if (token.address === tokenA.address) {
      setTokenA(tokenB)
    }
    setTokenB(token)
    setShowTokenModalB(false)
    setAmountA('')
    setAmountB('')
  }

  const handleImportToken = (token: Token) => {
    if (importingFor === 'A') {
      setTokenA(token)
    } else {
      setTokenB(token)
    }
    setShowImportModal(false)
  }

  // Approve Token A
  const approveA = async () => {
    setStep('approveA')
    try {
      writeContract({
        address: tokenA.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ROUTER, parseUnits('999999999', tokenA.decimals)],
      })
    } catch (err) {
      console.error('Approve A failed:', err)
      setStep('input')
    }
  }

  // Approve Token B
  const approveB = async () => {
    setStep('approveB')
    try {
      writeContract({
        address: tokenB.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ROUTER, parseUnits('999999999', tokenB.decimals)],
      })
    } catch (err) {
      console.error('Approve B failed:', err)
      setStep('input')
    }
  }

  // Add Liquidity - handles both native MON and ERC20
  const addLiquidity = async () => {
    if (!address || !amountA || !amountB || !publicClient) return
    setStep('add')

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    const slipMult = BigInt(100 - slippage)

    // Check if either token is native MON
    const isTokenANative = tokenA.isNative
    const isTokenBNative = tokenB.isNative

    try {
      if (isTokenANative || isTokenBNative) {
        // Use addLiquidityETH for native MON
        const nativeAmount = isTokenANative ? amtAWei : amtBWei
        const tokenAmount = isTokenANative ? amtBWei : amtAWei
        const tokenAddress = isTokenANative ? tokenB.address : tokenA.address
        const minToken = (tokenAmount * slipMult) / 100n
        const minETH = (nativeAmount * slipMult) / 100n

        // Estimate gas first
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
      } else {
        // Standard addLiquidity for ERC20 pairs
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'addLiquidity',
          args: [
            tokenA.address,
            tokenB.address,
            amtAWei,
            amtBWei,
            (amtAWei * slipMult) / 100n,
            (amtBWei * slipMult) / 100n,
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
            amtAWei,
            amtBWei,
            (amtAWei * slipMult) / 100n,
            (amtBWei * slipMult) / 100n,
            address,
            deadline,
          ],
          gas: (gasEstimate * 120n) / 100n, // +20% buffer
        })
      }
    } catch (err) {
      console.error('Add liquidity failed:', err)
      setStep('input')
    }
  }

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      if (step === 'approveA') {
        setTimeout(() => {
          refetchAllowA()
          reset()
          setStep('input')
        }, 2000)
      } else if (step === 'approveB') {
        setTimeout(() => {
          refetchAllowB()
          reset()
          setStep('input')
        }, 2000)
      } else if (step === 'add') {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      }
    }
  }, [isSuccess, step, refetchAllowA, refetchAllowB, reset, onSuccess, onClose])

  const canAdd =
    amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && !needsApproveA && !needsApproveB

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#2C2F36] sticky top-0 bg-[#191B1F] z-10">
            <h2 className="text-lg font-bold text-white">Add Liquidity</h2>
            <button onClick={onClose} className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Slippage Warning - Compact */}
            {slippage < 10 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-amber-400 text-xs">Low slippage ({slippage}%) - small pools need 10%+</p>
              </div>
            )}

            {/* Pool Ratio Info Panel - Compact */}
            <div className="bg-[#212429] rounded-lg p-2.5 border border-[#2C2F36]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {ratioLoading ? (
                    <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                  ) : (
                    <Info className="w-3 h-3 text-slate-400" />
                  )}
                  <span className="text-slate-400 text-xs">Pool Ratio</span>
                </div>
                
                {/* Lock/Unlock Toggle */}
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                    isLocked
                      ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Lock className="w-2.5 h-2.5" />
                      Auto
                    </>
                  ) : (
                    <>
                      <Unlock className="w-2.5 h-2.5" />
                      Manual
                    </>
                  )}
                </button>
              </div>

              {/* Ratio Display - Inline */}
              <div className="mt-1.5 flex items-center justify-between">
                {ratioLoading ? (
                  <span className="text-slate-500 text-xs">Loading...</span>
                ) : poolExists ? (
                  <>
                    <span className="text-white text-sm font-semibold">
                      1 {tokenA.symbol} = {formatRatioNum(ratio)} {tokenB.symbol}
                    </span>
                    <button
                      onClick={refetchRatio}
                      className="text-blue-400 hover:text-blue-300 p-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <span className="text-amber-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    New pool - you set ratio
                  </span>
                )}
              </div>
            </div>

            {/* Warning for Manual Mode - Compact */}
            {!isLocked && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-amber-400 text-xs">Manual mode - ensure ratio matches pool</p>
              </div>
            )}

            {/* Token A Input - Compact Style */}
            <div className="bg-[#212429] rounded-xl p-3 border border-[#2C2F36] hover:border-[#3C3F46] transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 text-xs font-medium">You pay</span>
                <button
                  onClick={() => handleAmountAChange(tokenA.isNative ? (balanceA * 0.95).toString() : balanceA.toString())}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Balance: {balanceA.toFixed(4)}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountA}
                  onChange={(e) => handleAmountAChange(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-xl text-white outline-none placeholder-gray-600 min-w-0"
                />
                <TokenSelectorButton token={tokenA} onClick={() => setShowTokenModalA(true)} />
              </div>
            </div>

            {/* Plus Icon - Compact */}
            <div className="flex justify-center -my-1 relative z-10">
              <div className="p-1.5 bg-[#191B1F] border border-[#2C2F36] rounded-lg">
                <Plus className="w-4 h-4 text-gray-500" />
              </div>
            </div>

            {/* Token B Input - Compact Style */}
            <div className="bg-[#212429] rounded-xl p-3 border border-[#2C2F36] hover:border-[#3C3F46] transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 text-xs font-medium">You pay</span>
                <button
                  onClick={() => handleAmountBChange(tokenB.isNative ? (balanceB * 0.95).toString() : balanceB.toString())}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Balance: {balanceB.toFixed(4)}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountB}
                  onChange={(e) => handleAmountBChange(e.target.value)}
                  placeholder="0.0"
                  className="flex-1 bg-transparent text-xl text-white outline-none placeholder-gray-600 min-w-0"
                />
                <TokenSelectorButton token={tokenB} onClick={() => setShowTokenModalB(true)} />
              </div>
            </div>

            {/* Slippage Settings - Compact */}
            <div className="bg-[#212429] rounded-lg p-2.5 border border-[#2C2F36]">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 text-xs">Slippage Tolerance</span>
                <span className="text-white text-sm font-semibold">{slippage}%</span>
              </div>
              <div className="flex gap-1.5">
                {[5, 10, 15, 20].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlippage(s)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-all ${
                      slippage === s
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#2C2F36] text-gray-400 hover:bg-[#3C3F46] hover:text-white'
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Info - Compact */}
            <div className="bg-[#212429] rounded-lg p-2.5 flex justify-between border border-[#2C2F36]">
              <span className="text-slate-500 text-xs">Fee Tier</span>
              <span className="text-white text-xs font-medium">0.5% (0.4% LP + 0.1% Protocol)</span>
            </div>

            {/* Native MON Info - Compact */}
            {(tokenA.isNative || tokenB.isNative) && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <p className="text-purple-400 text-xs">MON will auto-wrap to WMON</p>
              </div>
            )}

            {/* Action Buttons - Compact */}
            {!isConnected ? (
              <button className="w-full py-3 bg-[#2C2F36] rounded-xl text-gray-400 font-semibold cursor-not-allowed">
                Connect Wallet
              </button>
            ) : needsApproveA ? (
              <button
                onClick={approveA}
                disabled={isPending || isConfirming}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-semibold transition-all"
              >
                {isPending || isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Approving...
                  </span>
                ) : (
                  `Approve ${tokenA.symbol}`
                )}
              </button>
            ) : needsApproveB ? (
              <button
                onClick={approveB}
                disabled={isPending || isConfirming}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-semibold transition-all"
              >
                {isPending || isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Approving...
                  </span>
                ) : (
                  `Approve ${tokenB.symbol}`
                )}
              </button>
            ) : (
              <button
                onClick={addLiquidity}
                disabled={!canAdd || isPending || isConfirming}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-semibold transition-all"
              >
                {isPending || isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Adding Liquidity...
                  </span>
                ) : (
                  'Add Liquidity'
                )}
              </button>
            )}

            {isSuccess && step === 'add' && (
              <div className="text-center text-green-400 text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/30">
                ✓ Liquidity added successfully!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Token Selection Modals */}
      {showTokenModalA && (
        <TokenModal
          onSelect={handleSelectTokenA}
          onClose={() => setShowTokenModalA(false)}
          onImport={() => {
            setImportingFor('A')
            setShowImportModal(true)
            setShowTokenModalA(false)
          }}
        />
      )}
      {showTokenModalB && (
        <TokenModal
          onSelect={handleSelectTokenB}
          onClose={() => setShowTokenModalB(false)}
          onImport={() => {
            setImportingFor('B')
            setShowImportModal(true)
            setShowTokenModalB(false)
          }}
        />
      )}
      {showImportModal && (
        <TokenImportModal onClose={() => setShowImportModal(false)} onTokenImported={handleImportToken} />
      )}
    </>
  )
}


// ============ REMOVE LIQUIDITY MODAL ============
function RemoveLiquidityModal({
  position,
  onClose,
  onSuccess,
}: {
  position: PositionData | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  const [percentage, setPercentage] = useState(100)
  const [slippage, setSlippage] = useState(10)
  const [step, setStep] = useState<'input' | 'approve' | 'remove'>('input')

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const pairAddress = position?.pair.id as `0x${string}` | undefined

  // Get LP token balance
  const { data: lpBalance } = useReadContract({
    address: pairAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!pairAddress },
  })

  // Get LP token allowance for router
  const { data: lpAllowance, refetch: refetchAllowance } = useReadContract({
    address: pairAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.ROUTER] : undefined,
    query: { enabled: !!address && !!pairAddress },
  })

  if (!position) return null

  const totalSupply = parseFloat(position.pair.totalSupply) || 1
  const userLpBalance = lpBalance ? parseFloat(formatUnits(lpBalance, 18)) : 0
  const lpToRemoveWei = lpBalance ? (lpBalance * BigInt(percentage)) / 100n : 0n

  const sharePercent = (userLpBalance / totalSupply) * 100
  const token0Amount = parseFloat(position.pair.reserve0) * (userLpBalance / totalSupply) * (percentage / 100)
  const token1Amount = parseFloat(position.pair.reserve1) * (userLpBalance / totalSupply) * (percentage / 100)

  // Check if one of the tokens is WMON (for native ETH withdrawal)
  const isToken0WMON = position.pair.token0.id.toLowerCase() === WMON_ADDRESS
  const isToken1WMON = position.pair.token1.id.toLowerCase() === WMON_ADDRESS
  const hasWMON = isToken0WMON || isToken1WMON

  // Check if approval is needed
  const needsApproval = lpAllowance !== undefined && lpToRemoveWei > 0n && lpAllowance < lpToRemoveWei

  // Approve LP tokens
  const approveLp = async () => {
    if (!pairAddress) return
    setStep('approve')
    try {
      writeContract({
        address: pairAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ROUTER, parseUnits('999999999999', 18)],
      })
    } catch (err) {
      console.error('Approve LP failed:', err)
      setStep('input')
    }
  }

  // Remove liquidity
  const removeLiquidity = async () => {
    if (!address || !publicClient || lpToRemoveWei === 0n) return
    setStep('remove')

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)
    const slipMult = BigInt(100 - slippage)

    const minAmount0 = (parseUnits(token0Amount.toFixed(18), 18) * slipMult) / 100n
    const minAmount1 = (parseUnits(token1Amount.toFixed(18), 18) * slipMult) / 100n

    try {
      if (hasWMON) {
        // Use removeLiquidityETH to get native MON back
        const tokenAddress = isToken0WMON
          ? (position.pair.token1.id as `0x${string}`)
          : (position.pair.token0.id as `0x${string}`)
        const minTokenAmount = isToken0WMON ? minAmount1 : minAmount0
        const minETHAmount = isToken0WMON ? minAmount0 : minAmount1

        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddress, lpToRemoveWei, minTokenAmount, minETHAmount, address, deadline],
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidityETH',
          args: [tokenAddress, lpToRemoveWei, minTokenAmount, minETHAmount, address, deadline],
          gas: (gasEstimate * 120n) / 100n,
        })
      } else {
        // Standard removeLiquidity for ERC20 pairs
        const gasEstimate = await publicClient.estimateContractGas({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [
            position.pair.token0.id as `0x${string}`,
            position.pair.token1.id as `0x${string}`,
            lpToRemoveWei,
            minAmount0,
            minAmount1,
            address,
            deadline,
          ],
          account: address,
        })

        writeContract({
          address: CONTRACTS.ROUTER,
          abi: ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [
            position.pair.token0.id as `0x${string}`,
            position.pair.token1.id as `0x${string}`,
            lpToRemoveWei,
            minAmount0,
            minAmount1,
            address,
            deadline,
          ],
          gas: (gasEstimate * 120n) / 100n,
        })
      }
    } catch (err) {
      console.error('Remove liquidity failed:', err)
      setStep('input')
    }
  }

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      if (step === 'approve') {
        setTimeout(() => {
          refetchAllowance()
          reset()
          setStep('input')
        }, 2000)
      } else if (step === 'remove') {
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      }
    }
  }, [isSuccess, step, refetchAllowance, reset, onSuccess, onClose])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#191B1F] border border-[#2C2F36] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2C2F36]">
          <h2 className="text-lg font-bold text-white">Remove Liquidity</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#2C2F36] rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Pool Info */}
          <div className="flex items-center gap-3 p-3 bg-[#212429] rounded-xl border border-[#2C2F36]">
            <TokenPairIcon token0={position.pair.token0.symbol} token1={position.pair.token1.symbol} />
            <div>
              <div className="font-semibold text-white">
                {position.pair.token0.symbol}/{position.pair.token1.symbol}
              </div>
              <div className="text-xs text-gray-500">Your share: {sharePercent.toFixed(4)}%</div>
            </div>
          </div>

          {/* Amount Selector */}
          <div className="bg-[#212429] rounded-xl p-4 border border-[#2C2F36]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-400 text-sm">Amount to Remove</span>
              <span className="text-3xl font-bold text-white">{percentage}%</span>
            </div>

            <input
              type="range"
              min="1"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-[#2C2F36] rounded-lg appearance-none cursor-pointer accent-blue-500"
            />

            <div className="flex gap-2 mt-4">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setPercentage(pct)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    percentage === pct
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#2C2F36] text-gray-400 hover:bg-[#3C3F46] hover:text-white'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* You Will Receive */}
          <div className="bg-[#212429] rounded-xl p-4 border border-[#2C2F36]">
            <div className="text-sm text-gray-400 mb-3">You will receive</div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={position.pair.token0.symbol} size={24} />
                  <span className="text-white">{position.pair.token0.symbol}</span>
                  {isToken0WMON && (
                    <span className="text-[10px] px-1 py-0.5 bg-purple-500/30 text-purple-300 rounded">→ MON</span>
                  )}
                </div>
                <span className="text-white font-medium">{formatNum(token0Amount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={position.pair.token1.symbol} size={24} />
                  <span className="text-white">{position.pair.token1.symbol}</span>
                  {isToken1WMON && (
                    <span className="text-[10px] px-1 py-0.5 bg-purple-500/30 text-purple-300 rounded">→ MON</span>
                  )}
                </div>
                <span className="text-white font-medium">{formatNum(token1Amount)}</span>
              </div>
            </div>
          </div>

          {/* Slippage Settings */}
          <div className="bg-[#212429] rounded-xl p-4 border border-[#2C2F36]">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-400 text-sm">Slippage Tolerance</span>
              <span className="text-white font-semibold">{slippage}%</span>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    slippage === s
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-[#2C2F36] text-gray-400 hover:bg-[#3C3F46] hover:text-white'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>

          {/* Native MON Info */}
          {hasWMON && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 flex items-start gap-2">
              <Wallet className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-400 text-sm font-medium">Receive Native MON</p>
                <p className="text-purple-300/70 text-xs">WMON will be auto-unwrapped to native MON</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {!isConnected ? (
            <button className="w-full py-4 bg-[#2C2F36] rounded-xl text-gray-400 font-semibold cursor-not-allowed">
              Connect Wallet
            </button>
          ) : needsApproval ? (
            <button
              onClick={approveLp}
              disabled={isPending || isConfirming}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-semibold transition-all shadow-lg shadow-amber-600/20 disabled:shadow-none"
            >
              {isPending || isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Approving LP Token...
                </span>
              ) : (
                'Approve LP Token'
              )}
            </button>
          ) : (
            <button
              onClick={removeLiquidity}
              disabled={isPending || isConfirming || lpToRemoveWei === 0n}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-gray-600 disabled:to-gray-600 rounded-xl text-white font-semibold transition-all shadow-lg shadow-red-600/20 disabled:shadow-none"
            >
              {isPending || isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Removing...
                </span>
              ) : (
                `Remove ${percentage}% Liquidity`
              )}
            </button>
          )}

          {isSuccess && step === 'remove' && (
            <div className="text-center text-green-400 text-sm py-3 bg-green-500/10 rounded-xl border border-green-500/30">
              ✓ Liquidity removed successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ============ MAIN LIQUIDITY CARD COMPONENT ============
export function LiquidityCard() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'pools' | 'positions'>('positions')
  const [pools, setPools] = useState<PoolData[]>([])
  const [positions, setPositions] = useState<PositionData[]>([])
  const [factoryStats, setFactoryStats] = useState<FactoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<PositionData | null>(null)

  // Fetch factory stats
  const fetchFactoryStats = useCallback(async () => {
    try {
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            factories(first: 1) {
              pairCount
              totalVolumeMON
              totalLiquidityMON
              txCount
            }
          }`,
        }),
      })
      const data = await response.json()
      if (data.data?.factories?.[0]) {
        setFactoryStats(data.data.factories[0])
      }
    } catch (err) {
      console.error('Failed to fetch factory stats:', err)
    }
  }, [])

  // Fetch pools from subgraph
  const fetchPools = useCallback(async () => {
    try {
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            pairs(first: 20, orderBy: txCount, orderDirection: desc) {
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
          }`,
        }),
      })
      const data = await response.json()
      if (data.data?.pairs) {
        setPools(data.data.pairs)
      }
    } catch (err) {
      console.error('Failed to fetch pools:', err)
    }
  }, [])

  // Fetch user positions from subgraph
  const fetchPositions = useCallback(async () => {
    if (!address) {
      setPositions([])
      return
    }

    try {
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            liquidityPositions(where: { user: "${address.toLowerCase()}", liquidityTokenBalance_gt: "0" }) {
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
          }`,
        }),
      })
      const data = await response.json()
      if (data.data?.liquidityPositions) {
        setPositions(data.data.liquidityPositions)
      }
    } catch (err) {
      console.error('Failed to fetch positions:', err)
    }
  }, [address])

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchFactoryStats(), fetchPools(), fetchPositions()])
      setLoading(false)
    }
    load()
  }, [fetchFactoryStats, fetchPools, fetchPositions])

  // Handle remove from position card
  const handleRemoveFromPosition = (position: PositionData) => {
    setSelectedPosition(position)
    setShowRemoveModal(true)
  }

  // Refresh data after successful operations
  const handleSuccess = () => {
    fetchFactoryStats()
    fetchPools()
    fetchPositions()
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">Pool</h1>
          <p className="text-slate-400 text-sm">Provide liquidity and earn trading fees</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl text-white font-semibold transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          Add Liquidity
        </button>
      </div>

      {/* Stats Cards */}
      <PoolHeaderStats stats={factoryStats} pools={pools} />

      {/* Tabs & Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl">
          {/* ALL POOLS di KIRI */}
          <button
            onClick={() => setActiveTab('pools')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'pools' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            All Pools
          </button>
          {/* YOUR POSITIONS di KANAN */}
          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'positions' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Your Positions
            {positions.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">{positions.length}</span>
            )}
          </button>
        </div>

        <button className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-all">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filter</span>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
            <RefreshCw className="w-10 h-10 text-slate-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading pools...</p>
          </div>
        ) : activeTab === 'positions' ? (
          !isConnected ? (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
              <Wallet className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 text-lg mb-2">Connect your wallet</p>
              <p className="text-slate-500 text-sm">Connect to view your liquidity positions</p>
            </div>
          ) : positions.length > 0 ? (
            positions.map((position, idx) => (
              <PositionCard
                key={idx}
                position={position}
                onRemove={handleRemoveFromPosition}
                onAdd={() => setShowAddModal(true)}
              />
            ))
          ) : (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
              <TrendingUp className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 text-lg mb-2">No positions yet</p>
              <p className="text-slate-500 text-sm mb-6">Add liquidity to start earning trading fees</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl text-white font-semibold transition-all"
              >
                Add Liquidity
              </button>
            </div>
          )
        ) : pools.length > 0 ? (
          pools.map((pool) => <PoolCard key={pool.id} pool={pool} />)
        ) : (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 text-center border border-slate-700/50">
            <Layers className="w-16 h-16 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 text-lg mb-2">No pools found</p>
            <p className="text-slate-500 text-sm">Be the first to create a pool!</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddLiquidityModal onClose={() => setShowAddModal(false)} onSuccess={handleSuccess} />}

      {showRemoveModal && selectedPosition && (
        <RemoveLiquidityModal
          position={selectedPosition}
          onClose={() => {
            setShowRemoveModal(false)
            setSelectedPosition(null)
          }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
