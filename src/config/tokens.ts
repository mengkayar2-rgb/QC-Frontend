import { CONTRACTS } from './contracts'

export interface Token {
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
  isNative?: boolean
}

// Native MON token (address 0x0 represents native)
export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`

export const MON_TOKEN: Token = {
  address: NATIVE_ADDRESS,
  symbol: 'MON',
  name: 'Monad',
  decimals: 18,
  isNative: true
}

export const WMON_TOKEN: Token = {
  address: CONTRACTS.WMON,
  symbol: 'WMON',
  name: 'Wrapped MON',
  decimals: 18,
  isNative: false
}

export const QUICK_TOKEN: Token = {
  address: CONTRACTS.QUICK,
  symbol: 'QUICK',
  name: 'QuickSwap Token',
  decimals: 18,
  isNative: false,
}

// MMF Token
export const MMF_TOKEN: Token = {
  address: '0x775B6D1d23463AC5Cc7684139a8A7642970e3Cda' as `0x${string}`,
  symbol: 'MMF',
  name: 'MMFinance',
  decimals: 18,
  isNative: false,
}

// USDC placeholder - update with actual deployed address
export const USDC_TOKEN: Token = {
  address: '0x0000000000000000000000000000000000000001' as `0x${string}`, // Placeholder - update when deployed
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  isNative: false,
}

// Default tokens list - MON first for native token support
export const DEFAULT_TOKENS: Token[] = [MON_TOKEN, WMON_TOKEN, QUICK_TOKEN, MMF_TOKEN]

// Helper to check if a token is native MON
export function isNativeToken(token: Token): boolean {
  return token.address === NATIVE_ADDRESS || token.isNative === true
}

// Helper to get the actual address for routing (WMON for native MON)
export function getRouteAddress(token: Token): `0x${string}` {
  return isNativeToken(token) ? CONTRACTS.WMON : token.address
}

// Local storage key for imported tokens
export const IMPORTED_TOKENS_KEY = 'quickswap_imported_tokens'

export function getStoredTokens(): Token[] {
  try {
    const stored = localStorage.getItem(IMPORTED_TOKENS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function saveToken(token: Token): void {
  const tokens = getStoredTokens()
  if (!tokens.find(t => t.address.toLowerCase() === token.address.toLowerCase())) {
    tokens.push(token)
    localStorage.setItem(IMPORTED_TOKENS_KEY, JSON.stringify(tokens))
  }
}

export function removeToken(address: string): void {
  const tokens = getStoredTokens().filter(t => t.address.toLowerCase() !== address.toLowerCase())
  localStorage.setItem(IMPORTED_TOKENS_KEY, JSON.stringify(tokens))
}
