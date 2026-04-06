'use client'

/**
 * SectionStateBadge
 *
 * Renders a small, colour-coded pill that communicates a section's current
 * processing / playback-readiness state.  All four UX-required states are
 * supported:
 *
 *   processing          – arrangement worker is running (spinner, blue)
 *   rendering_preview   – arrangement is done but the preview audio render job
 *                         is still in progress (spinner, purple)
 *   ready               – preview audio is available (checkmark, green)
 *   preview_unavailable – audio render failed / exhausted retries (warning, amber)
 *
 * Additional states carried over from the backend status enum:
 *   queued   – job is waiting for a worker (clock, yellow)
 *   pending  – job is being prepared (clock, yellow)
 *   failed   – arrangement worker failed hard (x, red)
 *   unknown  – unrecognised status value (gray)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper: deriveSectionState
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes the badge state from a variation-candidate snapshot so callers do
 * not need to repeat the priority logic.
 */

import React from 'react'

export type SectionState =
  | 'processing'
  | 'rendering_preview'
  | 'ready'
  | 'preview_unavailable'
  | 'queued'
  | 'pending'
  | 'failed'
  | 'unknown'

export interface SectionStateBadgeProps {
  state: SectionState
  /** Optional extra CSS classes passed to the wrapper span. */
  className?: string
}

// ─── Icon helpers ────────────────────────────────────────────────────────────

function SpinnerIcon({ color }: { color: string }) {
  return (
    <svg
      className={`animate-spin h-3 w-3 ${color}`}
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
  )
}

function CheckIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ─── Config table ─────────────────────────────────────────────────────────────

interface BadgeConfig {
  label: string
  wrapperClass: string
  icon: React.ReactNode
}

function getConfig(state: SectionState): BadgeConfig {
  switch (state) {
    case 'processing':
      return {
        label: 'Processing',
        wrapperClass: 'text-blue-300 bg-blue-900/30 border border-blue-800',
        icon: <SpinnerIcon color="text-blue-300" />,
      }
    case 'rendering_preview':
      return {
        label: 'Rendering preview',
        wrapperClass: 'text-purple-300 bg-purple-900/30 border border-purple-800',
        icon: <SpinnerIcon color="text-purple-300" />,
      }
    case 'ready':
      return {
        label: 'Ready',
        wrapperClass: 'text-green-300 bg-green-900/30 border border-green-800',
        icon: <CheckIcon />,
      }
    case 'preview_unavailable':
      return {
        label: 'Preview unavailable',
        wrapperClass: 'text-amber-300 bg-amber-900/30 border border-amber-800',
        icon: <WarningIcon />,
      }
    case 'queued':
      return {
        label: 'Queued',
        wrapperClass: 'text-yellow-300 bg-yellow-900/20 border border-yellow-800',
        icon: <ClockIcon />,
      }
    case 'pending':
      return {
        label: 'Preparing',
        wrapperClass: 'text-yellow-300 bg-yellow-900/20 border border-yellow-800',
        icon: <ClockIcon />,
      }
    case 'failed':
      return {
        label: 'Failed',
        wrapperClass: 'text-red-300 bg-red-900/30 border border-red-800',
        icon: <XIcon />,
      }
    default:
      return {
        label: state,
        wrapperClass: 'text-gray-300 bg-gray-900/30 border border-gray-700',
        icon: null,
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SectionStateBadge({ state, className = '' }: SectionStateBadgeProps) {
  const { label, wrapperClass, icon } = getConfig(state)

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${wrapperClass} ${className}`}
      data-testid="section-state-badge"
      data-state={state}
    >
      {icon}
      {label}
    </span>
  )
}

// ─── State derivation helper ──────────────────────────────────────────────────

/**
 * Derive the correct SectionState from a variation-candidate snapshot.
 *
 * Priority order (highest first):
 *  1. terminal backend status → failed
 *  2. done/completed + audioUrl present → ready
 *  3. done/completed + audioUnavailable → preview_unavailable
 *  4. done/completed + preview_status queued/processing → rendering_preview
 *  5. done/completed + no audio yet (fresh poll) → rendering_preview
 *  6. processing/queued/pending backend status → processing / queued / pending
 *  7. fallback → unknown
 */
export function deriveSectionState(candidate: {
  status: string
  audioUrl?: string | null
  audioUnavailable?: boolean
  arrangementStatus?: { preview_status?: string | null } | null
}): SectionState {
  const { status, audioUrl, audioUnavailable, arrangementStatus } = candidate

  if (status === 'failed') return 'failed'

  const isDone = status === 'done' || status === 'completed'

  if (isDone) {
    if (audioUrl) return 'ready'
    if (audioUnavailable) return 'preview_unavailable'
    const previewStatus = arrangementStatus?.preview_status
    if (previewStatus === 'queued' || previewStatus === 'processing') {
      return 'rendering_preview'
    }
    // done but audio not yet fetched (worker just finished, download pending)
    return 'rendering_preview'
  }

  if (status === 'processing') return 'processing'
  if (status === 'queued') return 'queued'
  if (status === 'pending') return 'pending'

  return 'unknown'
}

export default SectionStateBadge
