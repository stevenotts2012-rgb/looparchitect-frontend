'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface AudioManagerValue {
  currentLoopId: number | null
  isPlaying: boolean
  progress: number
  duration: number
  play: (loopId: number, url: string) => Promise<void>
  pause: () => void
}

const AudioManagerContext = createContext<AudioManagerValue | null>(null)

export function AudioManagerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentLoopId, setCurrentLoopId] = useState<number | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0
    setDuration(nextDuration)
    const ratio = nextDuration ? audio.currentTime / nextDuration : 0
    setProgress(Math.min(1, Math.max(0, ratio)))
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
    }
    const handleTimeUpdate = () => updateProgress()
    const handleLoaded = () => updateProgress()

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoaded)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoaded)
    }
  }, [updateProgress])

  const play = useCallback(
    async (loopId: number, url: string) => {
      const audio = audioRef.current
      if (!audio) return

      const isNewLoop = currentLoopId !== loopId || currentUrl !== url
      if (isNewLoop) {
        audio.pause()
        audio.currentTime = 0
        audio.src = url
        audio.load()
        setProgress(0)
        setCurrentUrl(url)
      }

      setCurrentLoopId(loopId)

      try {
        await audio.play()
      } catch (error) {
        setIsPlaying(false)
        throw error
      }
    },
    [currentLoopId, currentUrl]
  )

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
  }, [])

  const value = useMemo(
    () => ({
      currentLoopId,
      isPlaying,
      progress,
      duration,
      play,
      pause,
    }),
    [currentLoopId, isPlaying, progress, duration, play, pause]
  )

  return (
    <AudioManagerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} className="hidden" preload="auto" />
    </AudioManagerContext.Provider>
  )
}

export function useAudioManager() {
  const context = useContext(AudioManagerContext)
  if (!context) {
    throw new Error('useAudioManager must be used within an AudioManagerProvider')
  }
  return context
}
