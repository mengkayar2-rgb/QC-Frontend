import { useState } from 'react'
import { WagmiProvider, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig, ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { monadMainnet } from './config/chains'
import { SwapCard } from './components/SwapCard'
import { LiquidityCard } from './components/LiquidityCard'
import { FarmPage } from './components/farm'
import { Stats } from './components/Stats'
import { RotatingBanner } from './components/RotatingBanner'

const config = getDefaultConfig({
  appName: 'QuickSwap Monad',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [monadMainnet],
  transports: {
    [monadMainnet.id]: http('https://rpc.monad.xyz'),
  },
})

const queryClient = new QueryClient()

type Tab = 'swap' | 'liquidity' | 'farm' | 'stats'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'swap', label: 'Swap', icon: '⚡' },
  { id: 'liquidity', label: 'Pool', icon: '💧' },
  { id: 'farm', label: 'Farm', icon: '🌾' },
  { id: 'stats', label: 'Stats', icon: '📊' },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('swap')

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="glass-card rounded-none border-x-0 border-t-0">
              <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex justify-between items-center">
                  {/* Logo */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-secondary-500 flex items-center justify-center shadow-glow">
                      <span className="text-xl font-bold">Q</span>
                    </div>
                    <div>
                      <h1 className="text-xl font-display font-bold gradient-text">QuickSwap</h1>
                      <span className="text-xs text-primary-400">Monad DEX</span>
                    </div>
                  </div>

                  {/* Desktop Navigation */}
                  <nav className="hidden md:flex items-center gap-1 bg-atlantis-800/30 p-1 rounded-xl border border-atlantis-700/30">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`nav-button ${
                          activeTab === tab.id ? 'nav-button-active' : 'nav-button-inactive'
                        }`}
                      >
                        <span className="mr-1.5">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </nav>

                  {/* Connect Button */}
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
                      const connected = mounted && account && chain
                      return (
                        <div>
                          {!connected ? (
                            <button onClick={openConnectModal} className="gradient-button px-6 py-2.5">
                              Connect
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={openChainModal}
                                className="flex items-center gap-2 px-3 py-2 bg-atlantis-800/50 rounded-xl border border-atlantis-700/50 hover:border-primary-500/30 transition-all"
                              >
                                <span className="text-primary-400">⚡</span>
                                <span className="text-sm hidden sm:inline">{chain.name}</span>
                              </button>
                              <button
                                onClick={openAccountModal}
                                className="px-4 py-2 bg-atlantis-800/50 rounded-xl border border-atlantis-700/50 hover:border-primary-500/30 transition-all"
                              >
                                <span className="text-sm font-medium">
                                  {account.displayName}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  </ConnectButton.Custom>
                </div>

                {/* Mobile Navigation */}
                <nav className="md:hidden flex items-center gap-1 mt-4 bg-atlantis-800/30 p-1 rounded-xl border border-atlantis-700/30 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`nav-button whitespace-nowrap ${
                        activeTab === tab.id ? 'nav-button-active' : 'nav-button-inactive'
                      }`}
                    >
                      <span className="mr-1">{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
              {/* Rotating Banner - Only on Swap tab */}
              {activeTab === 'swap' && <RotatingBanner />}

              {/* Content */}
              <div className="flex justify-center">
                {activeTab === 'liquidity' ? (
                  <LiquidityCard />
                ) : activeTab === 'farm' ? (
                  <FarmPage />
                ) : (
                  <div className="w-full max-w-md">
                    {activeTab === 'swap' && <SwapCard />}
                  </div>
                )}
              </div>
              {activeTab === 'stats' && (
                <div className="max-w-2xl mx-auto">
                  <Stats />
                </div>
              )}
            </main>

            {/* Footer */}
            <footer className="glass-card rounded-none border-x-0 border-b-0 mt-auto">
              <div className="max-w-6xl mx-auto px-4 py-5">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <span>Fee: 0.5% (0.4% LP + 0.1% Protocol)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors">Docs</a>
                    <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors">GitHub</a>
                    <a href="#" className="text-gray-400 hover:text-primary-400 transition-colors">Twitter</a>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Powered by </span>
                    <span className="gradient-text font-semibold">Monad</span>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
