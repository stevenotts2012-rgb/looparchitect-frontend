/**
 * Regression tests for SectionStateBadge and deriveSectionState.
 *
 * Covers:
 *  - All four primary UX states: Processing, Rendering preview, Ready,
 *    Preview unavailable
 *  - Additional backend-status states: queued, pending, failed, unknown
 *  - deriveSectionState priority order
 *  - Backward compatibility: legacy candidate objects that lack new fields
 *    (audioUnavailable, arrangementStatus.preview_status) still render
 *    a valid badge without throwing
 *  - Null-safety: null / undefined fields do not crash
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { SectionStateBadge, deriveSectionState } from '@/components/SectionStateBadge'
import type { SectionState } from '@/components/SectionStateBadge'

// ─── SectionStateBadge rendering ─────────────────────────────────────────────

describe('SectionStateBadge – rendering', () => {
  const cases: Array<{ state: SectionState; expectedLabel: string }> = [
    { state: 'processing', expectedLabel: 'Processing' },
    { state: 'rendering_preview', expectedLabel: 'Rendering preview' },
    { state: 'ready', expectedLabel: 'Ready' },
    { state: 'preview_unavailable', expectedLabel: 'Preview unavailable' },
    { state: 'queued', expectedLabel: 'Queued' },
    { state: 'pending', expectedLabel: 'Preparing' },
    { state: 'failed', expectedLabel: 'Failed' },
  ]

  test.each(cases)('state=$state renders label "$expectedLabel"', ({ state, expectedLabel }) => {
    render(<SectionStateBadge state={state} />)
    expect(screen.getByTestId('section-state-badge')).toHaveTextContent(expectedLabel)
  })

  it('badge carries data-state attribute for the provided state', () => {
    render(<SectionStateBadge state="ready" />)
    expect(screen.getByTestId('section-state-badge')).toHaveAttribute('data-state', 'ready')
  })

  it('accepts optional className without crashing', () => {
    render(<SectionStateBadge state="processing" className="extra-class" />)
    const badge = screen.getByTestId('section-state-badge')
    expect(badge).toHaveClass('extra-class')
  })

  it('renders without icons crashing for all states (smoke)', () => {
    const states: SectionState[] = [
      'processing', 'rendering_preview', 'ready', 'preview_unavailable',
      'queued', 'pending', 'failed', 'unknown',
    ]
    states.forEach((state) => {
      const { unmount } = render(<SectionStateBadge state={state} />)
      expect(screen.getByTestId('section-state-badge')).toBeInTheDocument()
      unmount()
    })
  })
})

// ─── deriveSectionState ───────────────────────────────────────────────────────

describe('deriveSectionState – state derivation', () => {
  describe('failed status', () => {
    it('returns "failed" for status=failed', () => {
      expect(deriveSectionState({ status: 'failed' })).toBe('failed')
    })

    it('returns "failed" even when audioUrl is set (backend failure overrides)', () => {
      expect(deriveSectionState({ status: 'failed', audioUrl: 'blob:x' })).toBe('failed')
    })
  })

  describe('ready state', () => {
    it('returns "ready" when status=done and audioUrl is present', () => {
      expect(deriveSectionState({ status: 'done', audioUrl: 'blob:http://localhost/1' })).toBe('ready')
    })

    it('returns "ready" when status=completed and audioUrl is present', () => {
      expect(deriveSectionState({ status: 'completed', audioUrl: 'blob:http://localhost/2' })).toBe('ready')
    })

    it('"ready" takes priority over audioUnavailable when both are somehow set', () => {
      // Defensive edge case – in practice they should not coexist.
      expect(deriveSectionState({
        status: 'done',
        audioUrl: 'blob:http://localhost/x',
        audioUnavailable: true,
      })).toBe('ready')
    })
  })

  describe('preview_unavailable state', () => {
    it('returns "preview_unavailable" when done, no audioUrl, audioUnavailable=true', () => {
      expect(deriveSectionState({
        status: 'done',
        audioUrl: null,
        audioUnavailable: true,
      })).toBe('preview_unavailable')
    })

    it('returns "preview_unavailable" when completed, no audioUrl, audioUnavailable=true', () => {
      expect(deriveSectionState({
        status: 'completed',
        audioUrl: null,
        audioUnavailable: true,
      })).toBe('preview_unavailable')
    })
  })

  describe('rendering_preview state', () => {
    it('returns "rendering_preview" when done, no audioUrl, preview_status=queued', () => {
      expect(deriveSectionState({
        status: 'done',
        audioUrl: null,
        arrangementStatus: { preview_status: 'queued' },
      })).toBe('rendering_preview')
    })

    it('returns "rendering_preview" when done, no audioUrl, preview_status=processing', () => {
      expect(deriveSectionState({
        status: 'done',
        audioUrl: null,
        arrangementStatus: { preview_status: 'processing' },
      })).toBe('rendering_preview')
    })

    it('returns "rendering_preview" when done, no audioUrl, and no preview_status (download pending)', () => {
      expect(deriveSectionState({
        status: 'done',
        audioUrl: null,
      })).toBe('rendering_preview')
    })

    it('returns "rendering_preview" when done, no audioUrl, arrangementStatus is null', () => {
      expect(deriveSectionState({
        status: 'done',
        audioUrl: null,
        arrangementStatus: null,
      })).toBe('rendering_preview')
    })
  })

  describe('in-progress statuses', () => {
    it('returns "processing" for status=processing', () => {
      expect(deriveSectionState({ status: 'processing' })).toBe('processing')
    })

    it('returns "queued" for status=queued', () => {
      expect(deriveSectionState({ status: 'queued' })).toBe('queued')
    })

    it('returns "pending" for status=pending', () => {
      expect(deriveSectionState({ status: 'pending' })).toBe('pending')
    })
  })

  describe('unknown / unrecognised status', () => {
    it('returns "unknown" for an unrecognised status string', () => {
      expect(deriveSectionState({ status: 'whatever' })).toBe('unknown')
    })
  })

  // ─── Backward compatibility (legacy field absence) ──────────────────────────

  describe('backward compatibility – legacy candidate objects', () => {
    it('handles minimal legacy object (status only) without crashing', () => {
      // Pre-new-fields candidate: just { arrangement_id, status, created_at }
      const legacy = { status: 'processing' }
      expect(() => deriveSectionState(legacy)).not.toThrow()
    })

    it('handles legacy done candidate missing audioUnavailable and arrangementStatus', () => {
      // Backend returns done but old frontend state has no audioUnavailable field.
      const legacy = { status: 'done', audioUrl: null }
      const state = deriveSectionState(legacy)
      // Should be rendering_preview (not crash, not show incorrect spinner)
      expect(state).toBe('rendering_preview')
    })

    it('handles legacy done candidate with audioUrl but no other fields', () => {
      const legacy = { status: 'done', audioUrl: 'blob:http://localhost/legacy' }
      expect(deriveSectionState(legacy)).toBe('ready')
    })

    it('handles arrangementStatus without preview_status field', () => {
      const candidate = {
        status: 'done',
        audioUrl: null,
        arrangementStatus: { id: 42, status: 'done' }, // old shape – no preview_status
      }
      expect(deriveSectionState(candidate)).toBe('rendering_preview')
    })

    it('handles undefined audioUrl (old state shape, not null)', () => {
      const candidate = { status: 'done', audioUrl: undefined }
      // undefined is falsy so same as null – should be rendering_preview
      expect(deriveSectionState(candidate)).toBe('rendering_preview')
    })
  })
})

// ─── SectionStateBadge state label integration ────────────────────────────────

describe('SectionStateBadge + deriveSectionState integration', () => {
  it('variation with audioUrl renders "Ready" badge', () => {
    const state = deriveSectionState({ status: 'done', audioUrl: 'blob:http://localhost/1' })
    render(<SectionStateBadge state={state} />)
    expect(screen.getByTestId('section-state-badge')).toHaveTextContent('Ready')
  })

  it('variation with audioUnavailable renders "Preview unavailable" badge', () => {
    const state = deriveSectionState({ status: 'done', audioUrl: null, audioUnavailable: true })
    render(<SectionStateBadge state={state} />)
    expect(screen.getByTestId('section-state-badge')).toHaveTextContent('Preview unavailable')
  })

  it('variation with preview rendering shows "Rendering preview" badge not endless "Ready"', () => {
    const state = deriveSectionState({
      status: 'done',
      audioUrl: null,
      arrangementStatus: { preview_status: 'processing' },
    })
    render(<SectionStateBadge state={state} />)
    const badge = screen.getByTestId('section-state-badge')
    expect(badge).toHaveTextContent('Rendering preview')
    // Must NOT say "Ready" when audio is not yet loaded.
    expect(badge).not.toHaveTextContent('Ready')
  })

  it('failed variation renders "Failed" badge, not "Preview unavailable"', () => {
    const state = deriveSectionState({ status: 'failed', audioUrl: null })
    render(<SectionStateBadge state={state} />)
    expect(screen.getByTestId('section-state-badge')).toHaveTextContent('Failed')
  })
})
