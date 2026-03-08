'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  generateArrangement,
  getArrangementStatus,
  downloadArrangement,
  downloadDawExport,
  listArrangements,
  listStylePresets,
  validateLoopSource,
  getLoop,
  downloadLoop,
  validateStyle,
  LoopArchitectApiError,
  type Arrangement,
  type ArrangementStatusResponse,
  type StylePresetResponse,
} from '@/../../api/client'
import ArrangementStatus from '@/components/ArrangementStatus'
import DownloadButton from '@/components/DownloadButton'
import GenerationHistory from '@/components/GenerationHistory'
import WaveformViewer from '@/components/WaveformViewer'
import BeforeAfterComparison from '@/components/BeforeAfterComparison'
import { ArrangementTimeline } from '@/components/ArrangementTimeline'
import { StyleSliders } from '@/components/StyleSliders'
import { StyleTextInput } from '@/components/StyleTextInput'
import { ProducerMoves } from '@/components/ProducerMoves'
import { HelpButton } from '@/components/HelpButton'
import { SimpleStyleProfile } from '@/lib/styleSchema'

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
  const [loopAudioUrl, setLoopAudioUrl] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<Arrangement[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all')
  const [historyLoopIdFilter, setHistoryLoopIdFilter] = useState<string>('')
  const [stylePresets, setStylePresets] = useState<StylePresetResponse[]>([])
  const [stylePreset, setStylePreset] = useState<string>('')
  const [seed, setSeed] = useState<string>('')
  const [selectedMoves, setSelectedMoves] = useState<string[]>([])
  const [structurePreview, setStructurePreview] = useState<Array<{ name: string; bars: number; energy: number }>>([])

  // V2: Natural language style input
  const [styleMode, setStyleMode] = useState<'preset' | 'naturalLanguage'>('preset')
  const [styleTextInput, setStyleTextInput] = useState<string>('')
  const [useAiParsing, setUseAiParsing] = useState<boolean>(true)
  
  // PHASE 3: Style parameters from sliders
  const [styleProfile, setStyleProfile] = useState<Partial<SimpleStyleProfile>>({
    intent: '',
    energy: 0.5,
    darkness: 0.5,
    bounce: 0.5,
    warmth: 0.5,
    texture: 'balanced',
    references: [],
    avoid: [],
    seed: 42,
    confidence: 0.8,
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const loopAudioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const queryLoopId = urlParams.get('loopId')
    if (queryLoopId) {
      setLoopId(queryLoopId)
    }
  }, [])

  const loadHistory = async (requestedLoopId?: number, statusFilter?: string) => {
    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const rows = await listArrangements({
        loopId: requestedLoopId,
        status: statusFilter || historyStatusFilter,
        limit: 10,
      })
      setHistoryRows(rows)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setHistoryError(err.message)
      } else {
        setHistoryError('Failed to load generation history.')
      }
    } finally {
      setIsHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  useEffect(() => {
    const loadStyles = async () => {
      try {
        const presets = await listStylePresets()
        setStylePresets(presets)
        if (presets.length > 0) {
          setStylePreset(presets[0].id)
        }
      } catch {
        setStylePresets([])
      }
    }
    loadStyles()
  }, [])

  // Poll arrangement status
  useEffect(() => {
    if (!arrangementId) return

    const pollStatus = async () => {
      try {
        const status = await getArrangementStatus(arrangementId)
        setArrangementStatus(status)

        const isFinished =
          status.status === 'done' || status.status === 'completed' || status.status === 'failed'

        if (isFinished) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          await loadHistory()

          if (status.status === 'done' || status.status === 'completed') {
            try {
              const blob = await downloadArrangement(arrangementId)
              const url = URL.createObjectURL(blob)
              setAudioUrl(url)

              // Also load the original loop audio for comparison
              if (loopId) {
                try {
                  const loopUrl = await downloadLoop(parseInt(loopId))
                  setLoopAudioUrl(loopUrl)
                } catch (loopErr) {
                  console.error('Failed to load loop audio:', loopErr)
                }
              }
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

  useEffect(() => {
    audioUrlRef.current = audioUrl
  }, [audioUrl])

  useEffect(() => {
    loopAudioUrlRef.current = loopAudioUrl
  }, [loopAudioUrl])

  // Cleanup audio URLs only on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
      if (loopAudioUrlRef.current) {
        URL.revokeObjectURL(loopAudioUrlRef.current)
      }
    }
  }, [])

  const handleHistoryRefresh = async () => {
    const loopIdNum = parseInt(historyLoopIdFilter || loopId, 10)
    const validLoopId = !Number.isNaN(loopIdNum) && loopIdNum > 0 ? loopIdNum : undefined
    await loadHistory(validLoopId, historyStatusFilter)
  }

  const handleHistoryDownload = async (selectedArrangementId: number) => {
    try {
      const blob = await downloadArrangement(selectedArrangementId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `arrangement_${selectedArrangementId}.wav`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to download arrangement.')
      }
    }
  }

  const handleFilterChange = (status: string, loopId: string) => {
    setHistoryStatusFilter(status)
    setHistoryLoopIdFilter(loopId)
    
    const loopIdNum = loopId ? parseInt(loopId, 10) : undefined
    const validLoopId = loopIdNum && !Number.isNaN(loopIdNum) && loopIdNum > 0 ? loopIdNum : undefined
    
    loadHistory(validLoopId, status)
  }

  const handleRetry = (retryLoopId: number, targetSeconds: number) => {
    setLoopId(String(retryLoopId))
    setArrangementType('duration')
    setDuration(String(targetSeconds))
    setArrangementId(null)
    setArrangementStatus(null)
    setError(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    if (loopAudioUrl) {
      URL.revokeObjectURL(loopAudioUrl)
      setLoopAudioUrl(null)
    }
  }

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
    setStructurePreview([])
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    if (loopAudioUrl) {
      URL.revokeObjectURL(loopAudioUrl)
      setLoopAudioUrl(null)
    }

    try {
      // Pre-check loop source availability so users don't queue doomed jobs
      await validateLoopSource(loopIdNum)
      const loopDetails = await getLoop(loopIdNum)
      const loopBpm = Number(loopDetails.bpm || loopDetails.tempo || 120)

      const options: { 
        bars?: number
        duration?: number
        loopBpm?: number
        stylePreset?: string
        styleParams?: Record<string, number | string>
        seed?: number | string
        styleTextInput?: string
        useAiParsing?: boolean
        producerMoves?: string[]
      } = {}
      
      if (arrangementType === 'bars') {
        const barsNum = parseInt(bars, 10)
        if (isNaN(barsNum) || barsNum <= 0) {
          setError('Bars must be a positive number')
          setIsGenerating(false)
          return
        }
        options.bars = barsNum
        options.loopBpm = loopBpm
      } else {
        const durationNum = parseInt(duration, 10)
        if (isNaN(durationNum) || durationNum <= 0) {
          setError('Duration must be a positive number')
          setIsGenerating(false)
          return
        }
        options.duration = durationNum
      }

      // V2: Include natural language style input if in that mode
      if (styleMode === 'naturalLanguage') {
        if (!styleTextInput.trim()) {
          setError('Please enter a style description or switch to Preset mode')
          setIsGenerating(false)
          return
        }
        options.styleTextInput = styleTextInput.trim()
        options.useAiParsing = useAiParsing
        
        // PHASE 4: Include style slider values if any are set
        if (styleProfile && Object.keys(styleProfile).length > 0) {
          options.styleParams = styleProfile as Record<string, number | string>
        }
      } else {
        // V1: Include preset-based style
        if (stylePreset) {
          options.stylePreset = stylePreset
        }
      }
      
      if (seed.trim()) {
        const numericSeed = Number(seed)
        options.seed = Number.isNaN(numericSeed) ? seed.trim() : numericSeed
      }

      // Include producer moves
      if (selectedMoves.length > 0) {
        options.producerMoves = selectedMoves
      }

      const response = await generateArrangement(loopIdNum, options)
      setArrangementId(response.arrangement_id)
      setStructurePreview(response.structure_preview || [])
      await loadHistory(loopIdNum)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        // Check for missing file error (400 status with "missing" in message)
        if ((err.status === 400 || err.status === 404) && err.message.toLowerCase().includes('missing')) {
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
              <HelpButton contentKey="generate" variant="icon" />
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

              {/* V2: Style Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Style Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setStyleMode('preset')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      styleMode === 'preset'
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
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                        />
                      </svg>
                      <span>Preset</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setStyleMode('naturalLanguage')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      styleMode === 'naturalLanguage'
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span>Natural Language</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* V1: Style Preset (shown when preset mode) */}
              {styleMode === 'preset' && (
                <div>
                  <label
                    htmlFor="style-preset"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Style Preset
                  </label>
                  <select
                    id="style-preset"
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating || stylePresets.length === 0}
                  >
                    {stylePresets.length === 0 ? (
                      <option value="">Default (style engine unavailable)</option>
                    ) : (
                      stylePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.display_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* V2: Natural Language Input (shown when natural language mode) */}
              {styleMode === 'naturalLanguage' && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="style-text"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Describe Your Style *
                    </label>
                    <textarea
                      id="style-text"
                      value={styleTextInput}
                      onChange={(e) => setStyleTextInput(e.target.value.slice(0, 500))}
                      placeholder="e.g., 'Southside type, aggressive, beat switch after hook' or 'Dark cinematic, Metro vibe, minimal bounce'"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      disabled={isGenerating}
                      maxLength={500}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {styleTextInput.length}/500 characters
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      id="use-ai"
                      type="checkbox"
                      checked={useAiParsing}
                      onChange={(e) => setUseAiParsing(e.target.checked)}
                      className="w-4 h-4 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                      disabled={isGenerating}
                    />
                    <label htmlFor="use-ai" className="text-sm text-gray-300 cursor-pointer">
                      Use AI to parse natural language (recommended)
                    </label>
                  </div>

                  {/* PHASE 3: Style Sliders for fine-tuning */}
                  <StyleSliders
                    initialValues={styleProfile}
                    onChange={(updatedStyle) => {
                      setStyleProfile({ ...styleProfile, ...updatedStyle })
                    }}
                    disabled={isGenerating}
                  />
                </div>
              )}

              {/* Style Preset (kept for preset mode) */}

              {/* Producer Moves */}
              <ProducerMoves
                selectedMoves={selectedMoves}
                onChange={setSelectedMoves}
                disabled={isGenerating}
              />

              {/* Seed */}
              <div>
                <label
                  htmlFor="seed"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Seed (optional)
                </label>
                <input
                  id="seed"
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="e.g., 42 or atl-demo"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>

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

              {structurePreview.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Structure Preview
                    </h3>
                    <span className="text-xs text-gray-400">
                      {structurePreview.reduce((sum, s) => sum + s.bars, 0)} total bars
                    </span>
                  </div>
                  <ArrangementTimeline
                    sections={structurePreview.map((section, index) => ({
                      name: section.name,
                      bar_start: structurePreview.slice(0, index).reduce((sum, s) => sum + s.bars, 0),
                      bars: section.bars,
                      energy: section.energy,
                    }))}
                    totalBars={structurePreview.reduce((sum, s) => sum + s.bars, 0)}
                  />
                </div>
              )}
            </div>
          )}

          <GenerationHistory
            rows={historyRows}
            loading={isHistoryLoading}
            error={historyError}
            activeArrangementId={arrangementId}
            onRefresh={handleHistoryRefresh}
            onTrack={(selectedArrangementId) => {
              setArrangementId(selectedArrangementId)
              setError(null)
            }}
            onDownload={handleHistoryDownload}
            onRetry={handleRetry}
            onFilterChange={handleFilterChange}
          />

          {/* Arrangement Status */}
          {arrangementId && arrangementStatus && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ArrangementStatus arrangement={arrangementStatus} />

              {/* Audio Waveform Preview */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && audioUrl && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  {loopAudioUrl ? (
                    <BeforeAfterComparison
                      beforeUrl={loopAudioUrl}
                      afterUrl={audioUrl}
                      beforeTitle="Original Loop"
                      afterTitle="Generated Arrangement"
                    />
                  ) : (
                    <WaveformViewer audioUrl={audioUrl} title="Preview Your Arrangement" />
                  )}
                </div>
              )}

              {/* Download Button */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <DownloadButton arrangementId={arrangementId} />
                  <button
                    onClick={async () => {
                      try {
                        const blob = await downloadDawExport(arrangementId)
                        const url = window.URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `arrangement_${arrangementId}_daw_export.zip`
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                        window.URL.revokeObjectURL(url)
                      } catch (err) {
                        console.error('Failed to download DAW export:', err)
                        alert('Failed to download DAW export. Please try again.')
                      }
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    title="Download stems, MIDI, and markers for your DAW"
                  >
                    DAW Export (ZIP)
                  </button>
                </div>
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
