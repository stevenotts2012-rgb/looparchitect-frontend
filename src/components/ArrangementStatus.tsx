'use client'

import type { ArrangementStatusResponse } from '@/../../api/client'

interface ArrangementStatusProps {
  arrangement: ArrangementStatusResponse
}

export default function ArrangementStatus({ arrangement }: ArrangementStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
      case 'pending':
        return 'bg-yellow-900/50 border-yellow-700 text-yellow-200'
      case 'processing':
        return 'bg-blue-900/50 border-blue-700 text-blue-200'
      case 'done':
      case 'completed':
        return 'bg-green-900/50 border-green-700 text-green-200'
      case 'failed':
        return 'bg-red-900/50 border-red-700 text-red-200'
      default:
        return 'bg-gray-900/50 border-gray-700 text-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
      case 'pending':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        )
      case 'processing':
        return (
          <svg
            className="animate-spin h-5 w-5"
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
        )
      case 'done':
      case 'completed':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        )
      case 'failed':
        return (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued':
      case 'pending':
        return 'Waiting in queue...'
      case 'processing':
        return 'Generating arrangement...'
      case 'done':
      case 'completed':
        return 'Arrangement ready!'
      case 'failed':
        return 'Generation failed'
      default:
        return status
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Status Card */}
      <div
        className={`border rounded-lg p-6 ${getStatusColor(arrangement.status)}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon(arrangement.status)}
            <div>
              <h3 className="text-lg font-semibold">
                {getStatusText(arrangement.status)}
              </h3>
              <p className="text-sm opacity-80 mt-1">
                Arrangement ID: {arrangement.id}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide bg-black/30">
            {arrangement.status}
          </span>
        </div>

        {/* Progress Bar */}
        {arrangement.status === 'processing' && arrangement.progress !== undefined && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{arrangement.progress}%</span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${arrangement.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {arrangement.status === 'failed' && arrangement.error_message && (
          <div className="mt-4 p-3 bg-black/30 rounded border border-red-800">
            <p className="text-sm font-medium mb-1">Error Details:</p>
            <p className="text-sm opacity-90">{arrangement.error_message}</p>
          </div>
        )}

        {/* Output File Info */}
        {(arrangement.status === 'done' || arrangement.status === 'completed') && arrangement.output_file && (
          <div className="mt-4 p-3 bg-black/30 rounded border border-green-800">
            <div className="flex items-center space-x-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium">File ready for download</p>
            </div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="mt-4 text-center text-sm text-gray-400">
        {arrangement.status === 'processing' && (
          <p>This may take a few minutes. Status updates every 3 seconds.</p>
        )}
        {arrangement.status === 'pending' && (
          <p>Your request is in the queue and will be processed shortly.</p>
        )}
      </div>
    </div>
  )
}
