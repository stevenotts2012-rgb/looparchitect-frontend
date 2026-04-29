/**
 * Tests for the Generate page auto-select logic.
 *
 * Covers the job-completion branch in the render-async polling useEffect:
 *  - When job.status reaches finished/completed/done with an arrangement_id,
 *    the page must immediately fetch the arrangement status and populate the
 *    player/results area (setArrangementStatus) without waiting for the next
 *    candidates-polling tick.
 *  - Required console log identifiers must be emitted.
 *  - Graceful degradation when the immediate status fetch fails.
 *  - Fallback path (no arrangement_id in job response) selects the newest
 *    arrangement from listArrangements and fetches its status immediately.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock Next.js Link
// ---------------------------------------------------------------------------
jest.mock('next/link', () => {
  // eslint-disable-next-line react/display-name
  const MockLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  )
  return MockLink
})

// ---------------------------------------------------------------------------
// Mock wavesurfer.js (used by WaveformViewer / BeforeAfterComparison)
// ---------------------------------------------------------------------------
jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      load: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      play: jest.fn(),
      pause: jest.fn(),
      setVolume: jest.fn(),
    })),
  },
}))

// ---------------------------------------------------------------------------
// Mock heavy/complex components that do not affect the tested behaviour
// ---------------------------------------------------------------------------
jest.mock('@/components/WaveformViewer', () => ({
  __esModule: true,
  default: ({ audioUrl, title }: { audioUrl: string; title?: string }) => (
    <div data-testid="waveform-viewer" data-url={audioUrl}>{title ?? 'WaveformViewer'}</div>
  ),
}))

jest.mock('@/components/BeforeAfterComparison', () => ({
  __esModule: true,
  default: ({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) => (
    <div data-testid="before-after" data-before={beforeUrl} data-after={afterUrl} />
  ),
}))

jest.mock('@/components/ArrangementStatus', () => ({
  __esModule: true,
  default: ({ arrangement }: { arrangement: { status: string; id?: number } }) => (
    <div data-testid="arrangement-status" data-status={arrangement.status}>
      {arrangement.status === 'done' || arrangement.status === 'completed'
        ? 'Arrangement ready'
        : arrangement.status}
    </div>
  ),
}))

jest.mock('@/components/DownloadButton', () => ({
  __esModule: true,
  default: ({ arrangementId }: { arrangementId: number }) => (
    <button data-testid="download-btn">Download {arrangementId}</button>
  ),
}))

jest.mock('@/components/DawExportButton', () => ({
  __esModule: true,
  default: () => <button data-testid="daw-export-btn">DAW Export</button>,
}))

jest.mock('@/components/GenerationHistory', () => ({
  __esModule: true,
  default: ({ rows, onTrack }: { rows: unknown[]; onTrack: (id: number) => void }) => (
    <div data-testid="generation-history">
      {(rows as Array<{ id: number; status: string }>).map((r) => (
        <button key={r.id} onClick={() => onTrack(r.id)} data-testid={`track-btn-${r.id}`}>
          Track {r.id}
        </button>
      ))}
    </div>
  ),
}))

jest.mock('@/components/ArrangementTimeline', () => ({
  ArrangementTimeline: () => <div data-testid="arrangement-timeline" />,
}))

jest.mock('@/components/StyleSliders', () => ({
  StyleSliders: () => <div data-testid="style-sliders" />,
}))

jest.mock('@/components/StyleTextInput', () => ({
  StyleTextInput: () => <div data-testid="style-text-input" />,
}))

jest.mock('@/components/ProducerMoves', () => ({
  ProducerMoves: () => <div data-testid="producer-moves" />,
}))

jest.mock('@/components/HelpButton', () => ({
  HelpButton: () => <button data-testid="help-btn">Help</button>,
}))

jest.mock('@/components/ProducerInsightsPanel', () => ({
  ProducerInsightsPanel: () => <div data-testid="producer-insights" />,
}))

jest.mock('@/components/ReferenceTrackPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="reference-track-panel" />,
}))

jest.mock('@/components/ReferenceGuidancePanel', () => ({
  ReferenceGuidancePanel: () => <div data-testid="reference-guidance-panel" />,
}))

jest.mock('@/components/SectionStateBadge', () => ({
  SectionStateBadge: ({ state }: { state: string }) => (
    <span data-testid="section-state-badge">{state}</span>
  ),
  deriveSectionState: (candidate: { status: string }) => candidate.status,
}))

// ---------------------------------------------------------------------------
// Mock API client
// ---------------------------------------------------------------------------
import {
  renderLoopAsync,
  getJobStatus,
  getArrangementStatus,
  getArrangementMetadata,
  listArrangements,
  listStylePresets,
  validateLoopSource,
  getLoop,
  downloadLoop,
  resolveArrangementAudioUrl,
  type ArrangementStatusResponse,
  type Arrangement,
} from '@/../../api/client'

jest.mock('@/../../api/client', () => ({
  renderLoopAsync: jest.fn(),
  getJobStatus: jest.fn(),
  getArrangementStatus: jest.fn(),
  getArrangementMetadata: jest.fn(),
  listArrangements: jest.fn(),
  listStylePresets: jest.fn(),
  validateLoopSource: jest.fn(),
  getLoop: jest.fn(),
  downloadLoop: jest.fn(),
  downloadArrangement: jest.fn(),
  resolveArrangementAudioUrl: jest.fn(),
  retryPreviewRender: jest.fn(),
  getArrangementPlan: jest.fn(),
  validateStyle: jest.fn(),
  getDawExportInfo: jest.fn(),
  saveArrangement: jest.fn(),
  LoopArchitectApiError: class LoopArchitectApiError extends Error {
    status: number
    details?: unknown
    constructor(message: string, status: number, details?: unknown) {
      super(message)
      this.name = 'LoopArchitectApiError'
      this.status = status
      this.details = details
    }
  },
}))

// ---------------------------------------------------------------------------
// Mock lib/styleSchema
// ---------------------------------------------------------------------------
jest.mock('@/lib/styleSchema', () => ({
  SimpleStyleProfile: {},
}))

// ---------------------------------------------------------------------------
// Import the component under test (after all mocks are registered)
// ---------------------------------------------------------------------------
import GeneratePage from '@/app/generate/page'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArrangementStatus(overrides: Partial<ArrangementStatusResponse> = {}): ArrangementStatusResponse {
  return {
    id: 42,
    status: 'done',
    output_url: 'https://cdn.example.com/arr42.wav',
    ...overrides,
  }
}

function makeArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    id: 42,
    loop_id: 1,
    status: 'done',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:01:00Z',
    target_seconds: 60,
    ...overrides,
  }
}

function mockDefaultApis() {
  ;(listStylePresets as jest.Mock).mockResolvedValue([])
  ;(listArrangements as jest.Mock).mockResolvedValue([])
  ;(validateLoopSource as jest.Mock).mockResolvedValue({ valid: true })
  ;(getLoop as jest.Mock).mockResolvedValue({ id: 1, bpm: 120, bars: 8 })
  ;(downloadLoop as jest.Mock).mockResolvedValue('blob:loop-url')
  ;(getArrangementMetadata as jest.Mock).mockResolvedValue({})
  ;(resolveArrangementAudioUrl as jest.Mock).mockImplementation(
    (status: ArrangementStatusResponse) => status?.output_url ?? status?.preview_url ?? null
  )
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  mockDefaultApis()
  // Silence console noise in tests
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
  // Provide URL helpers (jsdom doesn't always have them)
  if (!global.URL.createObjectURL) {
    Object.defineProperty(global.URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:mock-url'),
    })
  }
  if (!global.URL.revokeObjectURL) {
    Object.defineProperty(global.URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    })
  }
  jest.useFakeTimers()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ===========================================================================
// Render helper
// ===========================================================================

async function renderPage(loopIdParam = '') {
  // Simulate the ?loopId= query param via window.location
  if (loopIdParam) {
    delete (window as { location?: Location }).location
    ;(window as unknown as { location: { search: string } }).location = {
      search: `?loopId=${loopIdParam}`,
    }
  }

  let utils: ReturnType<typeof render>
  await act(async () => {
    utils = render(<GeneratePage />)
  })
  return utils!
}

// ===========================================================================
// Tests: job completion WITH arrangement_id
// ===========================================================================

describe('Job completion with arrangement_id', () => {
  it('calls getArrangementStatus immediately after job completes', async () => {
    const mockStatus = makeArrangementStatus()
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: 42,
      audio_url: null,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(mockStatus)
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    // Fill Loop ID and click Generate
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })

    // Let the async renderLoopAsync resolve
    await act(async () => {
      await Promise.resolve()
    })

    // Initial pollJob fires immediately after job interval is set
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(42)
    })
  })

  it('emits JOB_COMPLETED_WITH_ARRANGEMENT_ID console log', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus())
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('JOB_COMPLETED_WITH_ARRANGEMENT_ID', 42)
    })
  })

  it('emits AUTO_SELECT_ARRANGEMENT console log', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus())
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('AUTO_SELECT_ARRANGEMENT', 42)
    })
  })

  it('emits AUTO_LOAD_TRACK_URL console log when audio URL is resolved', async () => {
    const mockStatus = makeArrangementStatus({ output_url: 'https://cdn.example.com/audio.wav' })
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(mockStatus)
    ;(resolveArrangementAudioUrl as jest.Mock).mockReturnValue('https://cdn.example.com/audio.wav')
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'AUTO_LOAD_TRACK_URL',
        'https://cdn.example.com/audio.wav'
      )
    })
  })

  it('shows the ArrangementStatus component after job completes', async () => {
    const mockStatus = makeArrangementStatus({ status: 'done', id: 42 })
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(mockStatus)
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('arrangement-status')).toBeInTheDocument()
    })
    expect(screen.getByTestId('arrangement-status')).toHaveAttribute('data-status', 'done')
  })

  it('does not throw when getArrangementStatus fails after job completion', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockRejectedValue(new Error('Network failure'))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })

    // Should not throw even when status fetch fails
    await expect(
      act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
    ).resolves.not.toThrow()

    // Warning should be emitted
    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch arrangement status on job completion:'),
        expect.any(Error)
      )
    })
  })

  it('shows Preview Variations section after job completes (isGenerating resets)', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus())
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // After job completion, the arrangement form is hidden (arrangementId is set)
    // and the Preview Variations section appears. The "Generate 3 New Variations"
    // button inside it should NOT be disabled (isGenerating = false).
    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })
    const regenBtn = screen.getByRole('button', { name: /Generate 3 New Variations/i })
    expect(regenBtn).not.toBeDisabled()
  })

  it('handles "completed" job status (not just "finished")', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-2' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'completed', arrangement_id: 55 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 55 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 55 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(55)
    })
  })

  it('handles "done" job status', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-3' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'done', arrangement_id: 77 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 77 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 77 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(77)
    })
  })

  it('handles "success" job status – stops polling and shows results', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-success' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'success', arrangement_id: 88 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 88 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 88 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(88)
    })
  })

  it('emits JOB_SUCCESS_STATUS_RECEIVED when status is "success"', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-success' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'success', arrangement_id: 88 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 88 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 88 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'JOB_SUCCESS_STATUS_RECEIVED',
        expect.objectContaining({ status: 'success' })
      )
    })
  })

  it('handles job_terminal_state "success" even when status is non-terminal', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-terminal' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      job_terminal_state: 'success',
      arrangement_id: 91,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 91 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 91 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(91)
    })
  })

  it('emits JOB_SUCCESS_STATUS_RECEIVED when job_terminal_state is "success"', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-terminal' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      job_terminal_state: 'success',
      arrangement_id: 91,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 91 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 91 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'JOB_SUCCESS_STATUS_RECEIVED',
        expect.objectContaining({ job_terminal_state: 'success' })
      )
    })
  })

  it('"success" status resets isGenerating so Generate button re-enables', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-success' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'success', arrangement_id: 88 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 88 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 88 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })
    const regenBtn = screen.getByRole('button', { name: /Generate 3 New Variations/i })
    expect(regenBtn).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: job completion WITHOUT arrangement_id (fallback path)
// ===========================================================================

describe('Job completion without arrangement_id (fallback path)', () => {
  it('selects the newest arrangement from listArrangements', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: undefined,
      candidates: [],
    })
    ;(listArrangements as jest.Mock).mockResolvedValue([
      makeArrangement({ id: 10, created_at: '2024-01-10T00:00:00Z' }),
      makeArrangement({ id: 20, created_at: '2024-01-20T00:00:00Z' }),
    ])
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 20 }))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Should fetch status for id=20 (highest id = newest)
    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(20)
    })
  })

  it('emits AUTO_SELECT_ARRANGEMENT for the newest arrangement', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: undefined,
      candidates: [],
    })
    ;(listArrangements as jest.Mock).mockResolvedValue([
      makeArrangement({ id: 99 }),
    ])
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 99 }))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('AUTO_SELECT_ARRANGEMENT', 99)
    })
  })

  it('does not throw when arrangement status fetch fails in fallback path', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: undefined,
      candidates: [],
    })
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 33 })])
    ;(getArrangementStatus as jest.Mock).mockRejectedValue(new Error('Server Error'))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })

    await expect(
      act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
    ).resolves.not.toThrow()

    await waitFor(() => {
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch arrangement status on fallback selection:'),
        expect.any(Error)
      )
    })
  })
})

// ===========================================================================
// Tests: job failure path
// ===========================================================================

describe('Job failure path', () => {
  it('shows error message when job fails', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-fail' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'failed',
      error_message: 'Render failed: out of memory',
    })

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Render failed: out of memory/i)).toBeInTheDocument()
    })
  })

  it('does NOT call getArrangementStatus when job fails', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-fail' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'failed',
      error_message: 'Render failed',
    })

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Render failed/i)).toBeInTheDocument()
    })
    expect(getArrangementStatus).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Tests: Generate form validation
// ===========================================================================

describe('Generate form validation', () => {
  it('disables Generate button when loopId is empty', async () => {
    await renderPage()

    // When loopId is empty, the Generate button must be disabled so the user
    // cannot submit the form and trigger a validation error path.
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).toBeDisabled()
  })

  it('does not call renderLoopAsync when loopId is empty', async () => {
    await renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })

    expect(renderLoopAsync).not.toHaveBeenCalled()
  })

  it('calls renderLoopAsync with the correct loop ID', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-x' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'queued' })

    await renderPage()

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '7' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(renderLoopAsync).toHaveBeenCalledWith(7, expect.any(Object))
  })
})

// ===========================================================================
// Tests: AI plan state is cleared on job completion
// ===========================================================================

describe('AI plan state cleared on job completion', () => {
  it('clears AI plan sections after job completes', async () => {
    // Simulate a plan existing then job completing
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus())
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement()])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // After job completion, the AI Plan Preview section should not be visible
    // (aiPlanDraft is set to null in the job completion branch)
    await waitFor(() => {
      expect(screen.queryByText(/AI Plan Preview/i)).not.toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Tests: loopId pre-populated from URL query param
// ===========================================================================

describe('loopId pre-populated from URL query param', () => {
  it('reads loopId from ?loopId= query parameter', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'queued' })

    // jsdom's window.location cannot be spread because it has non-enumerable
    // properties that reject invalid instances.  Mock URLSearchParams directly
    // so the useEffect's `urlParams.get('loopId')` returns '5'.
    const OriginalURLSearchParams = global.URLSearchParams
    global.URLSearchParams = class MockURLSearchParams {
      private params: Map<string, string>
      constructor(_init?: string) {
        this.params = new Map([['loopId', '5']])
      }
      get(key: string) { return this.params.get(key) ?? null }
    } as unknown as typeof URLSearchParams

    await renderPage()

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i }) as HTMLInputElement
    expect(loopInput.value).toBe('5')

    global.URLSearchParams = OriginalURLSearchParams
  })
})
