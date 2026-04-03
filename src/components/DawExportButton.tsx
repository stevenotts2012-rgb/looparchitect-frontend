'use client'

import { useState } from 'react'
import { getDawExportInfo, downloadDawExport, LoopArchitectApiError } from '@/../../api/client'

type DawExportState = 'idle' | 'checking' | 'downloading' | 'done' | 'failed'

interface DawExportButtonProps {
  arrangementId: number
}

export default function DawExportButton({ arrangementId }: DawExportButtonProps) {
  const [state, setState] = useState<DawExportState>('idle')
  const [error, setError] = useState<string | null>(null)

  const isActive = state === 'checking' || state === 'downloading'

  const handleExport = async () => {
    if (isActive) return

    setState('checking')
    setError(null)

    try {
      // Verify the export is available before downloading
      const info = await getDawExportInfo(arrangementId)

      if (!info.ready_for_export) {
        const message = info.message || 'DAW export is not ready yet. Please try again shortly.'
        setError(message)
        setState('failed')
        return
      }

      setState('downloading')
      const blob = await downloadDawExport(arrangementId)

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `arrangement_${arrangementId}_daw_export.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      setState('done')
      // Reset to idle after 3 seconds so the button is reusable
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      const message =
        err instanceof LoopArchitectApiError
          ? err.message
          : 'Failed to download DAW export. Please try again.'
      setError(message)
      setState('failed')
      console.error('[LoopArchitect] DAW export failed for arrangement', arrangementId, err)
    }
  }

  const buttonLabel = (): string => {
    switch (state) {
      case 'checking':
        return 'Checking export…'
      case 'downloading':
        return 'Downloading ZIP…'
      case 'done':
        return 'Downloaded!'
      case 'failed':
        return 'Export Failed – Retry'
      default:
        return 'DAW Export (ZIP)'
    }
  }

  const buttonClass = (): string => {
    const base = 'font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2'
    if (state === 'done') return `${base} bg-green-600 text-white cursor-default`
    if (state === 'failed') return `${base} bg-red-700 hover:bg-red-600 text-white`
    if (isActive) return `${base} bg-gray-700 cursor-not-allowed text-gray-300`
    return `${base} bg-gray-700 hover:bg-gray-600 text-white`
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleExport}
        disabled={isActive}
        className={buttonClass()}
        title="Download stems, MIDI, and markers for your DAW"
        data-testid="daw-export-button"
      >
        {isActive && (
          <svg
            className="animate-spin h-4 w-4 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {buttonLabel()}
      </button>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
