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
    const regenBtn = screen.getByRole('button', { name: /Generate 3 New Variations/i })
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
      expect(screen.getByText(/Worker crashed/i)).toBeInTheDocument()
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

    // Advance timer to fire 4 more poll intervals (5 total failures)
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        jest.advanceTimersByTime(3000)
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
      // The "Generate 3 New Variations" button in that section must not be disabled
      // (isGenerating=false), proving the stuck-generating bug is fixed.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Generate 3 New Variations/i })).not.toBeDisabled()
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
