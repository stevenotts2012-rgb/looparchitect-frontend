'use client'

import { useState } from 'react'
import type { ReferenceAnalysisSummary } from '@/../../api/client'
import type { AdaptationStrength, GuidanceMode } from './ReferenceTrackPanel'

interface ReferenceGuidancePanelProps {
  summary: ReferenceAnalysisSummary | null | undefined
  adaptationStrength: AdaptationStrength
  guidanceMode: GuidanceMode
  /** Backend-provided human-readable structure summary, if available. */
  referenceStructureSummary?: string | null
  /** Producer notes that may include reference-guided annotations. */
  producerNotes?: string[] | null
}

const ADAPTATION_LABELS: Record<AdaptationStrength, string> = {
  loose: 'Loose',
  medium: 'Medium',
  close: 'Close',
}

const GUIDANCE_MODE_LABELS: Record<GuidanceMode, string> = {
  structure: 'Structure only',
  energy: 'Energy only',
  structure_energy: 'Structure + Energy',
}

export function ReferenceGuidancePanel({
  summary,
  adaptationStrength,
  guidanceMode,
  referenceStructureSummary,
  producerNotes,
}: ReferenceGuidancePanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-800/40 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="reference-guidance-body"
      >
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-indigo-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
          <span className="text-sm font-semibold text-gray-200">Reference Guidance</span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {isExpanded && (
        <div id="reference-guidance-body" className="px-5 pb-5 space-y-4 border-t border-gray-700/60">
          {/* Disclaimer */}
          <p className="text-xs text-gray-400 pt-4 leading-relaxed">
            This arrangement was guided by the structure and energy of your reference track.
            No musical content was copied.
          </p>

          {/* Reference summary */}
          {summary && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-300">Reference Summary</p>
              <ul className="space-y-0.5">
                {summary.section_count != null && (
                  <li className="text-xs text-gray-400">
                    {summary.section_count} section{summary.section_count !== 1 ? 's' : ''} detected
                  </li>
                )}
                {summary.detected_tempo != null && (
                  <li className="text-xs text-gray-400">
                    ~{Math.round(summary.detected_tempo)} BPM reference tempo
                  </li>
                )}
                {summary.structure_overview && (
                  <li className="text-xs text-gray-400">{summary.structure_overview}</li>
                )}
                {summary.energy_profile && (
                  <li className="text-xs text-gray-400">{summary.energy_profile}</li>
                )}
              </ul>
            </div>
          )}

          {/* Backend structure summary */}
          {referenceStructureSummary && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-300">Structure Analysis</p>
              <p className="text-xs text-gray-400">{referenceStructureSummary}</p>
            </div>
          )}

          {/* Guidance settings used */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-md p-3 space-y-0.5">
              <p className="text-xs text-gray-500">Adaptation Strength</p>
              <p className="text-sm font-medium text-white">{ADAPTATION_LABELS[adaptationStrength]}</p>
            </div>
            <div className="bg-gray-800/50 rounded-md p-3 space-y-0.5">
              <p className="text-xs text-gray-500">Guidance Mode</p>
              <p className="text-sm font-medium text-white">{GUIDANCE_MODE_LABELS[guidanceMode]}</p>
            </div>
          </div>

          {/* Producer notes that may include reference-related annotations */}
          {producerNotes && producerNotes.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-300">Producer Notes</p>
              <ul className="space-y-0.5">
                {producerNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                    <span className="text-indigo-400 mt-0.5 flex-shrink-0">›</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
