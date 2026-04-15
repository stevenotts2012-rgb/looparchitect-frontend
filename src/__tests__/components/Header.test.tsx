/**
 * Tests for Header component.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import Header from '@/components/Header'

describe('Header – rendering', () => {
  it('renders the LoopArchitect brand name', () => {
    render(<Header />)
    expect(screen.getByText('LoopArchitect')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Header />)
    expect(screen.getByRole('link', { name: 'Browse' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Loops' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
  })

  it('renders Sign In and Sign Up buttons', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument()
  })

  it('renders a header landmark element', () => {
    render(<Header />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders navigation landmark', () => {
    render(<Header />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
