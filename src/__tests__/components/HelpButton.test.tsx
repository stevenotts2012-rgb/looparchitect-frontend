/**
 * Tests for HelpButton and HelpModal components.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpButton, HelpModal } from '@/components/HelpButton'

// ===========================================================================
// HelpModal
// ===========================================================================

describe('HelpModal – rendering', () => {
  it('renders nothing when isOpen=false', () => {
    render(<HelpModal isOpen={false} onClose={() => {}} contentKey="upload" />)
    expect(screen.queryByRole('heading', { name: 'Upload Your Loop' })).not.toBeInTheDocument()
  })

  it('renders nothing for unknown contentKey', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="unknown_key_xyz" />)
    expect(screen.queryByRole('button', { name: /Got it/i })).not.toBeInTheDocument()
  })

  it('renders modal title when isOpen=true and valid contentKey', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="upload" />)
    expect(screen.getByText('Upload Your Loop')).toBeInTheDocument()
  })

  it('renders "Got it!" close button', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="upload" />)
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument()
  })

  it('renders close (X) button in header', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="upload" />)
    expect(screen.getByRole('button', { name: /Close help/i })).toBeInTheDocument()
  })

  it('renders section headings for upload content', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="upload" />)
    expect(screen.getByText('What is a Loop?')).toBeInTheDocument()
  })

  it('renders sections for generate content', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="generate" />)
    expect(screen.getByText('Generate Arrangement')).toBeInTheDocument()
  })

  it('renders producerMoves content', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="producerMoves" />)
    expect(screen.getByText('Producer Moves Explained')).toBeInTheDocument()
  })

  it('renders styleParameters content', () => {
    render(<HelpModal isOpen={true} onClose={() => {}} contentKey="styleParameters" />)
    expect(screen.getByText('Style Parameters Guide')).toBeInTheDocument()
  })
})

describe('HelpModal – interactions', () => {
  it('calls onClose when X button is clicked', async () => {
    const onClose = jest.fn()
    render(<HelpModal isOpen={true} onClose={onClose} contentKey="upload" />)
    await userEvent.click(screen.getByRole('button', { name: /Close help/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when "Got it!" button is clicked', async () => {
    const onClose = jest.fn()
    render(<HelpModal isOpen={true} onClose={onClose} contentKey="upload" />)
    await userEvent.click(screen.getByRole('button', { name: /Got it/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = jest.fn()
    const { container } = render(<HelpModal isOpen={true} onClose={onClose} contentKey="upload" />)
    // The backdrop is the first fixed div with z-40
    const backdrop = container.querySelector('.z-40')
    expect(backdrop).not.toBeNull()
    if (backdrop) fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when clicking inside modal content', async () => {
    const onClose = jest.fn()
    render(<HelpModal isOpen={true} onClose={onClose} contentKey="upload" />)
    fireEvent.click(screen.getByText('Upload Your Loop'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// HelpButton – icon variant (default)
// ===========================================================================

describe('HelpButton – icon variant', () => {
  it('renders a button with "Show help" title', () => {
    render(<HelpButton contentKey="upload" />)
    expect(screen.getByTitle('Show help')).toBeInTheDocument()
  })

  it('modal is initially closed', () => {
    render(<HelpButton contentKey="upload" />)
    expect(screen.queryByText('Upload Your Loop')).not.toBeInTheDocument()
  })

  it('opens modal when button is clicked', async () => {
    render(<HelpButton contentKey="upload" />)
    await userEvent.click(screen.getByTitle('Show help'))
    expect(screen.getByText('Upload Your Loop')).toBeInTheDocument()
  })

  it('closes modal after clicking close button', async () => {
    render(<HelpButton contentKey="upload" />)
    await userEvent.click(screen.getByTitle('Show help'))
    await waitFor(() => screen.getByText('Upload Your Loop'))
    await userEvent.click(screen.getByRole('button', { name: /Close help/i }))
    await waitFor(() =>
      expect(screen.queryByText('Upload Your Loop')).not.toBeInTheDocument()
    )
  })

  it('accepts additional className', () => {
    render(<HelpButton contentKey="upload" className="extra-class" />)
    expect(screen.getByTitle('Show help')).toHaveClass('extra-class')
  })
})

// ===========================================================================
// HelpButton – text variant
// ===========================================================================

describe('HelpButton – text variant', () => {
  it('renders a "Help" text button', () => {
    render(<HelpButton contentKey="generate" variant="text" />)
    expect(screen.getByTitle('Show help')).toBeInTheDocument()
    expect(screen.getByText('Help')).toBeInTheDocument()
  })

  it('opens modal when clicked', async () => {
    render(<HelpButton contentKey="generate" variant="text" />)
    await userEvent.click(screen.getByTitle('Show help'))
    expect(screen.getByText('Generate Arrangement')).toBeInTheDocument()
  })
})

// ===========================================================================
// HelpButton – inline variant
// ===========================================================================

describe('HelpButton – inline variant', () => {
  it('renders a "Need help?" inline button', () => {
    render(<HelpButton contentKey="producerMoves" variant="inline" />)
    expect(screen.getByText('Need help?')).toBeInTheDocument()
  })

  it('opens modal when clicked', async () => {
    render(<HelpButton contentKey="producerMoves" variant="inline" />)
    await userEvent.click(screen.getByText('Need help?'))
    expect(screen.getByText('Producer Moves Explained')).toBeInTheDocument()
  })
})
