import { useState, useEffect } from 'react'
import { X, Search, Copy, Check, ExternalLink, AlertCircle } from 'lucide-react'
import { useAccount, useBalance, useReadContract, usePublicClient } from 'wagmi'
import { formatUnits, isAddress } from 'viem'
import { DEFAULT_TOKENS, getStoredTokens, saveToken, NATIVE_ADDRESS, type Token } from '../config/tokens'
import { ERC20_ABI } from '../config/abis'

interface TokenModalProps {
  onSelect: (token: Token) => void
  onClose: () => void
  onImport: () => void
  excludeToken?: Token // Optional token to exclude from list
}

function TokenItem({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  
  const { data: nativeBalance } = useBalance({ 
    address,
    query: { enabled: token.isNative }
  })
  
  const { data: tokenBalance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !token.isNative }
  })

  const balance = token.isNative 
    ? (nativeBalance ? parseFloat(nativeBalance.formatted).toFixed(4) : '0.0000')
    : (tokenBalance ? parseFloat(formatUnits(tokenBalance, token.decimals)).toFixed(4) : '0.0000')

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (token.address !== NATIVE_ADDRESS) {
      navigator.clipboard.writeText(token.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openExplorer = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (token.address !== NATIVE_ADDRESS) {
      window.open(`https://monadscan.com/address/${token.address}`, '_blank')
    }
  }

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="group">
      <button
        onClick={() => onSelect(token)}
        className="w-full flex items-center gap-3 p-3 hover:bg-atlantis-700/50 rounded-xl transition-all"
      >
        {/* Token Icon */}
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 rounded-full flex items-center justify-center border border-atlantis-600/50 shrink-0">
          <span className="text-sm font-bold text-white">{token.symbol.slice(0, 2)}</span>
        </div>
        
        {/* Token Info */}
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{token.symbol}</span>
            {token.isNative && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded font-medium">
                NATIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{token.name}</span>
            {token.address !== NATIVE_ADDRESS && (
              <span className="text-[10px] text-gray-600 font-mono">
                {shortenAddress(token.address)}
              </span>
            )}
          </div>
        </div>
        
        {/* Balance */}
        <div className="text-right shrink-0">
          <div className="text-sm text-white font-medium">{balance}</div>
        </div>
      </button>
      
      {/* Action Buttons - Show on hover */}
      {token.address !== NATIVE_ADDRESS && (
        <div className="flex justify-end gap-1 px-3 pb-2 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={copyAddress}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-atlantis-800/80 hover:bg-atlantis-700 rounded-lg text-gray-400 hover:text-white transition-all"
            title="Copy address"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={openExplorer}
            className="flex items-center gap-1 px-2 py-1 text-[10px] bg-atlantis-800/80 hover:bg-atlantis-700 rounded-lg text-gray-400 hover:text-white transition-all"
            title="View on explorer"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Explorer</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function TokenModal({ onSelect, onClose, onImport, excludeToken }: TokenModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [customTokens, setCustomTokens] = useState<Token[]>([])
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressToken, setAddressToken] = useState<Token | null>(null)
  const [searchError, setSearchError] = useState('')
  const publicClient = usePublicClient()
  
  // Load custom tokens on mount
  useEffect(() => {
    setCustomTokens(getStoredTokens())
  }, [])
  
  const allTokens = [...DEFAULT_TOKENS, ...customTokens]
  
  // Filter tokens based on search and exclude
  const filteredTokens = allTokens.filter(token => {
    // Exclude the specified token
    if (excludeToken && token.address.toLowerCase() === excludeToken.address.toLowerCase()) {
      return false
    }
    // Filter by search query
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    )
  })
  
  // Check if search query is a valid address and try to fetch token info
  useEffect(() => {
    const fetchTokenByAddress = async () => {
      if (!searchQuery || !isAddress(searchQuery) || !publicClient) {
        setAddressToken(null)
        setSearchError('')
        return
      }
      
      // Check if token already exists
      const existingToken = allTokens.find(t => t.address.toLowerCase() === searchQuery.toLowerCase())
      if (existingToken) {
        setAddressToken(null)
        return
      }
      
      setIsSearchingAddress(true)
      setSearchError('')
      
      try {
        // First get symbol and decimals
        const [symbolResult, decimalsResult] = await Promise.all([
          publicClient.readContract({
            address: searchQuery as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }),
          publicClient.readContract({
            address: searchQuery as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }),
        ])
        
        const symbol = symbolResult as string
        const decimals = Number(decimalsResult)
        
        // Try to get name, fallback to symbol
        let name: string = symbol
        try {
          const nameResult = await publicClient.readContract({
            address: searchQuery as `0x${string}`,
            abi: [{ inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }] as const,
            functionName: 'name',
          })
          name = nameResult as string
        } catch {
          // Use symbol as name if name() doesn't exist
        }
        
        setAddressToken({
          address: searchQuery as `0x${string}`,
          symbol: symbol,
          name: name,
          decimals: decimals,
          isNative: false
        })
      } catch (err) {
        setSearchError('Invalid token address or not an ERC20 token')
        setAddressToken(null)
      } finally {
        setIsSearchingAddress(false)
      }
    }
    
    const debounce = setTimeout(fetchTokenByAddress, 500)
    return () => clearTimeout(debounce)
  }, [searchQuery, publicClient, allTokens])
  
  // Handle importing a token found by address
  const handleImportAddressToken = () => {
    if (addressToken) {
      saveToken(addressToken)
      setCustomTokens(prev => [...prev, addressToken])
      onSelect(addressToken)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-atlantis-700/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold text-white">Select Asset</h3>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-atlantis-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or paste address"
              className="w-full bg-atlantis-800/80 border border-atlantis-600/50 rounded-xl pl-11 pr-4 py-3 text-white text-sm placeholder-gray-500 outline-none focus:border-primary-500/50 transition-all"
            />
          </div>
        </div>

        {/* Popular Tokens Quick Select */}
        <div className="px-5 py-3 border-b border-atlantis-700/30">
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_TOKENS.slice(0, 3).map(token => (
              <button
                key={token.address}
                onClick={() => onSelect(token)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-atlantis-800/50 hover:bg-atlantis-700/50 border border-atlantis-600/30 hover:border-primary-500/30 rounded-lg transition-all"
              >
                <div className="w-5 h-5 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 rounded-full flex items-center justify-center">
                  <span className="text-[8px] font-bold">{token.symbol.slice(0, 1)}</span>
                </div>
                <span className="text-sm font-medium text-white">{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>

        {/* My Tokens Label */}
        <div className="px-5 py-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            {searchQuery ? 'Search Results' : 'All Tokens'}
          </span>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {/* Show loading state when searching by address */}
          {isSearchingAddress && (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              <span className="ml-2 text-gray-400 text-sm">Searching...</span>
            </div>
          )}
          
          {/* Show error if address search failed */}
          {searchError && (
            <div className="mx-3 mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="text-red-400 text-sm">{searchError}</span>
            </div>
          )}
          
          {/* Show token found by address */}
          {addressToken && (
            <div className="mx-3 mb-3 p-3 bg-primary-500/10 border border-primary-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500/30 to-secondary-500/30 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold">{addressToken.symbol.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{addressToken.symbol}</div>
                    <div className="text-xs text-gray-500">{addressToken.name}</div>
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">New</span>
              </div>
              <button
                onClick={handleImportAddressToken}
                className="w-full py-2 bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-400 hover:to-secondary-400 rounded-lg text-white font-medium text-sm transition-all"
              >
                Import & Select
              </button>
            </div>
          )}
          
          {filteredTokens.length > 0 ? (
            filteredTokens.map(token => (
              <TokenItem key={token.address} token={token} onSelect={onSelect} />
            ))
          ) : !addressToken && !isSearchingAddress && (
            <div className="text-center py-8 text-gray-500">
              <p>No tokens found</p>
              <p className="text-xs mt-1">Try pasting a token address</p>
            </div>
          )}
        </div>

        {/* Import Button */}
        <div className="p-4 border-t border-atlantis-700/50">
          <button
            onClick={onImport}
            className="w-full py-3 bg-gradient-to-r from-primary-500/10 to-secondary-500/10 hover:from-primary-500/20 hover:to-secondary-500/20 border border-primary-500/30 hover:border-primary-500/50 rounded-xl text-primary-400 hover:text-white transition-all font-medium"
          >
            + Import Custom Token
          </button>
        </div>
      </div>
    </div>
  )
}
