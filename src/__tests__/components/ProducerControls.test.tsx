/**
 * Tests for ProducerControls component.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProducerControls } from '@/components/ProducerControls'

const defaultProps = {
  onGenreChange: jest.fn(),
  onEnergyChange: jest.fn(),
  onStyleDirectionChange: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ProducerControls – rendering', () => {
  it('renders the Producer Controls heading', () => {
    render(<ProducerControls {...defaultProps} />)
    expect(screen.getByRole('heading', { name: /Producer Controls/i })).toBeInTheDocument()
  })

  it('renders all genre buttons', () => {
    render(<ProducerControls {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Trap/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /R&B/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pop/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cinematic/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Afrobeats/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Drill/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /House/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generic/i })).toBeInTheDocument()
  })

  it('renders the energy slider', () => {
    render(<ProducerControls {...defaultProps} />)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('renders the style direction textarea', () => {
    render(<ProducerControls {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows default energy of 50%', () => {
    render(<ProducerControls {...defaultProps} />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })

  it('shows "Generic" as selected by default', () => {
    render(<ProducerControls {...defaultProps} />)
    const genericBtn = screen.getByRole('button', { name: /Generic/i })
    expect(genericBtn.className).toContain('border-blue-500')
  })})

describe('ProducerControls – genre selection', () => {
  it('calls onGenreChange when a genre is clicked', async () => {
    render(<ProducerControls {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Trap/i }))
    expect(defaultProps.onGenreChange).toHaveBeenCalledWith('trap')
  })

  it('highlights selected genre button', async () => {
    render(<ProducerControls {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Trap/i }))
    const trapBtn = screen.getByRole('button', { name: /Trap/i })
    expect(trapBtn.className).toContain('border-blue-500')
  })

  it('unhighlights previously selected genre', async () => {
    render(<ProducerControls {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Trap/i }))
    const genericBtn = screen.getByRole('button', { name: /Generic/i })
    expect(genericBtn.className).not.toContain('border-blue-500')
  })
})

describe('ProducerControls – energy slider', () => {
  it('calls onEnergyChange when slider changes', () => {
    render(<ProducerControls {...defaultProps} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '0.8' } })
    expect(defaultProps.onEnergyChange).toHaveBeenCalledWith(0.8)
  })

  it('updates displayed energy percentage', () => {
    render(<ProducerControls {...defaultProps} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '0.7' } })
    expect(screen.getByText(/70%/)).toBeInTheDocument()
  })
})

describe('ProducerControls – style direction', () => {
  it('calls onStyleDirectionChange when textarea is typed in', async () => {
    render(<ProducerControls {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Dark trap vibe')
    expect(defaultProps.onStyleDirectionChange).toHaveBeenCalled()
  })
})

describe('ProducerControls – disabled state', () => {
  it('disables all genre buttons when isLoading=true', () => {
    render(<ProducerControls {...defaultProps} isLoading={true} />)
    const trapBtn = screen.getByRole('button', { name: /Trap/i })
    expect(trapBtn).toBeDisabled()
  })

  it('disables energy slider when isLoading=true', () => {
    render(<ProducerControls {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('slider')).toBeDisabled()
  })

  it('disables textarea when isLoading=true', () => {
    render(<ProducerControls {...defaultProps} isLoading={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
