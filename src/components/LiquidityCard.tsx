import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Plus, ChevronDown, TrendingUp, Droplets, DollarSign, Search, RefreshCw, Users, ExternalLink, X } from 'lucide-react'
import { CONTRACTS, SUBGRAPH_URL } from '../config/contracts'
import { ROUTER_ABI, ERC20_ABI } from '../config/abis'
import { DEFAULT_TOKENS, type Token } from '../config/tokens'
import { TokenModal } from './TokenModal'

const WMON_ADDRESS = '0x3bd359c1119da7da1d913d1c4d2b7c461115433a'
const MON_PRICE_USD = 0.50

function formatUSD(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`
  if (num >= 1) return `$${num.toFixed(2)}`
  return `$${num.toFixed(4)}`
}

type PoolTab = 'pools' | 'positions'

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

interface FactoryData {
  pairCount: number
  txCount: string
}

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

function StatCard({ icon, label, value, subValue, color, loading }: { icon: React.ReactNode; label: string; value: string; subValue?: string; color: string; loading?: boolean }) {
  const colorClasses: Record<string, string> = {
    primary: 'from-primary-500/20 to-primary-600/10 border-primary-500/30 text-primary-400',
    secondary: 'from-secondary-500/20 to-secondary-600/10 border-secondary-500/30 text-secondary-400',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  }
  return (
    <div className={`glass-card p-4 bg-gradient-to-br ${colorClasses[color] || colorClasses.primary}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      {loading ? <div className="h-7 bg-atlantis-700/50 rounded animate-pulse w-20" /> : <><div className="text-xl font-bold text-white">{value}</div>{subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}</>}
    </div>
  )
}

function TokenIcon({ symbol }: { symbol: string }) {
  return <div className="w-8 h-8 bg-gradient-to-br from-primary-500/40 to-secondary-500/40 rounded-full flex items-center justify-center border border-atlantis-600/50"><span className="text-xs font-bold text-white">{symbol.slice(0, 2)}</span></div>
}

function PoolsTable({ pools, loading, onAddLiquidity }: { pools: PoolData[]; loading: boolean; onAddLiquidity: () => void }) {
  if (loading) return <div className="glass-card p-6"><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-atlantis-700/30 rounded-xl animate-pulse" />)}</div></div>
  if (pools.length === 0) return <div className="glass-card p-8 text-center"><Droplets className="w-12 h-12 text-gray-600 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">No Pools Found</h3><p className="text-gray-400 mb-4">Be the first to create a liquidity pool!</p><button onClick={onAddLiquidity} className="gradient-button px-6 py-2">Create Pool</button></div>
  return (
    <div className="glass-card overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-atlantis-800/50 text-xs text-gray-400 font-medium"><div className="col-span-4">Pool</div><div className="col-span-2 text-right">TVL</div><div className="col-span-2 text-right">Volume</div><div className="col-span-2 text-right">Txns</div><div className="col-span-2 text-right">Action</div></div>
      <div className="divide-y divide-atlantis-700/30">{pools.map(pool => <PoolRow key={pool.id} pool={pool} />)}</div>
    </div>
  )
}

function PoolRow({ pool }: { pool: PoolData }) {
  const tvl = calculatePoolTVL(pool)
  const volume = calculatePoolVolume(pool)
  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-4 hover:bg-atlantis-800/30 transition-colors items-center">
      <div className="col-span-4 flex items-center gap-3"><div className="flex -space-x-2"><TokenIcon symbol={pool.token0.symbol} /><TokenIcon symbol={pool.token1.symbol} /></div><div><div className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</div><div className="text-xs text-gray-500">{parseInt(pool.liquidityProviderCount || '0')} LPs</div></div></div>
      <div className="col-span-2 text-right"><div className="text-white font-medium">{formatUSD(tvl)}</div></div>
      <div className="col-span-2 text-right"><div className="text-white font-medium">{formatUSD(volume)}</div></div>
      <div className="col-span-2 text-right"><div className="text-white font-medium">{parseInt(pool.txCount || '0').toLocaleString()}</div></div>
      <div className="col-span-2 text-right"><a href={`https://monadexplorer.com/address/${pool.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-400 hover:text-primary-300 text-sm">View <ExternalLink className="w-3 h-3" /></a></div>
    </div>
  )
}


interface PositionData { pair: PoolData; liquidityTokenBalance: string }

function MyPositions({ address, isConnected, onAddLiquidity }: { address?: string; isConnected: boolean; onAddLiquidity: () => void }) {
  const [positions, setPositions] = useState<PositionData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) { setLoading(false); return }
    const fetchPositions = async () => {
      try {
        const response = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ liquidityPositions(where: { user: "${address.toLowerCase()}", liquidityTokenBalance_gt: "0" }) { id liquidityTokenBalance pair { id token0 { id symbol name } token1 { id symbol name } reserve0 reserve1 totalSupply txCount liquidityProviderCount } } }` }) })
        const result = await response.json()
        setPositions(result.data?.liquidityPositions || [])
      } catch (err) { console.error('Failed to fetch positions:', err) }
      finally { setLoading(false) }
    }
    fetchPositions()
  }, [address])

  if (!isConnected) return <div className="glass-card p-8 text-center"><Users className="w-12 h-12 text-gray-600 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">Connect Wallet</h3><p className="text-gray-400">Connect your wallet to view your liquidity positions</p></div>
  if (loading) return <div className="glass-card p-6"><div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-20 bg-atlantis-700/30 rounded-xl animate-pulse" />)}</div></div>
  if (positions.length === 0) return <div className="glass-card p-8 text-center"><Droplets className="w-12 h-12 text-gray-600 mx-auto mb-4" /><h3 className="text-lg font-semibold text-white mb-2">No Positions</h3><p className="text-gray-400 mb-4">You don't have any liquidity positions yet</p><button onClick={onAddLiquidity} className="gradient-button px-6 py-2">Add Liquidity</button></div>

  return (
    <div className="space-y-4">
      {positions.map(pos => {
        const pool = pos.pair
        const lpBalance = parseFloat(pos.liquidityTokenBalance) || 0
        const totalSupply = parseFloat(pool.totalSupply) || 1
        const sharePercent = (lpBalance / totalSupply) * 100
        const reserve0 = parseFloat(pool.reserve0) || 0
        const reserve1 = parseFloat(pool.reserve1) || 0
        const pooledToken0 = (lpBalance / totalSupply) * reserve0
        const pooledToken1 = (lpBalance / totalSupply) * reserve1
        const positionValue = calculatePoolTVL(pool) * (lpBalance / totalSupply)
        return (
          <div key={pool.id} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3"><div className="flex -space-x-2"><TokenIcon symbol={pool.token0.symbol} /><TokenIcon symbol={pool.token1.symbol} /></div><div><div className="font-semibold text-white">{pool.token0.symbol}/{pool.token1.symbol}</div><div className="text-xs text-gray-500">{sharePercent.toFixed(4)}% pool share</div></div></div>
              <div className="text-right"><div className="text-lg font-bold text-primary-400">{formatUSD(positionValue)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-atlantis-800/30 rounded-lg p-2"><div className="text-gray-500 text-xs">Pooled {pool.token0.symbol}</div><div className="text-white font-medium">{pooledToken0.toFixed(6)}</div></div>
              <div className="bg-atlantis-800/30 rounded-lg p-2"><div className="text-gray-500 text-xs">Pooled {pool.token1.symbol}</div><div className="text-white font-medium">{pooledToken1.toFixed(6)}</div></div>
            </div>
            <div className="mt-3 text-xs text-gray-500">LP Tokens: {lpBalance.toFixed(6)}</div>
          </div>
        )
      })}
    </div>
  )
}

function AddLiquidityModal({ onClose }: { onClose: () => void }) {
  const { address, isConnected } = useAccount()
  const [tokenA, setTokenA] = useState<Token>(DEFAULT_TOKENS[1])
  const [tokenB, setTokenB] = useState<Token>(DEFAULT_TOKENS[2])
  const [amountA, setAmountA] = useState('')
  const [amountB, setAmountB] = useState('')
  const [showTokenModal, setShowTokenModal] = useState<'A' | 'B' | null>(null)
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const { data: allowanceA } = useReadContract({ address: tokenA.address as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, CONTRACTS.ROUTER] : undefined, query: { enabled: !!address } })
  const { data: allowanceB } = useReadContract({ address: tokenB.address as `0x${string}`, abi: ERC20_ABI, functionName: 'allowance', args: address ? [address, CONTRACTS.ROUTER] : undefined, query: { enabled: !!address } })
  const { data: balanceA } = useReadContract({ address: tokenA.address as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } })
  const { data: balanceB } = useReadContract({ address: tokenB.address as `0x${string}`, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } })
  const needsApprovalA = allowanceA !== undefined && amountA ? allowanceA < parseUnits(amountA || '0', 18) : false
  const needsApprovalB = allowanceB !== undefined && amountB ? allowanceB < parseUnits(amountB || '0', 18) : false
  const handleApprove = (token: Token) => { writeContract({ address: token.address as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.ROUTER, parseUnits('999999999', 18)] }) }
  const handleAddLiquidity = () => { if (!address || !amountA || !amountB) return; const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60); const amountAWei = parseUnits(amountA, 18); const amountBWei = parseUnits(amountB, 18); writeContract({ address: CONTRACTS.ROUTER, abi: ROUTER_ABI, functionName: 'addLiquidity', args: [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`, amountAWei, amountBWei, amountAWei * 95n / 100n, amountBWei * 95n / 100n, address, deadline] }) }
  const handleTokenSelect = (token: Token, type: 'A' | 'B') => { if (type === 'A') { if (token.address === tokenB.address) setTokenB(tokenA); setTokenA(token) } else { if (token.address === tokenA.address) setTokenA(tokenB); setTokenB(token) }; setShowTokenModal(null) }
  useEffect(() => { if (isSuccess) setTimeout(onClose, 2000) }, [isSuccess, onClose])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md p-5 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-bold text-white mb-5">Add Liquidity</h2>
        <div className="bg-atlantis-800/40 rounded-xl p-4 mb-3">
          <div className="flex justify-between text-sm text-gray-400 mb-2"><span>Token A</span><span>Balance: {balanceA ? parseFloat(formatUnits(balanceA, 18)).toFixed(4) : '0'}</span></div>
          <div className="flex gap-3"><input type="number" value={amountA} onChange={(e) => setAmountA(e.target.value)} placeholder="0" className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none" /><button onClick={() => setShowTokenModal('A')} className="flex items-center gap-2 bg-atlantis-700/60 rounded-xl px-3 py-2"><TokenIcon symbol={tokenA.symbol} /><span className="font-semibold text-white">{tokenA.symbol}</span><ChevronDown className="w-4 h-4 text-gray-400" /></button></div>
        </div>
        <div className="flex justify-center -my-1 relative z-10"><div className="w-8 h-8 bg-atlantis-900 border-4 border-atlantis-950 rounded-lg flex items-center justify-center"><Plus className="w-4 h-4 text-gray-400" /></div></div>
        <div className="bg-atlantis-800/40 rounded-xl p-4 mt-3 mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2"><span>Token B</span><span>Balance: {balanceB ? parseFloat(formatUnits(balanceB, 18)).toFixed(4) : '0'}</span></div>
          <div className="flex gap-3"><input type="number" value={amountB} onChange={(e) => setAmountB(e.target.value)} placeholder="0" className="flex-1 bg-transparent text-2xl font-semibold text-white outline-none" /><button onClick={() => setShowTokenModal('B')} className="flex items-center gap-2 bg-atlantis-700/60 rounded-xl px-3 py-2"><TokenIcon symbol={tokenB.symbol} /><span className="font-semibold text-white">{tokenB.symbol}</span><ChevronDown className="w-4 h-4 text-gray-400" /></button></div>
        </div>
        {!isConnected ? <button className="w-full py-3 bg-atlantis-700/50 rounded-xl font-semibold text-gray-400 cursor-not-allowed">Connect Wallet</button> : needsApprovalA ? <button onClick={() => handleApprove(tokenA)} disabled={isPending || isConfirming} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-white">{isPending || isConfirming ? 'Approving...' : `Approve ${tokenA.symbol}`}</button> : needsApprovalB ? <button onClick={() => handleApprove(tokenB)} disabled={isPending || isConfirming} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-white">{isPending || isConfirming ? 'Approving...' : `Approve ${tokenB.symbol}`}</button> : <button onClick={handleAddLiquidity} disabled={isPending || isConfirming || !amountA || !amountB} className="w-full py-3 gradient-button font-bold">{isPending || isConfirming ? 'Adding Liquidity...' : 'Add Liquidity'}</button>}
        {isSuccess && <div className="mt-3 text-center text-green-400 text-sm py-2 bg-green-500/10 rounded-xl">✓ Liquidity added!</div>}
        {showTokenModal && <TokenModal onSelect={(token) => handleTokenSelect(token, showTokenModal)} onClose={() => setShowTokenModal(null)} onImport={() => {}} />}
      </div>
    </div>
  )
}


export function LiquidityCard() {
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<PoolTab>('pools')
  const [showAddForm, setShowAddForm] = useState(false)
  const [pools, setPools] = useState<PoolData[]>([])
  const [factory, setFactory] = useState<FactoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const response = await fetch(SUBGRAPH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `{ factories(first: 1) { pairCount txCount } pairs(first: 50, orderBy: txCount, orderDirection: desc) { id token0 { id symbol name } token1 { id symbol name } reserve0 reserve1 volumeToken0 volumeToken1 txCount totalSupply liquidityProviderCount } }` }) })
      const { data, errors } = await response.json()
      if (errors) { setError(errors[0]?.message || 'Subgraph error'); return }
      setPools(data?.pairs || [])
      setFactory(data?.factories?.[0] || null)
    } catch (err) { console.error('Failed to fetch pools:', err); setError('Network error') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 30000); return () => clearInterval(interval) }, [])

  const filteredPools = pools.filter(pool => pool.token0.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || pool.token1.symbol.toLowerCase().includes(searchQuery.toLowerCase()))
  const totalTVL = pools.reduce((acc, pool) => acc + calculatePoolTVL(pool), 0)
  const totalVolume = pools.reduce((acc, pool) => acc + calculatePoolVolume(pool), 0)
  const totalTxCount = factory ? parseInt(factory.txCount) : pools.reduce((acc, pool) => acc + parseInt(pool.txCount || '0'), 0)
  const totalFees = totalVolume * 0.005
  const totalLPs = pools.reduce((acc, p) => acc + parseInt(p.liquidityProviderCount || '0'), 0)

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Liquidity" value={formatUSD(totalTVL)} subValue={`${factory?.pairCount || pools.length} pools`} color="primary" loading={loading} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Volume" value={formatUSD(totalVolume)} subValue={`${totalTxCount.toLocaleString()} txns`} color="secondary" loading={loading} />
        <StatCard icon={<Droplets className="w-5 h-5" />} label="Total Fees" value={formatUSD(totalFees)} subValue="0.5% fee" color="cyan" loading={loading} />
        <StatCard icon={<Users className="w-5 h-5" />} label="LP Providers" value={totalLPs.toString()} subValue="unique" color="green" loading={loading} />
      </div>
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between"><span>⚠️ {error}</span><button onClick={fetchData} className="text-red-300 hover:text-white">Retry</button></div>}
      <div className="glass-card p-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 bg-atlantis-800/50 p-1 rounded-xl">
            <button onClick={() => setActiveTab('pools')} className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'pools' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}>Pools</button>
            <button onClick={() => setActiveTab('positions')} className={`px-4 py-2 rounded-lg font-medium transition-all ${activeTab === 'positions' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}>My Positions</button>
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><input type="text" placeholder="Search pools..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-atlantis-800/50 border border-atlantis-700/50 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary-500/50" /></div>
            <button onClick={fetchData} disabled={refreshing} className="p-2 bg-atlantis-800/50 border border-atlantis-700/50 rounded-xl hover:border-primary-500/50 transition-all" title="Refresh"><RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <button onClick={() => setShowAddForm(true)} className="gradient-button px-4 py-2 flex items-center gap-2"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Liquidity</span></button>
          </div>
        </div>
      </div>
      {activeTab === 'pools' ? <PoolsTable pools={filteredPools} loading={loading} onAddLiquidity={() => setShowAddForm(true)} /> : <MyPositions address={address} isConnected={isConnected} onAddLiquidity={() => setShowAddForm(true)} />}
      {showAddForm && <AddLiquidityModal onClose={() => setShowAddForm(false)} />}
    </div>
  )
}
