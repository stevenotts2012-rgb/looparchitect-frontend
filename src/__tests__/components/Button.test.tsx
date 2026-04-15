/**
 * Tests for Button component.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Button from '@/components/Button'

describe('Button – rendering', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('renders with primary variant by default', () => {
    render(<Button>Primary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('from-blue-500')
  })

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-gray-700')
  })

  it('renders with sm size', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('text-sm')
  })

  it('renders with md size by default', () => {
    render(<Button>Medium</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('text-base')
  })

  it('renders with lg size', () => {
    render(<Button size="lg">Large</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('text-lg')
  })

  it('merges additional className', () => {
    render(<Button className="my-class">Button</Button>)
    expect(screen.getByRole('button')).toHaveClass('my-class')
  })

  it('is not disabled by default', () => {
    render(<Button>Active</Button>)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('Button – interactions', () => {
  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn()
    render(<Button disabled onClick={handleClick}>Click</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('forwards other HTML button attributes', () => {
    render(<Button type="submit" aria-label="submit-btn">Submit</Button>)
    const btn = screen.getByRole('button', { name: 'submit-btn' })
    expect(btn).toHaveAttribute('type', 'submit')
  })
})
