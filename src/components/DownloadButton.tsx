'use client'

import { useState, useRef, useEffect } from 'react'
import { downloadArrangement, LoopArchitectApiError } from '@/../../api/client'

type DownloadPhase = 'idle' | 'preparing' | 'fetching' | 'done' | 'failed'

interface DownloadButtonProps {
  arrangementId: number
  /** Pre-signed or public URL returned by the backend. When present the component
   *  navigates directly to this URL instead of streaming the file through the
   *  proxy, which avoids large-blob hangs. */
  downloadUrl?: string
  disabled?: boolean
}

export default function DownloadButton({
  arrangementId,
  downloadUrl,
  disabled = false,
}: DownloadButtonProps) {
  const [phase, setPhase] = useState<DownloadPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cancel any pending reset timeout when the component is unmounted so we
  // never call setState on an unmounted component.
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current)
      }
    }
  }, [])

  const isActive = phase === 'preparing' || phase === 'fetching'

  const handleDownload = async () => {
    if (isActive) return

    console.debug('[LoopArchitect] DownloadButton – download click', {
      arrangementId,
      downloadUrl,
    })

    setPhase('preparing')
    setError(null)

    try {
      if (downloadUrl) {
        // Fast path: backend already returned a signed/public URL – trigger the
        // browser download directly without streaming the blob through the proxy.
        console.debug('[LoopArchitect] DownloadButton – redirecting to signed URL', {
          downloadUrl,
        })
        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = `arrangement_${arrangementId}.mp3`
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        console.debug('[LoopArchitect] DownloadButton – browser download triggered (direct URL)')
      } else {
        // Blob path: stream the file through the Next.js proxy, then hand it to
        // the browser via an object URL.
        setPhase('fetching')
        console.debug('[LoopArchitect] DownloadButton – fetching blob', { arrangementId })

        const blob = await downloadArrangement(arrangementId)
        console.debug('[LoopArchitect] DownloadButton – blob fetched', {
          size: blob.size,
          type: blob.type,
        })

        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `arrangement_${arrangementId}.mp3`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
        console.debug('[LoopArchitect] DownloadButton – browser download triggered (blob)')
      }

      setPhase('done')
      // Reset to idle after 3 s so the button is reusable.
      resetTimeoutRef.current = setTimeout(() => {
        resetTimeoutRef.current = null
        setPhase('idle')
      }, 3000)
    } catch (err) {
      const message =
        err instanceof LoopArchitectApiError
          ? err.message
          : 'Failed to download arrangement. Please try again.'
      console.error('[LoopArchitect] DownloadButton – download failed', { arrangementId, err })
      setError(message)
      setPhase('failed')
    }
  }

  const buttonLabel = (): string => {
    switch (phase) {
      case 'preparing':
        return 'Preparing...'
      case 'fetching':
        return 'Downloading...'
      case 'done':
        return 'Downloaded!'
      case 'failed':
        return 'Download Failed – Retry'
      default:
        return 'Download Arrangement'
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={disabled || isActive}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3 group"
      >
        {isActive ? (
          <>
            <svg
              className="animate-spin h-6 w-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            <span>{buttonLabel()}</span>
          </>
        ) : (
          <>
            <svg
              className="h-6 w-6 group-hover:animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="text-lg">{buttonLabel()}</span>
          </>
        )}
      </button>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4" role="alert">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0"
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
            <div className="ml-3">
              <p className="text-sm text-red-200">{error}</p>
              <button
                onClick={handleDownload}
                className="mt-2 text-sm text-red-300 hover:text-red-100 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Helper Text */}
      {!disabled && !error && (
        <p className="text-center text-sm text-gray-400">
          Click to download your generated arrangement
        </p>
      )}
    </div>
  )
}
