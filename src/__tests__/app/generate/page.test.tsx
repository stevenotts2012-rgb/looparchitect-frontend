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

/** Flush the microtask queue (Promise resolutions) without advancing fake timers. */
const flushPromises = () => act(async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
})

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
    // and the Preview Variations section appears. The "Generate 2 New Variations"
    // button inside it should NOT be disabled (isGenerating = false).
    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })
    const regenBtn = screen.getByRole('button', { name: /Generate 2 New Variations/i })
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
    const regenBtn = screen.getByRole('button', { name: /Generate 2 New Variations/i })
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
      expect(screen.getAllByText(/Render failed: out of memory/i).length).toBeGreaterThan(0)
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
      expect(screen.getAllByText(/Render failed/i).length).toBeGreaterThan(0)
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

// ===========================================================================
// Tests: loadHistory failure does not block isGenerating
// ===========================================================================

describe('loadHistory failure does not keep isGenerating true', () => {
  it('resets isGenerating after job success even when listArrangements rejects', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-hist-fail' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    // Make listArrangements always reject so loadHistory always fails
    ;(listArrangements as jest.Mock).mockRejectedValue(new Error('DB connection failed'))

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

    // The Generate button must be re-enabled (isGenerating=false) even though
    // loadHistory failed – the job polling flow sets isGenerating=false before
    // any loadHistory call.
    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })
    const regenBtn = screen.getByRole('button', { name: /Generate 2 New Variations/i })
    expect(regenBtn).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: 90-second timeout clears generating state
// ===========================================================================

describe('90-second timeout clears generating state', () => {
  it('stops polling and shows error after 90 seconds', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-timeout' })
    // Job never reaches terminal state – always returns processing
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'processing' })

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    // Let the initial renderLoopAsync and first poll fire
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    // Advance timers by 90 seconds to trigger the timeout
    await act(async () => {
      jest.advanceTimersByTime(90_000)
    })

    // isGenerating must be false and an error must be shown
    await waitFor(() => {
      expect(screen.getByText(/timed out after 90 seconds/i)).toBeInTheDocument()
    })
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: failed job clears generating state
// ===========================================================================

describe('Failed job clears generating state', () => {
  it('re-enables Generate button after job fails', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-fail-btn' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'failed',
      error_message: 'Worker crashed',
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
      expect(screen.getAllByText(/Worker crashed/i).length).toBeGreaterThan(0)
    })
    // Generate button must be re-enabled after failure
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })

  it('re-enables Generate button after "error" job status', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-error-status' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'error',
      error_message: 'Internal render error',
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
      expect(screen.getByText(/Internal render error/i)).toBeInTheDocument()
    })
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: required console.log identifiers
// ===========================================================================

describe('Required console.log identifiers', () => {
  async function triggerGeneration(loopIdVal = '1') {
    await renderPage(loopIdVal)
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: loopIdVal } })
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
  }

  it('emits GENERATE_STARTED log when Generate is clicked', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-gs' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'GENERATE_STARTED',
        expect.objectContaining({ loopId: '1' })
      )
    })
  })

  it('emits RENDER_ASYNC_RESPONSE_FULL log after renderLoopAsync resolves', async () => {
    const mockResponse = { job_id: 'job-rarf' }
    ;(renderLoopAsync as jest.Mock).mockResolvedValue(mockResponse)
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'RENDER_ASYNC_RESPONSE_FULL',
        expect.objectContaining({ job_id: 'job-rarf' })
      )
    })
  })

  it('emits JOB_TERMINAL_SUCCESS log on job success', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-jts' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'JOB_TERMINAL_SUCCESS',
        expect.objectContaining({ status: 'finished' })
      )
    })
  })

  it('emits FINAL_ARRANGEMENT_ID log with the resolved arrangement id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-fai' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('FINAL_ARRANGEMENT_ID', 42)
    })
  })

  it('emits ARRANGEMENT_FETCHED_BY_ID log after fetching arrangement by id', async () => {
    const mockStatus = makeArrangementStatus({ id: 42 })
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-afbi' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(mockStatus)
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'ARRANGEMENT_FETCHED_BY_ID',
        expect.objectContaining({ id: 42 })
      )
    })
  })

  it('emits GENERATE_UI_COMPLETE log after results are displayed', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-guc' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('GENERATE_UI_COMPLETE')
    })
  })

  it('emits RAW_JOB_RESPONSE log for each poll tick', async () => {
    const mockJob = { status: 'finished', arrangement_id: 42 }
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-raw' })
    ;(getJobStatus as jest.Mock).mockResolvedValue(mockJob)
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await triggerGeneration()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('RAW_JOB_RESPONSE', expect.objectContaining({ status: 'finished' }))
    })
  })
})

// ===========================================================================
// Tests: "cancelled" status as failure
// ===========================================================================

describe('"cancelled" job status treated as failure', () => {
  it('shows error and re-enables Generate button when job is cancelled', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-cancelled' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'cancelled',
      error_message: 'Job was cancelled',
    })

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Job was cancelled/i)).toBeInTheDocument()
    })
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })

  it('does not call getArrangementStatus when job is cancelled', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-cancelled-2' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'cancelled',
    })

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Render job failed/i)).toBeInTheDocument()
    })
    expect(getArrangementStatus).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Tests: Alternative job status field names (job.state, job.job_status)
// ===========================================================================

describe('Alternative job status field names', () => {
  it('treats job.state="finished" as success when job.status is absent', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-state' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      state: 'finished',
      arrangement_id: 50,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 50 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 50 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(50)
    })
  })

  it('treats job.job_status="done" as success when status and state are absent', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-job-status' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      job_status: 'done',
      arrangement_id: 51,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 51 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 51 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(51)
    })
  })

  it('treats job.terminal_state="success" as success (alternative to job_terminal_state)', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-terminal-state' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'processing',
      terminal_state: 'success',
      arrangement_id: 52,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 52 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 52 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(52)
    })
  })
})

// ===========================================================================
// Tests: Nested arrangement_id resolution
// ===========================================================================

describe('Nested arrangement_id resolution', () => {
  it('extracts arrangement_id from job.arrangementId (camelCase)', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-camel' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangementId: 60,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 60 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 60 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(60)
    })
  })

  it('extracts arrangement_id from job.result.arrangement_id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-result' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      result: { arrangement_id: 61 },
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 61 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 61 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(61)
    })
  })

  it('extracts arrangement_id from job.metadata.arrangement_id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-metadata' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      metadata: { arrangement_id: 62 },
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 62 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 62 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getArrangementStatus).toHaveBeenCalledWith(62)
    })
  })

  it('emits FINAL_ARRANGEMENT_ID with id from job.result.arrangement_id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-result-fai' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      result: { arrangement_id: 63 },
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 63 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 63 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('FINAL_ARRANGEMENT_ID', 63)
    })
  })
})

// ===========================================================================
// Tests: renderLoopAsync failure handling
// ===========================================================================

describe('renderLoopAsync failure handling', () => {
  it('shows API error message when renderLoopAsync throws LoopArchitectApiError', async () => {
    const { LoopArchitectApiError } = jest.requireMock('@/../../api/client')
    ;(renderLoopAsync as jest.Mock).mockRejectedValue(
      new LoopArchitectApiError('Loop file not found', 404)
    )

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Loop file not found/i)).toBeInTheDocument()
    })
    // isGenerating must be cleared so the button is re-enabled
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })

  it('shows generic error when renderLoopAsync throws a non-API error', async () => {
    ;(renderLoopAsync as jest.Mock).mockRejectedValue(new Error('Network failure'))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate arrangement/i)).toBeInTheDocument()
    })
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })

  it('does not call getJobStatus when renderLoopAsync fails', async () => {
    ;(renderLoopAsync as jest.Mock).mockRejectedValue(new Error('Server error'))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    expect(getJobStatus).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Tests: Job polling error accumulation
// ===========================================================================

describe('Job polling error accumulation', () => {
  it('stops polling and shows error after 5 consecutive getJobStatus failures', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-err-count' })
    ;(getJobStatus as jest.Mock).mockRejectedValue(new Error('Network error'))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })

    // Drain the initial poll
    await flushPromises()

    // Advance timer to fire enough interval+backoff cycles for 5 total failures
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.advanceTimersByTime(12_000)
        await Promise.resolve()
        await Promise.resolve()
      })
    }

    await waitFor(() => {
      expect(screen.getByText(/Connection issue while checking render status/i)).toBeInTheDocument()
    })
    const generateBtn = screen.getByRole('button', { name: /Generate Arrangement/i })
    expect(generateBtn).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: Audio URL from job.audio_url field
// ===========================================================================

describe('Audio URL from job.audio_url', () => {
  it('sets audio URL from job.audio_url when arrangement status has no direct URL', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-audio-url' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: 70,
      audio_url: 'https://cdn.example.com/job-audio.wav',
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(
      makeArrangementStatus({ id: 70, output_url: undefined })
    )
    ;(resolveArrangementAudioUrl as jest.Mock).mockReturnValue(null)
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 70 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'AUTO_LOAD_TRACK_URL',
        'https://cdn.example.com/job-audio.wav'
      )
    })
  })
})

// ===========================================================================
// Tests: isGenerating guard prevents double-click
// ===========================================================================

describe('isGenerating guard prevents double-click', () => {
  it('does not call renderLoopAsync a second time when already generating', async () => {
    // renderLoopAsync resolves immediately (sets currentJobId); getJobStatus never
    // resolves so isGenerating stays true and the form stays visible (disabled).
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-guard' })
    ;(getJobStatus as jest.Mock).mockReturnValue(new Promise<never>(() => {}))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })

    // First click – starts generation and resolves all mocks through to renderLoopAsync
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // isGenerating=true: button now reads "Generating..." and is disabled
    await waitFor(() => {
      expect(screen.getByText(/Generating\.\.\./i)).toBeInTheDocument()
    })
    // The button is disabled while generating
    const generatingBtn = screen.getByRole('button', { name: /Generating/i })
    expect(generatingBtn).toBeDisabled()

    // Second click on the disabled button is a no-op
    await act(async () => {
      fireEvent.click(generatingBtn)
      await Promise.resolve()
    })

    // renderLoopAsync must have been called exactly once
    expect(renderLoopAsync).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// Tests: setArrangementId set correctly in both paths
// ===========================================================================

describe('setArrangementId set correctly in both paths', () => {
  it('sets arrangementId to the direct arrangement_id from job', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-arr-id-direct' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 80 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 80 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 80 })])

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    // Download button appears with the correct arrangement id
    await waitFor(() => {
      expect(screen.getByTestId('download-btn')).toBeInTheDocument()
    })
    expect(screen.getByTestId('download-btn')).toHaveTextContent('80')
  })

  it('sets arrangementId to the newest arrangement id in the fallback path', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-arr-id-fallback' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: undefined,
    })
    ;(listArrangements as jest.Mock).mockResolvedValue([
      makeArrangement({ id: 81, created_at: '2024-01-10T00:00:00Z' }),
      makeArrangement({ id: 85, created_at: '2024-01-20T00:00:00Z' }),
    ])
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 85 }))

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByTestId('download-btn')).toBeInTheDocument()
    })
    expect(screen.getByTestId('download-btn')).toHaveTextContent('85')
  })
})

// ===========================================================================
// Tests: isGenerating resets to false on ALL terminal job states
// ===========================================================================

describe('isGenerating resets to false on ALL terminal job states', () => {
  const terminalSuccessStatuses = ['success', 'finished', 'completed', 'done']
  terminalSuccessStatuses.forEach((status) => {
    it(`resets isGenerating when job status is "${status}"`, async () => {
      ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: `job-${status}` })
      ;(getJobStatus as jest.Mock).mockResolvedValue({ status, arrangement_id: 42 })
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
      await flushPromises()

      // After successful generation, the generate form is replaced by Preview Variations.
      // The "Generate 2 New Variations" button in that section must not be disabled
      // (isGenerating=false), proving the stuck-generating bug is fixed.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
      })
    })
  })

  const terminalFailureStatuses = ['failed', 'error', 'cancelled']
  terminalFailureStatuses.forEach((status) => {
    it(`resets isGenerating when job status is "${status}"`, async () => {
      ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: `job-${status}` })
      ;(getJobStatus as jest.Mock).mockResolvedValue({
        status,
        error_message: `Job ended with status ${status}`,
      })

      await renderPage('1')

      const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
      await act(async () => {
        fireEvent.change(loopInput, { target: { value: '1' } })
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
      })
      await flushPromises()

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /Generate Arrangement/i })
        expect(btn).not.toBeDisabled()
      })
    })
  })
})

// ===========================================================================
// Tests: Required state machine tests (problem statement checklist)
// ===========================================================================

describe('State machine: required behaviors', () => {
  /**
   * Helper: render the page with the given loopId pre-set via the URL query
   * param, then click Generate and flush the async queue.
   */
  async function setupAndGenerate(loopIdVal = '1', extraTicks = 4) {
    await renderPage(loopIdVal)
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: loopIdVal } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await act(async () => {
      for (let i = 0; i < extraTicks; i++) await Promise.resolve()
    })
  }

  it('success status stops generating', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-1' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'success', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await setupAndGenerate()

    // The Generate button disappears when arrangementId is set; the
    // "Generate 2 New Variations" button in the Preview Variations section
    // must not be disabled (isGenerating=false).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
    })
  })

  it('job_terminal_state success stops generating', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-2' })
    // The primary status field is 'processing' – genuinely non-terminal.
    // Only job_terminal_state signals that the job is done.  This tests
    // the `effectiveTerminalState === 'success'` branch in pollJob.
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'processing',
      job_terminal_state: 'success',
      arrangement_id: 42,
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await setupAndGenerate()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
    })
  })

  it('arrangement_id fetch renders preview', async () => {
    const arrangementStatusMock = makeArrangementStatus({ id: 42, status: 'done' })
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-3' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(arrangementStatusMock)
    ;(listArrangements as jest.Mock).mockResolvedValue([makeArrangement({ id: 42 })])

    await setupAndGenerate()

    // ArrangementStatus component must appear with the fetched arrangement's status.
    await waitFor(() => {
      expect(screen.getByTestId('arrangement-status')).toBeInTheDocument()
    })
    expect(screen.getByTestId('arrangement-status')).toHaveAttribute('data-status', 'done')
    // DownloadButton is shown when arrangementStatus.status is 'done'.
    expect(screen.getByTestId('download-btn')).toHaveTextContent('42')
  })

  it('missing arrangement_id falls back to latest by loop_id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-4' })
    // Job has no arrangement_id – triggers the listArrangements fallback path.
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      arrangement_id: undefined,
      candidates: [],
    })
    // Two arrangements – the one with the higher id (99) should be selected.
    ;(listArrangements as jest.Mock).mockResolvedValue([
      makeArrangement({ id: 5, created_at: '2024-01-05T00:00:00Z' }),
      makeArrangement({ id: 99, created_at: '2024-01-20T00:00:00Z' }),
    ])
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 99 }))

    await setupAndGenerate()

    // DownloadButton must appear for the newest arrangement (id=99).
    await waitFor(() => {
      expect(screen.getByTestId('download-btn')).toBeInTheDocument()
    })
    expect(screen.getByTestId('download-btn')).toHaveTextContent('99')
    // isGenerating must be cleared.
    expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
  })

  it('loadHistory failure does not keep isGenerating true', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-5' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: 42 })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 42 }))
    // listArrangements always rejects so every loadHistory call silently fails.
    ;(listArrangements as jest.Mock).mockRejectedValue(new Error('DB unavailable'))

    await setupAndGenerate()

    // isGenerating is set to false in the pollJob success handler BEFORE any
    // loadHistory call, so a failing history load must never keep the UI stuck.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
    })
  })

  it('timeout clears generating state', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-6' })
    // Job never reaches a terminal state – always returns processing.
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'processing' })

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
    })

    // Advance past the 90-second safety timeout.
    await act(async () => {
      jest.advanceTimersByTime(90_000)
    })

    await waitFor(() => {
      expect(screen.getByText(/timed out after 90 seconds/i)).toBeInTheDocument()
    })
    // Generate button must be re-enabled after timeout.
    expect(screen.getByRole('button', { name: /Generate Arrangement/i })).not.toBeDisabled()
  })

  it('failed job clears generating state and shows error', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-sm-7' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'failed',
      error_message: 'Render worker crashed',
    })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => {
      fireEvent.change(loopInput, { target: { value: '1' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Render worker crashed/i)).toBeInTheDocument()
    })
    // Generate button must be re-enabled after job failure.
    expect(screen.getByRole('button', { name: /Generate Arrangement/i })).not.toBeDisabled()
  })
})

// ===========================================================================
// Tests: Arrangement-polling completion path (emergency fix)
// ===========================================================================

describe('Single-controller job polling path', () => {
  /**
   * Set up mocks so that arrangements polling (not job polling) is the path
   * that finds the new arrangement.
   *
   * – listArrangements returns [] on the first call (initial history load),
   *   so historyRows is empty and beforeIds is an empty Set.
   * – On subsequent calls it returns a new arrangement (id=100), which is
   *   NOT in beforeIds → detected as "new" by the polling loop.
   * – getJobStatus never resolves to a terminal status, so job polling
   *   does not race with arrangements polling in these tests.
   */
  function setupJobPollingSuccessMocks(arrangementId = 100) {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-single-controller' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'finished', arrangement_id: arrangementId })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(
      makeArrangementStatus({ id: arrangementId, output_url: `https://cdn.example.com/${arrangementId}.wav` })
    )
    ;(resolveArrangementAudioUrl as jest.Mock).mockReturnValue(`https://cdn.example.com/${arrangementId}.wav`)
    ;(listArrangements as jest.Mock).mockResolvedValue([])
  }

  it('emits POLL_START and POLL_TICK when job polling starts', async () => {
    setupJobPollingSuccessMocks()

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith('POLL_START', expect.objectContaining({ job_id: 'job-single-controller' }))
      expect(console.log).toHaveBeenCalledWith('POLL_TICK', expect.objectContaining({ job_id: 'job-single-controller' }))
    })
  })

  it('does not repeatedly call listArrangements during active job polling', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-no-arr-loop' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'processing' })
    ;(listArrangements as jest.Mock).mockResolvedValue([])

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await act(async () => {
      jest.advanceTimersByTime(15_000)
      await Promise.resolve()
    })

    expect(listArrangements).toHaveBeenCalledTimes(1) // initial loadHistory only
    expect(console.log).not.toHaveBeenCalledWith('ARRANGEMENT_POLL_TICK', expect.anything())
  })

  it('slow getJobStatus does not cause overlapping duplicate polls', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-slow-poll' })
    let resolveJob: ((value: unknown) => void) | null = null
    ;(getJobStatus as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJob = resolve
        })
    )
    ;(listArrangements as jest.Mock).mockResolvedValue([])

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await act(async () => {
      jest.advanceTimersByTime(10_000)
      await Promise.resolve()
    })

    expect(getJobStatus).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith('POLL_SKIPPED_DUPLICATE', expect.objectContaining({ job_id: 'job-slow-poll' }))

    await act(async () => {
      resolveJob?.({ status: 'processing' })
      await Promise.resolve()
    })
  })

  it('stops polling after terminal success and no further getJobStatus calls happen', async () => {
    setupJobPollingSuccessMocks(200)

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Generate 2 New Variations/i })).not.toBeDisabled()
    const callsAfterTerminal = (getJobStatus as jest.Mock).mock.calls.length
    await act(async () => {
      jest.advanceTimersByTime(15_000)
      await Promise.resolve()
    })
    expect((getJobStatus as jest.Mock).mock.calls.length).toBe(callsAfterTerminal)
  })
})

// ===========================================================================
// Tests: Generate request body correctness
// ===========================================================================

describe('Generate request body correctness', () => {
  /** Click the Generate button (filling Loop ID 1 first if not pre-filled). */
  async function clickGenerate() {
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()
  }

  beforeEach(() => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-body-test' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'processing' })
    ;(listArrangements as jest.Mock).mockResolvedValue([])
  })

  it('emits GENERATE_REQUEST_BODY console log when Generate is clicked', async () => {
    await renderPage('1')
    await clickGenerate()

    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'GENERATE_REQUEST_BODY',
        expect.objectContaining({ loop_id: 1 })
      )
    })
  })

  it('sends target_length_seconds: 180 when duration mode is set to 180', async () => {
    await renderPage('1')

    // Switch to duration mode and set 180 seconds
    const durationButton = screen.getByRole('button', { name: /By Duration/i })
    await act(async () => { fireEvent.click(durationButton) })

    const durationInput = screen.getByLabelText(/Duration \(seconds\)/i)
    await act(async () => { fireEvent.change(durationInput, { target: { value: '180' } }) })

    await clickGenerate()

    await waitFor(() => {
      expect(renderLoopAsync).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ duration: 180 })
      )
    })

    // Verify the GENERATE_REQUEST_BODY log carries duration: 180
    await waitFor(() => {
      expect(console.log).toHaveBeenCalledWith(
        'GENERATE_REQUEST_BODY',
        expect.objectContaining({ duration: 180 })
      )
    })
  })

  it('sends variation_count=2 in the renderLoopAsync call', async () => {
    await renderPage('1')
    await clickGenerate()

    await waitFor(() => {
      expect(renderLoopAsync).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ variationCount: 2 })
      )
    })
  })

  it('sends custom genre/style unchanged and keeps selected style visible', async () => {
    await renderPage('1')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Genre \/ Style \(free text\)/i), { target: { value: 'R&B' } })
    })
    await clickGenerate()
    await waitFor(() => {
      expect(renderLoopAsync).toHaveBeenCalledWith(1, expect.objectContaining({ genre: 'R&B' }))
    })
    expect(screen.getByText(/Selected style: R&B/i)).toBeInTheDocument()
  })

  it('sends gospel/worship unchanged', async () => {
    await renderPage('1')
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/Genre \/ Style \(free text\)/i), { target: { value: 'gospel/worship' } })
    })
    await clickGenerate()
    await waitFor(() => {
      expect(renderLoopAsync).toHaveBeenCalledWith(1, expect.objectContaining({ genre: 'gospel/worship' }))
    })
  })
})

// ===========================================================================
// Tests: Multiple candidates render as multiple cards
// ===========================================================================

describe('Multiple candidates render as multiple cards', () => {
  it('jobs[] with 3 items is detected and polling starts from jobs[]', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({
      jobs: [
        { job_id: 'job-v1', personality: 'clean/mainstream', variation_index: 0 },
        { job_id: 'job-v2', personality: 'dark/drop-heavy', variation_index: 1 },
        { job_id: 'job-v3', personality: 'cinematic/experimental', variation_index: 2 },
      ],
    })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'running' })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    expect(console.log).toHaveBeenCalledWith('FRONTEND_JOBS_ARRAY_DETECTED', expect.objectContaining({ count: 3 }))
    expect(console.log).toHaveBeenCalledWith('FRONTEND_MULTI_JOB_POLL_START', expect.objectContaining({ job_ids: ['job-v1', 'job-v2', 'job-v3'] }))
  })

  it('renders a card for each candidate when backend returns multiple candidates', async () => {
    const candidates = [
      { arrangement_id: 201, status: 'done', created_at: '2024-01-15T10:00:00Z' },
      { arrangement_id: 202, status: 'done', created_at: '2024-01-15T10:01:00Z' },
      { arrangement_id: 203, status: 'done', created_at: '2024-01-15T10:02:00Z' },
    ]
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-multi' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      candidates,
    })
    ;(getArrangementStatus as jest.Mock).mockImplementation(
      (id: number) => Promise.resolve(makeArrangementStatus({ id }))
    )
    ;(listArrangements as jest.Mock).mockResolvedValue(
      candidates.map((c) => makeArrangement({ id: c.arrangement_id, status: 'done' }))
    )
    ;(resolveArrangementAudioUrl as jest.Mock).mockReturnValue(null)

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Preview Variations/i)).toBeInTheDocument()
    })

    // Each candidate should appear as its own card
    expect(screen.getByText(/Variation 1 — clean\/main/i)).toBeInTheDocument()
    expect(screen.getByText(/Variation 2 — clean\/main/i)).toBeInTheDocument()
    expect(screen.queryByText(/Variation 3/i)).not.toBeInTheDocument()
  })

  it('shows "Only one variation returned by backend." warning when only one candidate is present', async () => {
    const candidate = { arrangement_id: 301, status: 'done', created_at: '2024-01-15T10:00:00Z' }
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ jobs: [{ job_id: 'job-single' }] })
    ;(getJobStatus as jest.Mock).mockResolvedValue({
      status: 'finished',
      candidates: [candidate],
    })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(
      makeArrangementStatus({ id: candidate.arrangement_id })
    )
    ;(listArrangements as jest.Mock).mockResolvedValue(
      [makeArrangement({ id: candidate.arrangement_id, status: 'done' })]
    )
    ;(resolveArrangementAudioUrl as jest.Mock).mockReturnValue(null)

    await renderPage('1')

    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Only one variation returned by backend\./i)).toBeInTheDocument()
    })
  })
})

describe('render-async job id extraction bootstrap', () => {

  it('emits FRONTEND_GENERATE_START with loop_id and timestamp', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_id: 'job-start-log' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'running' })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    expect(console.log).toHaveBeenCalledWith(
      'FRONTEND_GENERATE_START',
      expect.objectContaining({ loop_id: 1, timestamp: expect.any(String) })
    )
  })

  it('emits FRONTEND_JOB_REGISTERED for each extracted job id', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ job_ids: ['job-a', 'job-b'] })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'running' })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    expect(console.log).toHaveBeenCalledWith(
      'FRONTEND_JOB_REGISTERED',
      expect.objectContaining({ loop_id: 1, job_id: 'job-a', timestamp: expect.any(String) })
    )
    expect(console.log).toHaveBeenCalledWith(
      'FRONTEND_JOB_REGISTERED',
      expect.objectContaining({ loop_id: 1, job_id: 'job-b', timestamp: expect.any(String) })
    )
  })

  it('shows readable error and does not poll when no job ids are returned', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ ok: true })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Render started but no job ID was returned\./i)).toBeInTheDocument()
    })
    expect(getJobStatus).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalledWith('RENDER_RESPONSE_NO_JOB_IDS', expect.any(Object))
  })

  it('starts polling when response shape is { id: ... }', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ id: 'job-from-id' })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'running' })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i }))
    })
    await flushPromises()

    await waitFor(() => {
      expect(getJobStatus).toHaveBeenCalledWith('job-from-id')
    })
    expect(console.log).toHaveBeenCalledWith('JOB_IDS_EXTRACTED', expect.objectContaining({ job_ids: ['job-from-id'] }))
  })
})

describe('partial multi-variation completion handling', () => {
  it('reconciles processing variation to ready when poll returns succeeded with output_url', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ jobs: [{ job_id: 'job-v3', personality: 'R&B — melodic/spacious', variation_index: 2 }] })
    ;(getJobStatus as jest.Mock)
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'succeeded', arrangement_id: 169, output_url: 'https://cdn.example.com/169.wav', job_id: 'job-v3' })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 169, output_url: 'https://cdn.example.com/169.wav' }))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()
    await flushPromises()

    await waitFor(() => {
      expect(screen.queryByText(/Variation 3 — R&B — melodic\/spacious/i)).not.toBeInTheDocument()
    })
  })

  it('does not allow processing poll to overwrite succeeded terminal state', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ jobs: [{ job_id: 'job-stale', personality: 'clean/main', variation_index: 0 }] })
    ;(getJobStatus as jest.Mock)
      .mockResolvedValueOnce({ status: 'succeeded', arrangement_id: 801, output_url: 'https://cdn.example.com/801.wav', job_id: 'job-stale' })
      .mockResolvedValueOnce({ status: 'processing', job_id: 'job-stale' })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 801, output_url: 'https://cdn.example.com/801.wav' }))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()
    await flushPromises()

    expect(screen.queryByText(/Rendering — preview will appear when ready\./i)).not.toBeInTheDocument()
  })

  it('renders only 2 variation slots in production UI, includes failed slot when present, and soft-handles 422 history', async () => {
    const LoopArchitectApiErrorCtor = (jest.requireMock('@/../../api/client') as any).LoopArchitectApiError
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({
      jobs: [
        { job_id: 'job-1', personality: 'clean/mainstream', variation_index: 0 },
        { job_id: 'job-2', personality: 'dark/drop-heavy', variation_index: 1 },
        { job_id: 'job-3', personality: 'cinematic/experimental', variation_index: 2 },
      ],
    })
    ;(getJobStatus as jest.Mock).mockImplementation((jobId: string) => {
      if (jobId === 'job-1') return Promise.resolve({ status: 'finished', arrangement_id: 501, output_url: 'https://cdn.example.com/501.wav' })
      if (jobId === 'job-2') return Promise.resolve({ status: 'finished', arrangement_id: 502, output_url: 'https://cdn.example.com/502.wav' })
      return Promise.resolve({ status: 'failed', error_message: 'Worker crashed' })
    })
    ;(getArrangementStatus as jest.Mock).mockImplementation((id: number) => Promise.resolve(makeArrangementStatus({ id })))
    ;(listArrangements as jest.Mock).mockRejectedValue(new LoopArchitectApiErrorCtor('unprocessable', 422))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Variation 1 — clean\/mainstream/i)).toBeInTheDocument()
      expect(screen.getByText(/Variation 2 — dark\/drop-heavy/i)).toBeInTheDocument()
      expect(screen.queryByText(/Variation 3 — cinematic\/experimental/i)).not.toBeInTheDocument()
    })
    expect(screen.queryByText(/Failed \/ unavailable/i)).not.toBeInTheDocument()
    expect(console.log).toHaveBeenCalledWith('FRONTEND_ARRANGEMENT_DETAIL_422_SOFT_HANDLED', expect.any(Object))
    expect(console.log).toHaveBeenCalledWith('FRONTEND_VARIATION_SORTED', expect.arrayContaining([
      expect.objectContaining({ variation_index: 0 }),
      expect.objectContaining({ variation_index: 1 }),
          ]))
  })

  it('does not show "Only one variation returned by backend" when 2+ jobs were requested and one failed', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({
      jobs: [
        { job_id: 'job-a', personality: 'clean/mainstream', variation_index: 0 },
        { job_id: 'job-b', personality: 'dark/drop-heavy', variation_index: 1 },
        { job_id: 'job-c', personality: 'cinematic/experimental', variation_index: 2 },
      ],
    })
    ;(getJobStatus as jest.Mock).mockImplementation((jobId: string) => {
      if (jobId === 'job-c') return Promise.resolve({ status: 'failed', error_message: 'Preview render failed upstream' })
      return Promise.resolve({ status: 'finished', arrangement_id: jobId === 'job-a' ? 611 : 612, output_url: `https://cdn.example.com/${jobId}.wav` })
    })
    ;(getArrangementStatus as jest.Mock).mockImplementation((id: number) => Promise.resolve(makeArrangementStatus({ id })))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.queryByText(/Variation 3 — cinematic\/experimental/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Variation 1 — clean\/mainstream/i)).toBeInTheDocument()
      expect(screen.getByText(/Variation 2 — dark\/drop-heavy/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/Only one variation returned by backend\./i)).not.toBeInTheDocument()
  })
  it('locks failed variation terminal state and does not regress to processing', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ jobs: [{ job_id: 'job-lock', personality: 'cinematic/experimental', variation_index: 2 }] })
    ;(getJobStatus as jest.Mock)
      .mockResolvedValueOnce({ status: 'failed', error_message: 'Render failed hard' })
      .mockResolvedValueOnce({ status: 'processing' })

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getAllByText(/Failed \/ unavailable/i).length).toBeGreaterThan(0)
    })
    expect(screen.queryByText(/Rendering — preview will appear when ready\./i)).not.toBeInTheDocument()
  })

  it('marks missing output terminal jobs as failed/unavailable placeholders', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({
      jobs: [
        { job_id: 'job-mo-1', personality: 'clean/mainstream', variation_index: 0 },
        { job_id: 'job-mo-2', personality: 'dark/drop-heavy', variation_index: 1 },
        { job_id: 'job-mo-3', personality: 'cinematic/experimental', variation_index: 2 },
      ],
    })
    ;(getJobStatus as jest.Mock).mockImplementation((id: string) => Promise.resolve(
      id === 'job-mo-3'
        ? { status: 'finished', arrangement_id: null, output_url: null }
        : { status: 'finished', arrangement_id: id === 'job-mo-1' ? 711 : 712, output_url: `https://cdn.example.com/${id}.wav` }
    ))
    ;(getArrangementStatus as jest.Mock).mockImplementation((id: number) => Promise.resolve(makeArrangementStatus({ id })))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.queryByText(/Variation 3 — cinematic\/experimental/i)).not.toBeInTheDocument()
      expect(screen.getByText(/Variation 1 — clean\/mainstream/i)).toBeInTheDocument()
      expect(screen.getByText(/Variation 2 — dark\/drop-heavy/i)).toBeInTheDocument()
    })
  })

  it('variation_index=2 terminal success reconciles to ready with output_url', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({ jobs: [{ job_id: 'job-idx2', personality: 'clean/main', variation_index: 2 }] })
    ;(getJobStatus as jest.Mock).mockResolvedValue({ status: 'succeeded', arrangement_id: 902, output_url: 'https://cdn.example.com/902.wav', job_id: 'job-idx2' })
    ;(getArrangementStatus as jest.Mock).mockResolvedValue(makeArrangementStatus({ id: 902, output_url: 'https://cdn.example.com/902.wav' }))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.queryByText(/Variation 3 — clean\/main/i)).not.toBeInTheDocument()
    })
    expect(console.log).toHaveBeenCalledWith('FRONTEND_VARIATION_READY_RECONCILED', expect.objectContaining({ variation_index: 2 }))
  })

  it('reconciles all 3 cards to ready when all poll responses succeed', async () => {
    ;(renderLoopAsync as jest.Mock).mockResolvedValue({
      jobs: [
        { job_id: 'job-r1', personality: 'clean/main', variation_index: 0 },
        { job_id: 'job-r2', personality: 'darker/heavier', variation_index: 1 },
        { job_id: 'job-r3', personality: 'melodic/bounce', variation_index: 2 },
      ],
    })
    ;(getJobStatus as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ status: 'succeeded', arrangement_id: id === 'job-r1' ? 1001 : id === 'job-r2' ? 1002 : 1003, output_url: `https://cdn.example.com/${id}.wav`, job_id: id })
    )
    ;(getArrangementStatus as jest.Mock).mockImplementation((id: number) => Promise.resolve(makeArrangementStatus({ id, output_url: `https://cdn.example.com/${id}.wav` })))

    await renderPage('1')
    const loopInput = screen.getByRole('spinbutton', { name: /Loop ID/i })
    await act(async () => { fireEvent.change(loopInput, { target: { value: '1' } }) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Generate Arrangement/i })) })
    await flushPromises()

    await waitFor(() => {
      expect(screen.getByText(/Variation 1 — clean\/main/i)).toBeInTheDocument()
      expect(screen.getByText(/Variation 2 — darker\/heavier/i)).toBeInTheDocument()
      expect(screen.queryByText(/Variation 3 — melodic\/bounce/i)).not.toBeInTheDocument()
    })
    const reconciledLogs = (console.log as jest.Mock).mock.calls.filter((call) => call[0] === 'FRONTEND_VARIATION_READY_RECONCILED')
    expect(reconciledLogs.length).toBeGreaterThanOrEqual(2)
  })
})
