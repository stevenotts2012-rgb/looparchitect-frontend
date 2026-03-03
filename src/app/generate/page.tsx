'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  generateArrangement,
  getArrangementStatus,
  downloadArrangement,
  LoopArchitectApiError,
  type ArrangementStatusResponse,
} from '@/../../api/client'
import ArrangementStatus from '@/components/ArrangementStatus'
import DownloadButton from '@/components/DownloadButton'

export default function GeneratePage() {
  const [loopId, setLoopId] = useState<string>('')
  const [arrangementType, setArrangementType] = useState<'bars' | 'duration'>('bars')
  const [bars, setBars] = useState<string>('8')
  const [duration, setDuration] = useState<string>('30')

  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrangementId, setArrangementId] = useState<number | null>(null)
  const [arrangementStatus, setArrangementStatus] = useState<ArrangementStatusResponse | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const queryLoopId = urlParams.get('loopId')
    if (queryLoopId) {
      setLoopId(queryLoopId)
    }
  }, [])

  // Poll arrangement status
  useEffect(() => {
    if (!arrangementId) return

    const pollStatus = async () => {
      try {
        const status = await getArrangementStatus(arrangementId)
        setArrangementStatus(status)

        // Stop polling if done/completed or failed
        if (status.status === 'done' || status.status === 'completed' || status.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          // If done/completed, prepare audio preview
          if (status.status === 'done' || status.status === 'completed') {
            try {
              const blob = await downloadArrangement(arrangementId)
              const url = URL.createObjectURL(blob)
              setAudioUrl(url)
            } catch (err) {
              console.error('Failed to load audio preview:', err)
            }
          }
        }
      } catch (err) {
        console.error('Error polling status:', err)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }

    // Initial poll
    pollStatus()

    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(pollStatus, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [arrangementId])

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const handleGenerate = async () => {
    if (!loopId) {
      setError('Please enter a Loop ID')
      return
    }

    const loopIdNum = parseInt(loopId, 10)
    if (isNaN(loopIdNum) || loopIdNum <= 0) {
      setError('Loop ID must be a positive number')
      return
    }

    setIsGenerating(true)
    setError(null)
    setArrangementId(null)
    setArrangementStatus(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    try {
      const options: { bars?: number; duration?: number } = {}
      
      if (arrangementType === 'bars') {
        const barsNum = parseInt(bars, 10)
        if (isNaN(barsNum) || barsNum <= 0) {
          setError('Bars must be a positive number')
          setIsGenerating(false)
          return
        }
        options.bars = barsNum
      } else {
        const durationNum = parseInt(duration, 10)
        if (isNaN(durationNum) || durationNum <= 0) {
          setError('Duration must be a positive number')
          setIsGenerating(false)
          return
        }
        options.duration = durationNum
      }

      const response = await generateArrangement(loopIdNum, options)
      setArrangementId(response.arrangement_id)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        // Check for missing file error (400 status with "missing" in message)
        if (err.status === 400 && err.message.toLowerCase().includes('missing')) {
          setError(`file_missing:${err.message}`)
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to generate arrangement. Please try again.')
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg
                className="h-8 w-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <h1 className="text-2xl font-bold text-white">LoopArchitect</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Upload
              </Link>
              <Link
                href="/generate"
                className="text-white font-medium hover:text-blue-400 transition-colors"
              >
                Generate
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="max-w-3xl w-full space-y-10">
          {/* Page Title */}
          <div className="text-center space-y-3">
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Generate Arrangement
            </h2>
            <p className="text-lg text-gray-400">
              Create a professional arrangement from your uploaded loop
            </p>
          </div>

          {/* Generation Form */}
          {!arrangementId && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 space-y-6">
              {/* Loop ID Input */}
              <div>
                <label
                  htmlFor="loop-id"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Loop ID *
                </label>
                <input
                  id="loop-id"
                  type="number"
                  value={loopId}
                  onChange={(e) => setLoopId(e.target.value)}
                  placeholder="Enter loop ID"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                  min="1"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter the ID of the loop you uploaded
                </p>
              </div>

              {/* Arrangement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Arrangement Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setArrangementType('bars')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      arrangementType === 'bars'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <span>By Bars</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setArrangementType('duration')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      arrangementType === 'duration'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>By Duration</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bars/Duration Input */}
              {arrangementType === 'bars' ? (
                <div>
                  <label
                    htmlFor="bars"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Number of Bars *
                  </label>
                  <input
                    id="bars"
                    type="number"
                    value={bars}
                    onChange={(e) => setBars(e.target.value)}
                    placeholder="e.g., 8, 16, 32"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating}
                    min="1"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Typical values: 4, 8, 16, 32
                  </p>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Duration (seconds) *
                  </label>
                  <input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 30, 60, 120"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating}
                    min="1"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Recommended: 30-180 seconds
                  </p>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3 flex-1">
                      {error.startsWith('file_missing:') ? (
                        <>
                          <p className="text-sm font-medium text-red-200">
                            Loop source file not found
                          </p>
                          <p className="text-sm text-red-300 mt-1">
                            The loop file associated with this ID is no longer available. Please upload a new loop to generate an arrangement.
                          </p>
                          <Link
                            href="/"
                            className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <svg
                              className="h-4 w-4 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                            Upload New Loop
                          </Link>
                        </>
                      ) : (
                        <p className="text-sm text-red-200">{error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !loopId}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3"
              >
                {isGenerating ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span>Generate Arrangement</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Arrangement Status */}
          {arrangementId && arrangementStatus && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ArrangementStatus arrangement={arrangementStatus} />

              {/* Audio Preview */}
              {arrangementStatus.status === 'completed' && audioUrl && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Preview Your Arrangement
                  </h3>
                  <audio
                    controls
                    src={audioUrl}
                    className="w-full"
                    style={{
                      borderRadius: '8px',
                      backgroundColor: '#1f2937',
                    }}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Download Button */}
              {arrangementStatus.status === 'completed' && (
                <DownloadButton arrangementId={arrangementId} />
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setArrangementId(null)
                    setArrangementStatus(null)
                    setError(null)
                    if (audioUrl) {
                      URL.revokeObjectURL(audioUrl)
                      setAudioUrl(null)
                    }
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Generate Another
                </button>
                <Link
                  href="/"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                >
                  Upload New Loop
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
