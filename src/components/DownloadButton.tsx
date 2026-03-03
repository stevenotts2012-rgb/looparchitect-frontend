'use client'

import { useState } from 'react'
import { downloadArrangement, LoopArchitectApiError } from '@/../../api/client'

interface DownloadButtonProps {
  arrangementId: number
  disabled?: boolean
}

export default function DownloadButton({
  arrangementId,
  disabled = false,
}: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setIsDownloading(true)
    setError(null)

    try {
      // Download the file as a Blob
      const blob = await downloadArrangement(arrangementId)

      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `arrangement_${arrangementId}.mp3` // Default filename
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to download arrangement. Please try again.')
      }
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      {/* Download Button */}
      <button
        onClick={handleDownload}
        disabled={disabled || isDownloading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3 group"
      >
        {isDownloading ? (
          <>
            <svg
              className="animate-spin h-6 w-6 text-white"
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
            <span>Downloading...</span>
          </>
        ) : (
          <>
            <svg
              className="h-6 w-6 group-hover:animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="text-lg">Download Arrangement</span>
          </>
        )}
      </button>

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
