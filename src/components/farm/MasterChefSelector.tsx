import { MasterChefVersion } from '../../config/masterchef'

interface MasterChefSelectorProps {
  value: MasterChefVersion
  onChange: (version: MasterChefVersion) => void
}

export function MasterChefSelector({ value, onChange }: MasterChefSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400 hidden sm:inline">Version:</span>
      <div className="flex bg-atlantis-800/50 rounded-xl p-1 border border-atlantis-700/50">
        <button
          onClick={() => onChange('V1')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            value === 'V1'
              ? 'bg-gradient-to-r from-primary-500/30 to-secondary-500/30 text-white border border-primary-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          V1
        </button>
        <button
          onClick={() => onChange('V2')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            value === 'V2'
              ? 'bg-gradient-to-r from-primary-500/30 to-secondary-500/30 text-white border border-primary-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          V2
        </button>
      </div>
    </div>
  )
}
