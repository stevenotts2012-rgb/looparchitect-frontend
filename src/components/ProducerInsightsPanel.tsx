'use client'

import React, { useState } from 'react'
import type {
  ProducerPlanV2,
  QualityScore,
  DecisionLogEntry,
  SectionSummaryItem,
} from '@/../../api/client'

// ============================================================================
// Helpers
// ============================================================================

function getQualityLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Poor'
}

function getQualityColorClass(score: number): string {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 70) return 'text-green-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function getQualityBgClass(score: number): string {
  if (score >= 90) return 'bg-emerald-900/30 border-emerald-800'
  if (score >= 70) return 'bg-green-900/30 border-green-800'
  if (score >= 40) return 'bg-yellow-900/30 border-yellow-800'
  return 'bg-red-900/30 border-red-800'
}

function getDensityBadgeClass(density: string): string {
  switch (density) {
    case 'full':
      return 'bg-red-900/40 text-red-300 border-red-800'
    case 'medium':
      return 'bg-yellow-900/40 text-yellow-300 border-yellow-800'
    case 'sparse':
    default:
      return 'bg-blue-900/40 text-blue-300 border-blue-800'
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/60 hover:bg-gray-800/90 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          {icon}
          {title}
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  )
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const clampedScore = Math.min(100, Math.max(0, score))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className={`font-mono font-semibold ${getQualityColorClass(clampedScore)}`}>
          {clampedScore}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            clampedScore >= 90
              ? 'bg-emerald-500'
              : clampedScore >= 70
              ? 'bg-green-500'
              : clampedScore >= 40
              ? 'bg-yellow-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${clampedScore}%` }}
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          aria-label={label}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Main component
// ============================================================================

export interface ProducerInsightsPanelProps {
  producerPlan?: ProducerPlanV2 | null
  producerNotes?: string[] | null
  qualityScore?: QualityScore | null
  sectionSummary?: SectionSummaryItem[] | null
  decisionLog?: DecisionLogEntry[] | null
}

export function ProducerInsightsPanel({
  producerPlan,
  producerNotes,
  qualityScore,
  sectionSummary,
  decisionLog,
}: ProducerInsightsPanelProps) {
  const hasAnyData =
    (qualityScore != null) ||
    (producerNotes != null && producerNotes.length > 0) ||
    (sectionSummary != null && sectionSummary.length > 0) ||
    (decisionLog != null && decisionLog.length > 0) ||
    (producerPlan != null && producerPlan.sections.length > 0)

  if (!hasAnyData) return null

  return (
    <div className="space-y-3" data-testid="producer-insights-panel">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <svg
          className="w-4 h-4 text-purple-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        Producer Engine V2
      </h3>

      {/* Quality Score */}
      {qualityScore != null && (
        <CollapsibleSection
          title="Quality Score"
          icon={
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          }
        >
          <div className={`rounded-lg border p-4 mb-4 ${getQualityBgClass(qualityScore.overall_score)}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Overall Score</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${getQualityColorClass(qualityScore.overall_score)}`}
                  data-testid="overall-score"
                >
                  {qualityScore.overall_score}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getQualityBgClass(qualityScore.overall_score)} ${getQualityColorClass(qualityScore.overall_score)}`}
                  data-testid="quality-label"
                >
                  {getQualityLabel(qualityScore.overall_score)}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <ScoreBar label="Structure" score={qualityScore.structure_score} />
            <ScoreBar label="Transitions" score={qualityScore.transition_score} />
            <ScoreBar label="Audio Quality" score={qualityScore.audio_quality_score} />
          </div>
        </CollapsibleSection>
      )}

      {/* Section Summary */}
      {sectionSummary != null && sectionSummary.length > 0 && (
        <CollapsibleSection
          title="Section Summary"
          icon={
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }
        >
          <div className="space-y-2">
            {sectionSummary.map((section) => (
              <div
                key={section.index}
                className="flex items-center gap-3 bg-gray-800/50 rounded-md px-3 py-2"
                data-testid="section-summary-item"
              >
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 text-xs text-gray-400 font-mono flex-shrink-0">
                  {section.index + 1}
                </span>
                <span className="text-sm font-medium text-white capitalize w-24 flex-shrink-0">
                  {section.section_type}
                </span>
                <span className="text-xs text-gray-400 w-12 flex-shrink-0">
                  {section.bars}b
                </span>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, section.energy * 100)}%` }}
                    aria-label={`Energy ${Math.round(section.energy * 100)}%`}
                  />
                </div>
                {section.roles.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {section.roles.slice(0, 3).map((role) => (
                      <span
                        key={role}
                        className="px-1 py-0.5 bg-gray-700 text-gray-300 rounded text-xs"
                      >
                        {role}
                      </span>
                    ))}
                    {section.roles.length > 3 && (
                      <span className="text-xs text-gray-500">+{section.roles.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Decision Log */}
      {decisionLog != null && decisionLog.length > 0 && (
        <CollapsibleSection
          title="Decision Log"
          defaultOpen={false}
          icon={
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        >
          <div className="space-y-3">
            {decisionLog.map((entry, i) => (
              <div key={i} className="space-y-1" data-testid="decision-log-entry">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs capitalize font-medium">
                    {entry.section_type}
                  </span>
                  <span className="text-xs text-white">{entry.decision}</span>
                </div>
                {entry.rationale && (
                  <p className="text-xs text-gray-400 pl-2 border-l border-gray-700">
                    {entry.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Producer Notes */}
      {producerNotes != null && producerNotes.length > 0 && (
        <CollapsibleSection
          title="Producer Notes"
          defaultOpen={false}
          icon={
            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          }
        >
          <ul className="space-y-2">
            {producerNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300" data-testid="producer-note">
                <span className="text-purple-500 mt-0.5 flex-shrink-0">›</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {/* Producer Plan V2 */}
      {producerPlan != null && producerPlan.sections.length > 0 && (
        <CollapsibleSection
          title="Producer Plan"
          defaultOpen={false}
          icon={
            <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        >
          {producerPlan.strategy && (
            <p className="text-xs text-gray-400 mb-3 italic">{producerPlan.strategy}</p>
          )}
          <div className="space-y-3">
            {producerPlan.sections.map((section) => (
              <div
                key={section.index}
                className="bg-gray-800/50 rounded-md p-3 space-y-2"
                data-testid="producer-plan-section"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm font-medium text-white capitalize">
                    {section.section_type}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded border ${getDensityBadgeClass(section.density)}`}
                    >
                      {section.density}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {section.bars}b · ⚡{Math.round(section.target_energy * 100)}%
                    </span>
                  </div>
                </div>

                {section.active_roles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {section.active_roles.map((role) => (
                      <span
                        key={role}
                        className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                )}

                {(section.transition_in !== 'none' || section.transition_out !== 'none') && (
                  <div className="text-xs text-gray-500 space-x-2">
                    {section.transition_in !== 'none' && (
                      <span>↓ {section.transition_in.replace(/_/g, ' ')}</span>
                    )}
                    {section.transition_out !== 'none' && (
                      <span>↑ {section.transition_out.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                )}

                {section.rationale && (
                  <p className="text-xs text-gray-400">{section.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

export default ProducerInsightsPanel
