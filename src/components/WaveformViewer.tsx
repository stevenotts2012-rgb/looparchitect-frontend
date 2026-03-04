'use client'

import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface WaveformViewerProps {
  audioUrl: string
  title?: string
}

export default function WaveformViewer({ audioUrl, title = 'Waveform' }: WaveformViewerProps) {
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!waveformRef.current) return

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#60a5fa',
      progressColor: '#3b82f6',
      cursorColor: '#ffffff',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 100,
      barGap: 3,
      normalize: true,
      backend: 'WebAudio',
    })

    wavesurferRef.current = wavesurfer

    // Load audio from blob URL
    wavesurfer.load(audioUrl)

    // Handle ready event
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration())
      setIsLoading(false)
    })

    // Handle play/pause
    wavesurfer.on('play', () => setIsPlaying(true))
    wavesurfer.on('pause', () => setIsPlaying(false))

    // Handle time update
    wavesurfer.on('timeupdate', (currentTime) => {
      setCurrentTime(currentTime)
    })

    // Handle error
    wavesurfer.on('error', (error) => {
      console.error('WaveSurfer error:', error)
      setIsLoading(false)
    })

    // Cleanup
    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [audioUrl])

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {!isLoading && (
          <span className="text-sm text-gray-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        )}
      </div>

      {/* Waveform Container */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="h-[100px] flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
        <div ref={waveformRef} className={isLoading ? 'hidden' : ''} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5.75 1.5A.75.75 0 005 2.25v15.5a.75.75 0 001.5 0V2.25A.75.75 0 005.75 1.5zm8.5 0a.75.75 0 00-.75.75v15.5a.75.75 0 001.5 0V2.25a.75.75 0 00-.75-.75z" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              Play
            </>
          )}
        </button>

        {/* Download button */}
        <a
          href={audioUrl}
          download="arrangement.wav"
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </a>
      </div>
    </div>
  )
}
