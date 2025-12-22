// components/AutoRatioInput.tsx
// Auto-ratio calculator component for liquidity
import { useState, useEffect } from 'react'
import { Lock, Unlock, RefreshCw, AlertTriangle, Info } from 'lucide-react'
import { usePoolRatio } from '../hooks/usePoolRatio'
import { type Token } from '../config/tokens'

interface AutoRatioInputProps {
  tokenA: Token
  tokenB: Token
  amountA: string
  amountB: string
  onAmountAChange: (value: string) => void
  onAmountBChange: (value: string) => void
  disabled?: boolean
}

export function AutoRatioInput({
  tokenA,
  tokenB,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
  disabled = false,
}: AutoRatioInputProps) {
  const [isLocked, setIsLocked] = useState(true) // Lock ratio mode by default
  const [lastChanged, setLastChanged] = useState<'a' | 'b' | null>(null)
  
  const {
    ratio,
    reverseRatio,
    reserveA,
    reserveB,
    poolExists,
    loading,
    error,
    calculateAmountB,
    calculateAmountA,
    refetch,
  } = usePoolRatio(tokenA, tokenB)

  // Auto-calculate when amount changes (only in locked mode)
  useEffect(() => {
    if (!isLocked || loading || disabled) return

    if (lastChanged === 'a' && amountA) {
      const calcB = calculateAmountB(amountA)
      if (calcB && calcB !== amountB) {
        onAmountBChange(calcB)
      }
    } else if (lastChanged === 'b' && amountB) {
      const calcA = calculateAmountA(amountB)
      if (calcA && calcA !== amountA) {
        onAmountAChange(calcA)
      }
    }
  }, [amountA, amountB, isLocked, lastChanged, loading, disabled, calculateAmountA, calculateAmountB, onAmountAChange, onAmountBChange])

  // Expose setLastChanged for parent component to call
  const handleInputChange = (type: 'a' | 'b') => {
    setLastChanged(type)
  }

  // Format number for display
  const formatNum = (num: number): string => {
    if (num === 0) return '0'
    if (num < 0.0001) return num.toExponential(2)
    if (num < 1) return num.toFixed(6)
    if (num < 1000) return num.toFixed(4)
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`
    return num.toFixed(2)
  }

  // Expose handleInputChange for external use
  void handleInputChange

  return (
    <div className="space-y-3">
      {/* Pool Ratio Info */}
      <div className="bg-[#212429] rounded-xl p-3 border border-[#2C2F36]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {loading ? (
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <Info className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-slate-400 text-sm">Pool Ratio</span>
          </div>
          
          {/* Lock/Unlock Toggle */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isLocked
                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            } disabled:opacity-50`}
          >
            {isLocked ? (
              <>
                <Lock className="w-3 h-3" />
                Auto
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3" />
                Manual
              </>
            )}
          </button>
        </div>

        {/* Ratio Display */}
        <div className="mt-2">
          {loading ? (
            <div className="text-slate-500 text-sm">Loading pool data...</div>
          ) : poolExists ? (
            <div className="space-y-1">
              <div className="text-white font-semibold">
                1 {tokenA.symbol} = {formatNum(ratio)} {tokenB.symbol}
              </div>
              <div className="text-slate-500 text-xs">
                1 {tokenB.symbol} = {formatNum(reverseRatio)} {tokenA.symbol}
              </div>
            </div>
          ) : (
            <div className="text-amber-400 text-sm flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              New pool - you set the initial ratio
            </div>
          )}
        </div>

        {/* Reserves Info */}
        {poolExists && (
          <div className="mt-2 pt-2 border-t border-[#2C2F36]">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Pool Reserves:</span>
              <button
                onClick={refetch}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {formatNum(parseFloat(reserveA))} {tokenA.symbol} + {formatNum(parseFloat(reserveB))} {tokenB.symbol}
            </div>
          </div>
        )}
      </div>

      {/* Warning for Manual Mode */}
      {!isLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 text-sm font-medium">Manual Mode Active</p>
            <p className="text-amber-300/70 text-xs">
              Amounts won't auto-calculate. Ensure your ratio matches the pool to avoid high slippage.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !error.includes('not found') && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

// Export helper functions for external use
export { usePoolRatio }
