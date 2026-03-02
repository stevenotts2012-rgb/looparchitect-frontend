'use client'

import { useState } from 'react'
import { fetchLoopPlayUrl } from '@/lib/api'
import { useAudioManager } from '@/context/AudioManagerContext'

export interface LoopCardData {
  id: number
  name: string
  title?: string | null
  bpm?: number | null
}

interface LoopCardProps {
  loop: LoopCardData
}

export default function LoopCard({ loop }: LoopCardProps) {
  const { currentLoopId, isPlaying, progress, play, pause } = useAudioManager()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive = currentLoopId === loop.id
  const isLoopPlaying = isActive && isPlaying
  const progressPercent = isActive ? Math.round(progress * 100) : 0

  const handleToggle = async () => {
    setError(null)

    if (isLoopPlaying) {
      pause()
      return
    }

    setIsLoading(true)
    try {
      console.log(`[LoopCard] Attempting to play loop ID: ${loop.id}`)
      const url = await fetchLoopPlayUrl(loop.id)
      console.log(`[LoopCard] Received URL for loop ${loop.id}:`, url)
      await play(loop.id, url)
    } catch (err) {
      console.error(`[LoopCard] Error playing loop ${loop.id}:`, err)
      setError(err instanceof Error ? err.message : 'Unable to play loop')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6 shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {loop.title || loop.name}
          </h3>
          <p className="text-sm text-gray-400">
            {loop.bpm ? `${loop.bpm} BPM` : 'Loop Preview'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={isLoading}
          className="h-11 w-24 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Loading...' : isLoopPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="mt-5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {isActive ? `${progressPercent}%` : '0%'}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
