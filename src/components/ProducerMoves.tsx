'use client'

import React, { useState } from 'react'

export interface ProducerMove {
  id: string
  name: string
  description: string
  category: 'intro' | 'transition' | 'variation' | 'outro'
  icon: string
}

const PRODUCER_MOVES: ProducerMove[] = [
  {
    id: 'intro_tease',
    name: 'Intro Tease',
    description: 'Start sparse with limited elements to build anticipation',
    category: 'intro',
    icon: '🎭',
  },
  {
    id: 'hook_drop',
    name: 'Hook Drop',
    description: 'Full energy arrival at the hook with all elements',
    category: 'transition',
    icon: '💥',
  },
  {
    id: 'verse_space',
    name: 'Verse Space',
    description: 'Reduce melody/high-end to create "vocal space" in verses',
    category: 'variation',
    icon: '🎤',
  },
  {
    id: 'eight_bar_hat_roll',
    name: '8-Bar Hat Roll',
    description: 'Add hi-hat roll variations every 8 bars for movement',
    category: 'variation',
    icon: '🥁',
  },
  {
    id: 'end_section_fill',
    name: 'End-of-Section Fill',
    description: 'Drum fill at section ends to signal transitions',
    category: 'transition',
    icon: '🎵',
  },
  {
    id: 'pre_hook_mute',
    name: 'Pre-Hook Mute',
    description: 'Brief silence/dropout before hook for impact',
    category: 'transition',
    icon: '🔇',
  },
  {
    id: 'silence_drop',
    name: 'Silence Drop',
    description: 'Strategic silence moments for dramatic effect',
    category: 'transition',
    icon: '⏸️',
  },
  {
    id: 'layer_lift',
    name: 'Layer Lift',
    description: 'Gradually add instruments to build energy',
    category: 'variation',
    icon: '📈',
  },
  {
    id: 'bridge_breakdown',
    name: 'Bridge Breakdown',
    description: 'Strip to minimal elements in bridge sections',
    category: 'variation',
    icon: '🌉',
  },
  {
    id: 'final_hook_expansion',
    name: 'Final Hook Expansion',
    description: 'Last hook gets extra layers and energy',
    category: 'variation',
    icon: '⭐',
  },
  {
    id: 'outro_strip',
    name: 'Outro Strip',
    description: 'Gradually remove elements for smooth ending',
    category: 'outro',
    icon: '🌅',
  },
  {
    id: 'call_response',
    name: 'Call-and-Response',
    description: 'Alternate between full and sparse bars',
    category: 'variation',
    icon: '↔️',
  },
]

interface ProducerMovesProps {
  selectedMoves?: string[]
  onChange: (moves: string[]) => void
  disabled?: boolean
}

export function ProducerMoves({
  selectedMoves = [],
  onChange,
  disabled = false,
}: ProducerMovesProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    intro: true,
    transition: true,
    variation: true,
    outro: true,
  })

  const toggleMove = (moveId: string) => {
    if (disabled) return
    
    if (selectedMoves.includes(moveId)) {
      onChange(selectedMoves.filter((id) => id !== moveId))
    } else {
      onChange([...selectedMoves, moveId])
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories({
      ...expandedCategories,
      [category]: !expandedCategories[category],
    })
  }

  const selectAll = () => {
    onChange(PRODUCER_MOVES.map((m) => m.id))
  }

  const selectNone = () => {
    onChange([])
  }

  const categories = {
    intro: { label: 'Intro', color: 'blue' },
    transition: { label: 'Transitions', color: 'purple' },
    variation: { label: 'Variations', color: 'green' },
    outro: { label: 'Outro', color: 'orange' },
  }

  const getCategoryMoves = (category: string) => {
    return PRODUCER_MOVES.filter((m) => m.category === category)
  }

  const getCategoryColor = (category: string) => {
    const colorMap = {
      intro: 'border-blue-700 bg-blue-900/20',
      transition: 'border-purple-700 bg-purple-900/20',
      variation: 'border-green-700 bg-green-900/20',
      outro: 'border-orange-700 bg-orange-900/20',
    }
    return colorMap[category as keyof typeof colorMap] || 'border-gray-700 bg-gray-900/20'
  }

  return (
    <div className="space-y-4 bg-gray-900 rounded-lg p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">🎛️ Producer Moves</h3>
          <p className="text-sm text-gray-400 mt-1">
            Select arrangement techniques to apply (engine auto-places them)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={disabled}
            className="px-3 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            disabled={disabled}
            className="px-3 py-1 text-xs font-medium text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Selected count */}
      <div className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded border border-gray-700">
        <span className="text-sm text-gray-300">
          Selected: <span className="font-bold text-blue-400">{selectedMoves.length}</span> / {PRODUCER_MOVES.length}
        </span>
        {selectedMoves.length > 0 && (
          <span className="text-xs text-gray-500">
            Engine will intelligently place these moves
          </span>
        )}
      </div>

      {/* Moves by category */}
      <div className="space-y-3">
        {Object.entries(categories).map(([categoryKey, { label, color }]) => {
          const moves = getCategoryMoves(categoryKey)
          const isExpanded = expandedCategories[categoryKey]
          const selectedCount = moves.filter((m) => selectedMoves.includes(m.id)).length

          return (
            <div
              key={categoryKey}
              className={`border rounded-lg overflow-hidden ${getCategoryColor(categoryKey)}`}
            >
              {/* Category header */}
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="w-full flex items-center justify-between p-3 hover:bg-black/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium text-white">{label}</span>
                  <span className="text-xs text-gray-400">
                    ({selectedCount}/{moves.length})
                  </span>
                </div>
              </button>

              {/* Moves list */}
              {isExpanded && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 pt-0">
                  {moves.map((move) => {
                    const isSelected = selectedMoves.includes(move.id)

                    return (
                      <button
                        key={move.id}
                        onClick={() => toggleMove(move.id)}
                        disabled={disabled}
                        className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={move.description}
                      >
                        {/* Icon & Checkbox */}
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-2xl">{move.icon}</span>
                          <div
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white text-sm mb-1">
                            {move.name}
                          </div>
                          <div className="text-xs text-gray-400 line-clamp-2">
                            {move.description}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-200">
            <div className="font-semibold mb-1">How Producer Moves Work:</div>
            <ul className="space-y-1 text-xs">
              <li>✓ Engine automatically places moves at optimal positions</li>
              <li>✓ Moves adapt to your loop's detected components (kick, bass, melody, etc.)</li>
              <li>✓ Multiple moves work together intelligently</li>
              <li>✓ Disable moves you don't want in your arrangement</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProducerMoves

