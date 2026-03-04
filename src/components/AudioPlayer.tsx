'use client'

import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

interface AudioPlayerProps {
  url: string | null
  autoPlay?: boolean
  disabled?: boolean
  audioRef: RefObject<HTMLAudioElement>
  playbackKey?: number
}

export default function AudioPlayer({
  url,
  autoPlay = false,
  disabled = false,
  audioRef,
  playbackKey = 0,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [url])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (disabled || !url) {
      audio.pause()
      audio.currentTime = 0
      setIsPlaying(false)
      return
    }

    audio.load()

    if (autoPlay) {
      audio.play().catch((err) => {
        console.error('Autoplay failed:', err)
        setError(true)
      })
    }
  }, [url, autoPlay, disabled, playbackKey, audioRef])

  const handlePlay = () => setIsPlaying(true)
  const handlePause = () => setIsPlaying(false)
  const handleError = () => {
    setError(true)
    setIsPlaying(false)
  }

  if (error && !disabled) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-red-500/10 border border-red-500/50 rounded-lg">
        <p className="text-red-400 text-center">
          Unable to load audio. Please try again.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-2xl border border-gray-700/50">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isPlaying 
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 animate-pulse' 
                : 'bg-gray-700'
            }`}>
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                {isPlaying ? (
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                ) : (
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                )}
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              Instrumental Preview
            </h3>
            <p className="text-sm text-gray-400">
              {disabled ? 'Preview Unavailable' : isPlaying ? 'Now Playing' : 'Ready to Play'}
            </p>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={url ?? ''}
          controls={!disabled}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          className={`w-full h-12 rounded-lg ${disabled ? 'opacity-60' : ''}`}
          preload={disabled ? 'none' : 'auto'}
        />

        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>High Quality Audio</span>
          <span>Ready to Download</span>
        </div>
      </div>
    </div>
  )
}
