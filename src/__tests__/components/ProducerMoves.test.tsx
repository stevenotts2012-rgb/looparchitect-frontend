/**
 * Tests for ProducerMoves component.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProducerMoves } from '@/components/ProducerMoves'

const defaultProps = {
  selectedMoves: [] as string[],
  onChange: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ProducerMoves – rendering', () => {
  it('renders the Producer Moves heading', () => {
    render(<ProducerMoves {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /Producer Moves/i })).toBeInTheDocument()
  })

  it('renders Select All and Clear buttons', () => {
    render(<ProducerMoves {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Select All/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
  })

  it('shows selected count 0 initially', () => {
    render(<ProducerMoves {...defaultProps} />)
    // Text is split across spans – check using textContent of the parent span
    const countSpan = screen.getByText(/Selected:/)
    expect(countSpan.textContent).toContain('0')
  })

  it('shows category headers: Intro, Transitions, Variations, Outro', () => {
    render(<ProducerMoves {...defaultProps} />)
    expect(screen.getByText('Intro')).toBeInTheDocument()
    expect(screen.getByText('Transitions')).toBeInTheDocument()
    expect(screen.getByText('Variations')).toBeInTheDocument()
    expect(screen.getByText('Outro')).toBeInTheDocument()
  })

  it('renders all 12 producer moves by default (categories expanded)', () => {
    render(<ProducerMoves {...defaultProps} />)
    expect(screen.getByText('Intro Tease')).toBeInTheDocument()
    expect(screen.getByText('Hook Drop')).toBeInTheDocument()
    expect(screen.getByText('Verse Space')).toBeInTheDocument()
    expect(screen.getByText('8-Bar Hat Roll')).toBeInTheDocument()
    expect(screen.getByText('End-of-Section Fill')).toBeInTheDocument()
    expect(screen.getByText('Pre-Hook Mute')).toBeInTheDocument()
    expect(screen.getByText('Silence Drop')).toBeInTheDocument()
    expect(screen.getByText('Layer Lift')).toBeInTheDocument()
    expect(screen.getByText('Bridge Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Final Hook Expansion')).toBeInTheDocument()
    expect(screen.getByText('Outro Strip')).toBeInTheDocument()
    expect(screen.getByText('Call-and-Response')).toBeInTheDocument()
  })
})

describe('ProducerMoves – selection', () => {
  it('calls onChange with move added when an unselected move is clicked', async () => {
    render(<ProducerMoves {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Intro Tease/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith(['intro_tease'])
  })

  it('calls onChange with move removed when a selected move is clicked', async () => {
    render(<ProducerMoves {...defaultProps} selectedMoves={['intro_tease']} />)
    await userEvent.click(screen.getByRole('button', { name: /Intro Tease/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith([])
  })

  it('shows selected count when moves are selected', () => {
    render(<ProducerMoves {...defaultProps} selectedMoves={['intro_tease', 'hook_drop']} />)
    const countSpan = screen.getByText(/Selected:/)
    expect(countSpan.textContent).toContain('2')
  })

  it('shows "Engine will intelligently place..." hint when moves are selected', () => {
    render(<ProducerMoves {...defaultProps} selectedMoves={['intro_tease']} />)
    expect(screen.getByText(/Engine will intelligently place/i)).toBeInTheDocument()
  })

  it('does not show hint when no moves are selected', () => {
    render(<ProducerMoves {...defaultProps} />)
    expect(screen.queryByText(/Engine will intelligently place/i)).not.toBeInTheDocument()
  })
})

describe('ProducerMoves – Select All / Clear', () => {
  it('calls onChange with all 12 move IDs when Select All is clicked', async () => {
    render(<ProducerMoves {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Select All/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.arrayContaining(['intro_tease', 'hook_drop', 'outro_strip'])
    )
    const [called] = defaultProps.onChange.mock.calls.at(-1)!
    expect(called).toHaveLength(12)
  })

  it('calls onChange with empty array when Clear is clicked', async () => {
    render(<ProducerMoves {...defaultProps} selectedMoves={['intro_tease']} />)
    await userEvent.click(screen.getByRole('button', { name: /Clear/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith([])
  })
})

describe('ProducerMoves – category toggle', () => {
  it('hides category moves when category header is clicked', async () => {
    render(<ProducerMoves {...defaultProps} />)
    // Click the "Intro" category header button - the button wrapping the text "Intro"
    // The button text includes "(0/1)" so it won't conflict with "Intro Tease"
    const introHeader = screen.getByText('Intro', { selector: 'span' }).closest('button')!
    await userEvent.click(introHeader)
    expect(screen.queryByText('Intro Tease')).not.toBeInTheDocument()
  })

  it('re-expands category after clicking collapsed header', async () => {
    render(<ProducerMoves {...defaultProps} />)
    const introHeader = screen.getByText('Intro', { selector: 'span' }).closest('button')!
    await userEvent.click(introHeader)
    await userEvent.click(introHeader)
    expect(screen.getByText('Intro Tease')).toBeInTheDocument()
  })
})

describe('ProducerMoves – disabled state', () => {
  it('does not call onChange when disabled and move is clicked', async () => {
    render(<ProducerMoves {...defaultProps} disabled={true} />)
    await userEvent.click(screen.getByRole('button', { name: /Intro Tease/i }))
    expect(defaultProps.onChange).not.toHaveBeenCalled()
  })

  it('disables Select All when disabled=true', () => {
    render(<ProducerMoves {...defaultProps} disabled={true} />)
    expect(screen.getByRole('button', { name: /Select All/i })).toBeDisabled()
  })

  it('disables Clear when disabled=true', () => {
    render(<ProducerMoves {...defaultProps} disabled={true} />)
    expect(screen.getByRole('button', { name: /Clear/i })).toBeDisabled()
  })
})
