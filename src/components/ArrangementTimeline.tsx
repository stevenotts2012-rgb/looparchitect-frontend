import React from 'react'

interface Section {
  name: string
  bar_start: number
  bars: number
  energy: number
  instruments?: string[]
}

interface ArrangementTimelineProps {
  sections: Section[]
  totalBars?: number
  totalSeconds?: number
  tempo?: number
}

const SECTION_COLORS: Record<string, string> = {
  Intro: 'bg-blue-600',
  Verse: 'bg-green-600',
  Hook: 'bg-red-600',
  Chorus: 'bg-red-600',
  Bridge: 'bg-yellow-600',
  Breakdown: 'bg-orange-600',
  Outro: 'bg-blue-600',
}

export const ArrangementTimeline: React.FC<ArrangementTimelineProps> = ({
  sections,
  totalBars = 96,
  totalSeconds = 48,
  tempo = 120,
}) => {
  if (!sections || sections.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center text-gray-500">
        No arrangement data available
      </div>
    )
  }

  const getColor = (sectionName: string): string => {
    return SECTION_COLORS[sectionName] || 'bg-gray-600'
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">📊 Arrangement Timeline</h3>
        <div className="text-sm text-gray-400">
          <span className="mr-4">⏱️ {totalSeconds?.toFixed(1)}s</span>
          <span className="mr-4">🎶 {totalBars} bars</span>
          <span>♩ {tempo} BPM</span>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="space-y-3">
        {sections.map((section, idx) => {
          const barWidth = (section.bars / totalBars) * 100
          const energyHeight = Math.round(section.energy * 100)

          return (
            <div key={idx} className="space-y-1">
              {/* Section bar */}
              <div className="flex items-center gap-2">
                <div className="w-20 text-sm font-medium text-gray-300 truncate">
                  {section.name}
                </div>
                <div className="flex-1 h-8 bg-gray-800 rounded border border-gray-700 overflow-hidden relative">
                  <div
                    className={`h-full ${getColor(section.name)} opacity-75 transition-all`}
                    style={{ width: `${barWidth}%` }}
                  >
                    <div className="h-full flex items-end px-2 pb-1">
                      <div
                        className="w-1 bg-white/30"
                        style={{ height: `${energyHeight}%` }}
                      />
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center px-2 text-xs text-white/70 font-mono">
                    {section.bars}b
                  </div>
                </div>
                <div className="w-16 text-xs text-right text-gray-500">
                  {(section.energy * 100).toFixed(0)}%
                </div>
              </div>

              {/* Instruments list */}
              {section.instruments && section.instruments.length > 0 && (
                <div className="pl-20 text-xs text-gray-400 space-y-0.5">
                  <div className="font-mono">
                    🎵 {section.instruments.slice(0, 4).join(', ')}
                    {section.instruments.length > 4 && ` +${section.instruments.length - 4}`}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 mb-3">Legend:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {Object.entries(SECTION_COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${color}`} />
              <span className="text-gray-300">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ArrangementTimeline
