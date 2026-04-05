import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReferenceTrackPanel from '@/components/ReferenceTrackPanel'
import { ReferenceGuidancePanel } from '@/components/ReferenceGuidancePanel'
import * as apiClient from '@/../../api/client'

jest.mock('@/../../api/client', () => ({
  ...jest.requireActual('@/../../api/client'),
  analyzeReferenceTrack: jest.fn(),
}))

const mockAnalyzeReferenceTrack = apiClient.analyzeReferenceTrack as jest.MockedFunction<
  typeof apiClient.analyzeReferenceTrack
>

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

const defaultProps = {
  adaptationStrength: 'medium' as const,
  guidanceMode: 'structure_energy' as const,
  onAdaptationStrengthChange: jest.fn(),
  onGuidanceModeChange: jest.fn(),
  onAnalysisComplete: jest.fn(),
  onAnalysisCleared: jest.fn(),
}

describe('ReferenceTrackPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('initial render (no reference uploaded)', () => {
    it('renders the section heading and helper text', () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      expect(screen.getByText('Use a Reference Track')).toBeInTheDocument()
      expect(screen.getByText('Optional')).toBeInTheDocument()
      expect(
        screen.getByText(/Upload a song or instrumental to guide the structure/i)
      ).toBeInTheDocument()
    })

    it('renders the file upload button', () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument()
    })

    it('shows placeholder text when no file is chosen', () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      expect(screen.getByText(/No file chosen/i)).toBeInTheDocument()
    })

    it('does not show adaptation or guidance controls before analysis', () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      expect(screen.queryByText('Adaptation Strength')).not.toBeInTheDocument()
      expect(screen.queryByText('Guidance Mode')).not.toBeInTheDocument()
    })
  })

  describe('file validation', () => {
    it('rejects non-audio files', async () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      const invalidFile = makeFile('notes.pdf', 'application/pdf')

      // Use fireEvent.change because userEvent.upload respects the accept
      // attribute and would silently ignore non-matching files.
      fireEvent.change(input, { target: { files: [invalidFile] } })

      expect(
        await screen.findByText(/Unsupported file type/i)
      ).toBeInTheDocument()
      expect(defaultProps.onAnalysisComplete).not.toHaveBeenCalled()
    })

    it('rejects files exceeding 50 MB', async () => {
      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      const oversizedFile = makeFile('big.mp3', 'audio/mpeg', 51 * 1024 * 1024)
      await userEvent.upload(input, oversizedFile)

      expect(await screen.findByText(/too large/i)).toBeInTheDocument()
      expect(defaultProps.onAnalysisComplete).not.toHaveBeenCalled()
    })

    it('accepts .mp3 files', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-123',
        summary: { section_count: 4 },
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      const mp3File = makeFile('track.mp3', 'audio/mpeg')
      await userEvent.upload(input, mp3File)

      await waitFor(() => {
        expect(defaultProps.onAnalysisComplete).toHaveBeenCalledWith(
          'ref-123',
          { section_count: 4 }
        )
      })
    })

    it('accepts .wav files', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-wav-456',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      const wavFile = makeFile('loop.wav', 'audio/wav')
      await userEvent.upload(input, wavFile)

      await waitFor(() => {
        expect(defaultProps.onAnalysisComplete).toHaveBeenCalledWith(
          'ref-wav-456',
          undefined
        )
      })
    })
  })

  describe('analysis loading state', () => {
    it('shows "Analyzing reference track…" while analyzing', async () => {
      let resolveAnalysis!: (v: apiClient.ReferenceAnalysisResponse) => void
      mockAnalyzeReferenceTrack.mockImplementation(
        () =>
          new Promise<apiClient.ReferenceAnalysisResponse>((r) => {
            resolveAnalysis = r
          })
      )

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(await screen.findByText(/Analyzing reference track/i)).toBeInTheDocument()

      // Cleanup: resolve the promise
      resolveAnalysis({ reference_analysis_id: 'done', summary: undefined })
    })
  })

  describe('analysis success state', () => {
    it('shows success badge and summary when analysis completes', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-success',
        summary: {
          section_count: 6,
          detected_tempo: 128,
          structure_overview: 'ABABCB',
        },
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      // "Reference analyzed successfully" is unique (badge says "Reference analyzed"
      // without "successfully"), so this avoids a multiple-elements match.
      expect(await screen.findByText(/Reference analyzed successfully/i)).toBeInTheDocument()
      expect(screen.getByText(/6 sections? detected/i)).toBeInTheDocument()
      expect(screen.getByText(/128 BPM/i)).toBeInTheDocument()
      expect(screen.getByText('ABABCB')).toBeInTheDocument()
    })

    it('shows adaptation and guidance controls after success', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-ok',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(await screen.findByText('Adaptation Strength')).toBeInTheDocument()
      expect(screen.getByText('Guidance Mode')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Loose/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Medium/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Structure only/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Energy only/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Structure \+ Energy/i })).toBeInTheDocument()
    })

    it('calls onAdaptationStrengthChange when Loose is clicked', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-ok',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))
      await screen.findByText('Adaptation Strength')

      await userEvent.click(screen.getByRole('button', { name: /Loose/i }))
      expect(defaultProps.onAdaptationStrengthChange).toHaveBeenCalledWith('loose')
    })

    it('calls onGuidanceModeChange when Energy only is clicked', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-ok',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))
      await screen.findByText('Guidance Mode')

      await userEvent.click(screen.getByRole('button', { name: /Energy only/i }))
      expect(defaultProps.onGuidanceModeChange).toHaveBeenCalledWith('energy')
    })

    it('shows remove reference track button', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-ok',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(await screen.findByText(/Remove reference track/i)).toBeInTheDocument()
    })

    it('clears state when remove reference track is clicked', async () => {
      mockAnalyzeReferenceTrack.mockResolvedValue({
        reference_analysis_id: 'ref-ok',
        summary: undefined,
      })

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))
      await screen.findByText(/Remove reference track/i)

      await userEvent.click(screen.getByText(/Remove reference track/i))

      expect(defaultProps.onAnalysisCleared).toHaveBeenCalled()
      expect(screen.queryByText('Adaptation Strength')).not.toBeInTheDocument()
      expect(screen.getByText(/No file chosen/i)).toBeInTheDocument()
    })
  })

  describe('analysis error state', () => {
    it('shows error message when analysis fails', async () => {
      mockAnalyzeReferenceTrack.mockRejectedValue(
        new apiClient.LoopArchitectApiError('Reference analysis failed', 500)
      )

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(await screen.findByText('Reference analysis failed')).toBeInTheDocument()
      expect(defaultProps.onAnalysisComplete).not.toHaveBeenCalled()
    })

    it('shows generic error for non-API errors', async () => {
      mockAnalyzeReferenceTrack.mockRejectedValue(new Error('Network error'))

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(
        await screen.findByText(/Could not analyze the reference track/i)
      ).toBeInTheDocument()
    })

    it('shows retry button after error', async () => {
      mockAnalyzeReferenceTrack.mockRejectedValue(
        new apiClient.LoopArchitectApiError('Server error', 503)
      )

      render(<ReferenceTrackPanel {...defaultProps} />)

      const input = screen.getByLabelText(/upload reference track/i)
      await userEvent.upload(input, makeFile('ref.mp3', 'audio/mpeg'))

      expect(await screen.findByText(/Try a different file/i)).toBeInTheDocument()
    })
  })

  describe('disabled state', () => {
    it('disables the choose file button when disabled prop is set', () => {
      render(<ReferenceTrackPanel {...defaultProps} disabled />)

      expect(screen.getByRole('button', { name: /choose file/i })).toBeDisabled()
    })
  })
})

describe('ReferenceGuidancePanel', () => {
  const baseProps = {
    summary: null,
    adaptationStrength: 'medium' as const,
    guidanceMode: 'structure_energy' as const,
  }

  it('renders the Reference Guidance heading', () => {
    render(<ReferenceGuidancePanel {...baseProps} />)

    expect(screen.getByText('Reference Guidance')).toBeInTheDocument()
  })

  it('shows the disclaimer text', () => {
    render(<ReferenceGuidancePanel {...baseProps} />)

    expect(
      screen.getByText(/No musical content was copied/i)
    ).toBeInTheDocument()
  })

  it('displays adaptation strength and guidance mode', () => {
    render(<ReferenceGuidancePanel {...baseProps} />)

    expect(screen.getByText('Adaptation Strength')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Guidance Mode')).toBeInTheDocument()
    expect(screen.getByText('Structure + Energy')).toBeInTheDocument()
  })

  it('renders null-safely when summary is null', () => {
    expect(() => render(<ReferenceGuidancePanel {...baseProps} summary={null} />)).not.toThrow()
  })

  it('renders null-safely when summary is undefined', () => {
    expect(() =>
      render(<ReferenceGuidancePanel {...baseProps} summary={undefined} />)
    ).not.toThrow()
  })

  it('shows summary fields when provided', () => {
    render(
      <ReferenceGuidancePanel
        {...baseProps}
        summary={{
          section_count: 5,
          detected_tempo: 95,
          structure_overview: 'Verse-Chorus-Bridge',
          energy_profile: 'Low to high arc',
        }}
      />
    )

    expect(screen.getByText(/5 sections? detected/i)).toBeInTheDocument()
    expect(screen.getByText(/95 BPM/i)).toBeInTheDocument()
    expect(screen.getByText('Verse-Chorus-Bridge')).toBeInTheDocument()
    expect(screen.getByText('Low to high arc')).toBeInTheDocument()
  })

  it('shows referenceStructureSummary when provided', () => {
    render(
      <ReferenceGuidancePanel
        {...baseProps}
        referenceStructureSummary="6 sections with build and drop pattern"
      />
    )

    expect(
      screen.getByText('6 sections with build and drop pattern')
    ).toBeInTheDocument()
  })

  it('does not render referenceStructureSummary section when null', () => {
    render(
      <ReferenceGuidancePanel {...baseProps} referenceStructureSummary={null} />
    )

    expect(screen.queryByText('Structure Analysis')).not.toBeInTheDocument()
  })

  it('shows producer notes when provided', () => {
    render(
      <ReferenceGuidancePanel
        {...baseProps}
        producerNotes={['Reference-guided intro', 'Energy matched at chorus']}
      />
    )

    expect(screen.getByText('Reference-guided intro')).toBeInTheDocument()
    expect(screen.getByText('Energy matched at chorus')).toBeInTheDocument()
  })

  it('does not render producer notes section when null', () => {
    render(<ReferenceGuidancePanel {...baseProps} producerNotes={null} />)

    expect(screen.queryByText('Producer Notes')).not.toBeInTheDocument()
  })

  it('does not render producer notes section when empty array', () => {
    render(<ReferenceGuidancePanel {...baseProps} producerNotes={[]} />)

    expect(screen.queryByText('Producer Notes')).not.toBeInTheDocument()
  })

  it('collapses and expands when header is clicked', async () => {
    render(<ReferenceGuidancePanel {...baseProps} />)

    const toggleButton = screen.getByRole('button')
    expect(screen.getByText(/No musical content was copied/i)).toBeInTheDocument()

    await userEvent.click(toggleButton)
    expect(screen.queryByText(/No musical content was copied/i)).not.toBeInTheDocument()

    await userEvent.click(toggleButton)
    expect(screen.getByText(/No musical content was copied/i)).toBeInTheDocument()
  })

  it('renders all adaptation strength label variants', () => {
    const { rerender } = render(
      <ReferenceGuidancePanel {...baseProps} adaptationStrength="loose" />
    )
    expect(screen.getByText('Loose')).toBeInTheDocument()

    rerender(<ReferenceGuidancePanel {...baseProps} adaptationStrength="close" />)
    expect(screen.getByText('Close')).toBeInTheDocument()
  })

  it('renders all guidance mode label variants', () => {
    const { rerender } = render(
      <ReferenceGuidancePanel {...baseProps} guidanceMode="structure" />
    )
    expect(screen.getByText('Structure only')).toBeInTheDocument()

    rerender(<ReferenceGuidancePanel {...baseProps} guidanceMode="energy" />)
    expect(screen.getByText('Energy only')).toBeInTheDocument()
  })
})
