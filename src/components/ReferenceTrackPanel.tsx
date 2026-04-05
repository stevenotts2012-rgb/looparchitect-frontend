'use client'

import { useRef, useState } from 'react'
import {
  analyzeReferenceTrack,
  LoopArchitectApiError,
  type ReferenceAnalysisSummary,
} from '@/../../api/client'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave']
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav']
/** Maximum reference file size: 50 MB (mirrors backend limit). */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export type AdaptationStrength = 'loose' | 'medium' | 'close'
export type GuidanceMode = 'structure' | 'energy' | 'structure_energy'

interface ReferenceTrackPanelProps {
  adaptationStrength: AdaptationStrength
  guidanceMode: GuidanceMode
  onAdaptationStrengthChange: (value: AdaptationStrength) => void
  onGuidanceModeChange: (value: GuidanceMode) => void
  onAnalysisComplete: (analysisId: string, summary: ReferenceAnalysisSummary | undefined) => void
  onAnalysisCleared: () => void
  disabled?: boolean
}

export default function ReferenceTrackPanel({
  adaptationStrength,
  guidanceMode,
  onAdaptationStrengthChange,
  onGuidanceModeChange,
  onAnalysisComplete,
  onAnalysisCleared,
  disabled = false,
}: ReferenceTrackPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReferenceAnalysisSummary | undefined>(undefined)

  const isSuccess = analysisId !== null

  const validateFile = (file: File): string | null => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    const validExt = ACCEPTED_EXTENSIONS.includes(ext)
    const validType = ACCEPTED_TYPES.some((t) => file.type === t) || file.type.startsWith('audio/')
    if (!validExt && !validType) {
      return 'Unsupported file type. Please upload an MP3 or WAV file.'
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
    }
    return null
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset prior state
    setAnalyzeError(null)
    setAnalysisId(null)
    setSummary(undefined)
    onAnalysisCleared()

    const validationError = validateFile(file)
    if (validationError) {
      setAnalyzeError(validationError)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setFileName(file.name)
    setIsAnalyzing(true)

    try {
      const result = await analyzeReferenceTrack(file)
      setAnalysisId(result.reference_analysis_id)
      setSummary(result.summary)
      onAnalysisComplete(result.reference_analysis_id, result.summary)
    } catch (err) {
      const msg =
        err instanceof LoopArchitectApiError
          ? err.message
          : 'Could not analyze the reference track. Please try again.'
      setAnalyzeError(msg)
      setAnalysisId(null)
      setSummary(undefined)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleClear = () => {
    setFileName(null)
    setAnalysisId(null)
    setSummary(undefined)
    setAnalyzeError(null)
    setIsAnalyzing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onAnalysisCleared()
  }

  const handleRetry = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-200">Use a Reference Track</p>
          <p className="text-xs text-gray-500 mt-0.5">Optional</p>
        </div>
        {isSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Reference analyzed
          </span>
        )}
      </div>

      {/* File upload row */}
      {!isSuccess && !isAnalyzing && (
        <div>
          <label
            htmlFor="reference-file-input"
            className="block text-xs text-gray-400 mb-2"
          >
            Upload a song or instrumental to guide the structure and energy of your arrangement.
          </label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              id="reference-file-input"
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleFileChange}
              disabled={disabled}
              className="hidden"
              aria-label="Upload reference track"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors border border-gray-600"
            >
              Choose file
            </button>
            <span className="text-xs text-gray-500">
              {fileName ? fileName : 'No file chosen · MP3 or WAV · max 50 MB'}
            </span>
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <svg
            className="animate-spin h-4 w-4 text-blue-400 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Analyzing reference track&hellip;</span>
          <span className="text-xs text-gray-500">{fileName}</span>
        </div>
      )}

      {/* Success state: show summary + controls + clear option */}
      {isSuccess && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-900/50 rounded-md p-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-300">
              {fileName && <span className="text-gray-400 mr-1">{fileName} ·</span>}
              Reference analyzed successfully
            </p>
            {summary && (
              <ul className="space-y-0.5">
                {summary.section_count != null && (
                  <li className="text-xs text-gray-400">
                    {summary.section_count} section{summary.section_count !== 1 ? 's' : ''} detected
                  </li>
                )}
                {summary.detected_tempo != null && (
                  <li className="text-xs text-gray-400">
                    ~{Math.round(summary.detected_tempo)} BPM
                  </li>
                )}
                {summary.structure_overview && (
                  <li className="text-xs text-gray-400">{summary.structure_overview}</li>
                )}
                {summary.energy_profile && (
                  <li className="text-xs text-gray-400">{summary.energy_profile}</li>
                )}
              </ul>
            )}
          </div>

          {/* Adaptation Strength */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Adaptation Strength
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'loose', label: 'Loose' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'close', label: 'Close' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onAdaptationStrengthChange(value)}
                  disabled={disabled}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors border disabled:cursor-not-allowed ${
                    adaptationStrength === value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Guidance Mode */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Guidance Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'structure', label: 'Structure only' },
                  { value: 'energy', label: 'Energy only' },
                  { value: 'structure_energy', label: 'Structure + Energy' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onGuidanceModeChange(value)}
                  disabled={disabled}
                  className={`py-2 px-3 rounded-md text-xs font-medium transition-colors border disabled:cursor-not-allowed ${
                    guidanceMode === value
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:cursor-not-allowed"
          >
            Remove reference track
          </button>
        </div>
      )}

      {/* Error state */}
      {analyzeError && !isAnalyzing && (
        <div className="bg-red-900/30 border border-red-800 rounded-md p-3 space-y-2">
          <div className="flex items-start gap-2">
            <svg
              className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs text-red-300">{analyzeError}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={disabled}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:cursor-not-allowed"
          >
            Try a different file
          </button>
          {/* Keep the hidden input accessible so retry works */}
          <input
            ref={fileInputRef}
            id="reference-file-input"
            type="file"
            accept=".mp3,.wav,audio/mpeg,audio/wav"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
            aria-label="Upload reference track"
          />
        </div>
      )}
    </div>
  )
}
