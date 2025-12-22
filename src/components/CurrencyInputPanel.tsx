import { useAccount, useBalance, useReadContract } from 'wagmi'
import { formatUnits, formatEther } from 'viem'
import { ChevronDown } from 'lucide-react'
import { ERC20_ABI } from '../config/abis'
import { type Token, NATIVE_ADDRESS } from '../config/tokens'

interface CurrencyInputPanelProps {
  token: Token
  value: string
  onChange: (value: string) => void
  onTokenSelect: () => void
  label?: string
  readOnly?: boolean
  showMax?: boolean
  disabled?: boolean
}

export function CurrencyInputPanel({
  token,
  value,
  onChange,
  onTokenSelect,
  label = 'Amount',
  readOnly = false,
  showMax = true,
  disabled = false
}: CurrencyInputPanelProps) {
  const { address } = useAccount()
  const isNative = token.address === NATIVE_ADDRESS || token.isNative

  // Native balance
  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: !!address && isNative }
  })

  // ERC20 balance
  const { data: tokenBalance } = useReadContract({
    address: token.address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !isNative }
  })

  // Calculate display balance
  const balance = isNative
    ? (nativeBalance ? formatEther(nativeBalance.value) : '0')
    : (tokenBalance ? formatUnits(tokenBalance, token.decimals) : '0')

  const balanceNum = parseFloat(balance)

  const handleMax = () => {
    if (isNative && nativeBalance) {
      // Leave some for gas
      const max = parseFloat(formatEther(nativeBalance.value)) - 0.01
      onChange(max > 0 ? max.toFixed(6) : '0')
    } else if (tokenBalance) {
      onChange(formatUnits(tokenBalance, token.decimals))
    }
  }

  const handlePercentage = (pct: number) => {
    const amount = balanceNum * (pct / 100)
    if (isNative && pct === 100) {
      // Leave some for gas on max
      onChange((amount - 0.01 > 0 ? amount - 0.01 : 0).toFixed(6))
    } else {
      onChange(amount.toFixed(6))
    }
  }

  return (
    <div className={`bg-atlantis-800/40 rounded-2xl p-4 border border-atlantis-700/30 transition-all ${disabled ? 'opacity-50' : 'hover:border-atlantis-600/50'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Balance: {balanceNum.toFixed(4)}</span>
          {showMax && !readOnly && (
            <button
              onClick={handleMax}
              className="text-primary-400 hover:text-primary-300 font-semibold transition-colors"
              disabled={disabled}
            >
              MAX
            </button>
          )}
        </div>
      </div>

      {/* Input Row */}
      <div className="flex gap-3 items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          readOnly={readOnly}
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent text-3xl font-semibold text-white outline-none placeholder-gray-600 disabled:cursor-not-allowed"
        />
        <button
          onClick={onTokenSelect}
          disabled={disabled}
          className="flex items-center gap-2 bg-atlantis-700/60 hover:bg-atlantis-600/60 border border-atlantis-600/50 hover:border-primary-500/30 rounded-2xl px-3 py-2 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-7 h-7 bg-gradient-to-br from-primary-500/40 to-secondary-500/40 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold">{token.symbol.slice(0, 1)}</span>
          </div>
          <span className="font-semibold text-white">{token.symbol}</span>
          {token.isNative && <span className="text-primary-400 text-xs">⚡</span>}
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Quick Percentage Buttons */}
      {showMax && !readOnly && (
        <div className="flex gap-2 mt-3">
          {[25, 50, 75].map(pct => (
            <button
              key={pct}
              onClick={() => handlePercentage(pct)}
              disabled={disabled}
              className="text-xs px-2 py-1 bg-atlantis-700/40 hover:bg-atlantis-600/40 text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {pct}%
            </button>
          ))}
        </div>
      )}

      {/* USD Value (optional - can be added later with price feeds) */}
      {value && parseFloat(value) > 0 && (
        <div className="mt-2 text-xs text-gray-500">
          {/* Placeholder for USD value */}
        </div>
      )}
    </div>
  )
}
