'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import LoopCard from '@/components/LoopCard'
import { AudioManagerProvider } from '@/context/AudioManagerContext'
import { fetchLoops, type LoopResponse } from '@/lib/api'

export default function Home() {
  const [loops, setLoops] = useState<LoopResponse[]>([])
  const [isLoadingLoops, setIsLoadingLoops] = useState(true)
  const [loopsError, setLoopsError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    const loadLoops = async () => {
      setIsLoadingLoops(true)
      setLoopsError(null)

      try {
        const data = await fetchLoops()
        if (isActive) {
          console.log('[Home] Loaded loops:', data.map(l => ({ id: l.id, name: l.name })))
          setLoops(data)
        }
      } catch (err) {
        if (isActive) {
          setLoopsError(err instanceof Error ? err.message : 'Failed to load loops')
        }
      } finally {
        if (isActive) {
          setIsLoadingLoops(false)
        }
      }
    }

    loadLoops()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full space-y-10 text-center">
          {/* Hero Section */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              LoopArchitect
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-lg mx-auto">
              Professional instrumentals for your music production
            </p>
          </div>
          <AudioManagerProvider>
            <div className="rounded-3xl border border-gray-800 bg-gray-900/50 p-6 md:p-10 text-left">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold text-white">Available Loops</h2>
                <p className="text-sm text-gray-400">
                  Play any loop instantly. Only one preview plays at a time.
                </p>
              </div>

              {isLoadingLoops && (
                <div className="mt-8 text-sm text-gray-400">Loading loops...</div>
              )}

              {loopsError && (
                <div className="mt-8 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
                  {loopsError}
                </div>
              )}

              {!isLoadingLoops && !loopsError && loops.length === 0 && (
                <div className="mt-8 text-sm text-gray-400">
                  No loops available yet. Upload a loop to get started.
                </div>
              )}

              {!isLoadingLoops && !loopsError && loops.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                  {loops.map((loop) => (
                    <LoopCard key={loop.id} loop={loop} />
                  ))}
                </div>
              )}
            </div>
          </AudioManagerProvider>
        </div>
      </div>
    </main>
  )
}
