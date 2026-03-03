'use client'

import { useState } from 'react'
import type { Arrangement } from '@/../../api/client'

interface GenerationHistoryProps {
  rows: Arrangement[]
  loading: boolean
  error: string | null
  activeArrangementId: number | null
  onRefresh: () => void
  onTrack: (arrangementId: number) => void
  onDownload: (arrangementId: number) => void
  onRetry: (loopId: number, targetSeconds: number) => void
  onFilterChange: (statusFilter: string, loopIdFilter: string) => void
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function isCompletedStatus(status: Arrangement['status']): boolean {
  return status === 'done' || status === 'completed'
}

export default function GenerationHistory({
  rows,
  loading,
  error,
  activeArrangementId,
  onRefresh,
  onTrack,
  onDownload,
  onRetry,
  onFilterChange,
}: GenerationHistoryProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loopIdFilter, setLoopIdFilter] = useState<string>('')

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    onFilterChange(newStatus, loopIdFilter)
  }

  const handleLoopIdChange = (newLoopId: string) => {
    setLoopIdFilter(newLoopId)
    onFilterChange(statusFilter, newLoopId)
  }

  const handleClearFilters = () => {
    setStatusFilter('all')
    setLoopIdFilter('')
    onFilterChange('all', '')
  }

  const hasActiveFilters = statusFilter !== 'all' || loopIdFilter !== ''

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Recent Generations</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label htmlFor="status-filter" className="block text-xs text-gray-400 mb-1">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="loop-filter" className="block text-xs text-gray-400 mb-1">
            Loop ID
          </label>
          <input
            id="loop-filter"
            type="number"
            value={loopIdFilter}
            onChange={(e) => handleLoopIdChange(e.target.value)}
            placeholder="Filter by loop ID"
            className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No arrangements yet. Generate one to see history here.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isActive = activeArrangementId === row.id
            const done = isCompletedStatus(row.status)

            return (
              <div
                key={row.id}
                className={`border rounded-lg p-4 ${
                  isActive ? 'border-blue-600 bg-blue-950/30' : 'border-gray-800 bg-gray-900/40'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-200 font-medium">
                      Arrangement #{row.id} • Loop #{row.loop_id}
                    </p>
                    <p className="text-xs text-gray-400">
                      Status: <span className="uppercase">{row.status}</span>
                      {row.target_seconds ? ` • Target: ${row.target_seconds}s` : ''}
                    </p>
                    <p className="text-xs text-gray-500">Created: {formatTime(row.created_at)}</p>
                    {row.error_message && (
                      <p className="text-xs text-red-300 line-clamp-2">Error: {row.error_message}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onTrack(row.id)}
                      className="px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-lg transition-colors"
                    >
                      Track
                    </button>
                    {row.status === 'failed' && row.target_seconds && (
                      <button
                        onClick={() => onRetry(row.loop_id, row.target_seconds || 30)}
                        className="px-3 py-2 text-sm bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                        title="Retry this arrangement"
                      >
                        Retry
                      </button>
                    )}
                    {done && (
                      <button
                        onClick={() => onDownload(row.id)}
                        className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
