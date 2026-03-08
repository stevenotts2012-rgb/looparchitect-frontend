'use client'

import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface BeforeAfterComparisonProps {
  beforeUrl: string
  afterUrl: string
  beforeTitle?: string
  afterTitle?: string
}

function isAbortLikeError(error: unknown): boolean {
  if (!error) return false

  if (typeof error === 'object' && error !== null) {
    const maybeName = 'name' in error ? String((error as { name?: unknown }).name || '') : ''
    const maybeMessage =
      'message' in error ? String((error as { message?: unknown }).message || '') : ''
    return (
      maybeName === 'AbortError' ||
      maybeMessage.includes('signal is aborted') ||
      maybeMessage.includes('aborted without reason')
    )
  }

  const message = String(error)
  return message.includes('AbortError') || message.includes('signal is aborted')
}

export default function BeforeAfterComparison({
  beforeUrl,
  afterUrl,
  beforeTitle = 'Original Loop',
  afterTitle = 'Generated Arrangement'
}: BeforeAfterComparisonProps) {
  const beforeRef = useRef<HTMLDivElement>(null)
  const afterRef = useRef<HTMLDivElement>(null)
  const beforeWsRef = useRef<WaveSurfer | null>(null)
  const afterWsRef = useRef<WaveSurfer | null>(null)
  
  const [activeView, setActiveView] = useState<'before' | 'after' | 'both'>('both')
  const [beforePlaying, setBeforePlaying] = useState(false)
  const [afterPlaying, setAfterPlaying] = useState(false)
  const [beforeTime, setBeforeTime] = useState(0)
  const [afterTime, setAfterTime] = useState(0)
  const [beforeDuration, setBeforeDuration] = useState(0)
  const [afterDuration, setAfterDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadedCount, setLoadedCount] = useState(0)

  useEffect(() => {
    if (!beforeRef.current || !afterRef.current) return

    console.log('BeforeAfterComparison: Loading audio', { beforeUrl, afterUrl })

    setIsLoading(true)
    setLoadedCount(0)
    setBeforeTime(0)
    setAfterTime(0)
    setBeforeDuration(0)
    setAfterDuration(0)
    setBeforePlaying(false)
    setAfterPlaying(false)
    
    // Safety timeout: force loading to stop after 5 seconds
    const loadingTimeout = setTimeout(() => {
      console.warn('Waveform loading timeout - forcing ready state')
      setIsLoading(false)
    }, 5000)

    const commonConfig = {
      waveColor: '#60a5fa',
      progressColor: '#3b82f6',
      cursorColor: '#ffffff',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 80,
      barGap: 3,
      normalize: true,
      backend: 'WebAudio' as const,
    }

    // Initialize Before wavesurfer
    const beforeWs = WaveSurfer.create({
      container: beforeRef.current,
      ...commonConfig,
    })
    beforeWsRef.current = beforeWs

    // Initialize After wavesurfer
    const afterWs = WaveSurfer.create({
      container: afterRef.current,
      ...commonConfig,
    })
    afterWsRef.current = afterWs

    // Load audio files
    void beforeWs.load(beforeUrl).catch((error) => {
      if (isAbortLikeError(error)) {
        // Aborted loads are silently ignored - let retry or timeout handle it
        console.log('Before waveform load aborted (expected during React remount)')
        return
      }
      console.error('Before waveform load error:', error)
      setIsLoading(false)
    })
    void afterWs.load(afterUrl).catch((error) => {
      if (isAbortLikeError(error)) {
        // Aborted loads are silently ignored - let retry or timeout handle it
        console.log('After waveform load aborted (expected during React remount)')
        return
      }
      console.error('After waveform load error:', error)
      setIsLoading(false)
    })

    // Handle ready events
    let beforeReadyHandled = false
    let afterReadyHandled = false

    const handleBeforeReady = () => {
      if (beforeReadyHandled) return
      beforeReadyHandled = true
      console.log('Before waveform ready, duration:', beforeWs.getDuration())
      setBeforeDuration(beforeWs.getDuration())
      setLoadedCount(prev => prev + 1)
    }
    const handleAfterReady = () => {
      if (afterReadyHandled) return
      afterReadyHandled = true
      console.log('After waveform ready, duration:', afterWs.getDuration())
      setAfterDuration(afterWs.getDuration())
      setLoadedCount(prev => prev + 1)
    }

    beforeWs.on('ready', handleBeforeReady)
    afterWs.on('ready', handleAfterReady)

    // Handle play/pause
    beforeWs.on('play', () => setBeforePlaying(true))
    beforeWs.on('pause', () => setBeforePlaying(false))
    afterWs.on('play', () => setAfterPlaying(true))
    afterWs.on('pause', () => setAfterPlaying(false))

    // Handle time updates
    beforeWs.on('timeupdate', setBeforeTime)
    afterWs.on('timeupdate', setAfterTime)

    beforeWs.on('error', (error) => {
      if (isAbortLikeError(error)) {
        return
      }
      console.error('Before waveform error:', error)
      setIsLoading(false)
    })

    afterWs.on('error', (error) => {
      if (isAbortLikeError(error)) {
        return
      }
      console.error('After waveform error:', error)
      setIsLoading(false)
    })

    // Cleanup
    return () => {
      clearTimeout(loadingTimeout)
      beforeWs.destroy()
      afterWs.destroy()
      beforeWsRef.current = null
      afterWsRef.current = null
    }
  }, [beforeUrl, afterUrl])

  // Update loading state when both are ready
  useEffect(() => {
    if (loadedCount === 2) {
      setIsLoading(false)
    }
  }, [loadedCount])

  const toggleBefore = () => {
    if (beforeWsRef.current) {
      beforeWsRef.current.playPause()
    }
  }

  const toggleAfter = () => {
    if (afterWsRef.current) {
      afterWsRef.current.playPause()
    }
  }

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const showBefore = activeView === 'before' || activeView === 'both'
  const showAfter = activeView === 'after' || activeView === 'both'

  return (
    <div className="w-full space-y-4">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Before & After Comparison</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('before')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              activeView === 'before'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Before
          </button>
          <button
            onClick={() => setActiveView('both')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              activeView === 'both'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setActiveView('after')}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
              activeView === 'after'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            After
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-gray-400">Loading audio comparison...</span>
          </div>
        </div>
      )}

      {/* Before Waveform */}
      {showBefore && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-white">{beforeTitle}</h4>
            <span className="text-sm text-gray-400">
              {formatTime(beforeTime)} / {formatTime(beforeDuration)}
            </span>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <div ref={beforeRef} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBefore}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              {beforePlaying ? (
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
                  Play Original
                </>
              )}
            </button>
            <a
              href={beforeUrl}
              download="original-loop.wav"
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}

      {/* After Waveform */}
      {showAfter && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-white">{afterTitle}</h4>
            <span className="text-sm text-gray-400">
              {formatTime(afterTime)} / {formatTime(afterDuration)}
            </span>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <div ref={afterRef} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAfter}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
            >
              {afterPlaying ? (
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
                  Play Arrangement
                </>
              )}
            </button>
            <a
              href={afterUrl}
              download="arrangement.wav"
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
