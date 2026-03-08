import React from 'react'

interface ProducerControlsProps {
  onGenreChange: (genre: string) => void
  onEnergyChange: (energy: number) => void
  onStyleDirectionChange: (text: string) => void
  isLoading?: boolean
}

const GENRES = [
  { value: 'trap', label: '🎤 Trap', description: 'High-energy 808s and drums' },
  { value: 'rnb', label: '🎹 R&B', description: 'Melodic and smooth' },
  { value: 'pop', label: '✨ Pop', description: 'Upbeat and catchy' },
  { value: 'cinematic', label: '🎬 Cinematic', description: 'Epic orchestral' },
  { value: 'afrobeats', label: '🥁 Afrobeats', description: 'Percussive and rhythmic' },
  { value: 'drill', label: '🏙️ Drill', description: 'Dark and intense' },
  { value: 'house', label: '🎵 House', description: 'Electronic and dance' },
  { value: 'generic', label: '🎼 Generic', description: 'Neutral balanced sound' },
]

export const ProducerControls: React.FC<ProducerControlsProps> = ({
  onGenreChange,
  onEnergyChange,
  onStyleDirectionChange,
  isLoading = false,
}) => {
  const [selectedGenre, setSelectedGenre] = React.useState('generic')
  const [energy, setEnergy] = React.useState(0.5)
  const [styleText, setStyleText] = React.useState('')

  const handleGenreChange = (genre: string) => {
    setSelectedGenre(genre)
    onGenreChange(genre)
  }

  const handleEnergyChange = (newEnergy: number) => {
    setEnergy(newEnergy)
    onEnergyChange(newEnergy)
  }

  const handleStyleTextChange = (text: string) => {
    setStyleText(text)
    onStyleDirectionChange(text)
  }

  return (
    <div className="space-y-6 bg-gray-900 rounded-lg p-6 border border-gray-800">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">🎛️ Producer Controls</h3>
        <p className="text-sm text-gray-400 mb-4">
          Customize your arrangement with genre, energy, and style direction
        </p>
      </div>

      {/* Genre Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Genre & Style
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre.value}
              onClick={() => handleGenreChange(genre.value)}
              disabled={isLoading}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedGenre === genre.value
                  ? 'border-blue-500 bg-blue-900/30 text-white'
                  : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={genre.description}
            >
              <div className="font-semibold text-base">{genre.label}</div>
              <div className="text-xs text-gray-400 mt-1">{genre.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Energy Slider */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Energy Level: <span className="text-blue-400 font-bold">{Math.round(energy * 100)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={energy}
          onChange={(e) => handleEnergyChange(parseFloat(e.target.value))}
          disabled={isLoading}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>🎼 Calm</span>
          <span>⚡ High Energy</span>
        </div>
      </div>

      {/* Style Direction Text Input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Style Direction (Natural Language)
        </label>
        <textarea
          value={styleText}
          onChange={(e) => handleStyleTextChange(e.target.value)}
          disabled={isLoading}
          placeholder="E.g., 'Southside type trap with aggressive drums' or 'Drake R&B smooth vibe'"
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
          rows={3}
        />
        <div className="mt-2 text-xs text-gray-500">
          💡 Examples: "Lil Baby trap", "Hans Zimmer cinematic", "Afrobeats percussive", "Drake R&B"
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <div className="text-sm text-blue-200">
          <div className="font-semibold mb-2">🎵 Producer Engine Features:</div>
          <ul className="space-y-1 text-xs">
            <li>✓ Automatic song structure (Intro, Verse, Hook, Bridge, Outro)</li>
            <li>✓ Dynamic energy curves and instrument layering</li>
            <li>✓ Transitions and variations every 4-8 bars</li>
            <li>✓ Genre-specific drum, bass, and melody styles</li>
            <li>✓ DAW export (stems, MIDI, markers) for FL Studio, Ableton, Logic, Pro Tools</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default ProducerControls
