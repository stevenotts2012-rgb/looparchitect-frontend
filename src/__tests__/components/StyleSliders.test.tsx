/**
 * Tests for StyleSliders component.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleSliders } from '@/components/StyleSliders'

const defaultProps = {
  onChange: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('StyleSliders – rendering', () => {
  it('renders the Style Parameters heading', () => {
    render(<StyleSliders {...defaultProps} />)
    expect(screen.getByText('Style Parameters')).toBeInTheDocument()
  })

  it('renders all four slider labels', () => {
    render(<StyleSliders {...defaultProps} />)
    expect(screen.getByText('Energy')).toBeInTheDocument()
    expect(screen.getByText('Darkness')).toBeInTheDocument()
    expect(screen.getByText('Bounce')).toBeInTheDocument()
    expect(screen.getByText('Warmth')).toBeInTheDocument()
  })

  it('renders four range inputs', () => {
    render(<StyleSliders {...defaultProps} />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(4)
  })

  it('renders texture buttons: Smooth, Balanced, Gritty', () => {
    render(<StyleSliders {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Smooth/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Balanced/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gritty/i })).toBeInTheDocument()
  })

  it('renders endpoint labels for each slider', () => {
    render(<StyleSliders {...defaultProps} />)
    expect(screen.getByText('Quiet')).toBeInTheDocument()
    expect(screen.getByText('Loud')).toBeInTheDocument()
    expect(screen.getByText('Bright')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Laid-back')).toBeInTheDocument()
    expect(screen.getByText('Driving')).toBeInTheDocument()
    expect(screen.getByText('Cold')).toBeInTheDocument()
    expect(screen.getByText('Warm')).toBeInTheDocument()
  })

  it('shows default values at 50% for numeric sliders', () => {
    render(<StyleSliders {...defaultProps} />)
    const percentages = screen.getAllByText('50%')
    expect(percentages.length).toBeGreaterThanOrEqual(4)
  })

  it('shows Balanced as selected by default', () => {
    render(<StyleSliders {...defaultProps} />)
    const balanced = screen.getByRole('button', { name: /Balanced/i })
    expect(balanced.className).toContain('bg-blue-600')
  })
})

describe('StyleSliders – initial values', () => {
  it('respects initialValues prop for energy', () => {
    render(<StyleSliders {...defaultProps} initialValues={{ energy: 0.8 }} />)
    const energySlider = screen.getByRole('slider', { name: 'Energy' })
    expect(energySlider).toHaveValue('0.8')
  })

  it('respects initialValues prop for texture', () => {
    render(<StyleSliders {...defaultProps} initialValues={{ texture: 'gritty' }} />)
    const grittyBtn = screen.getByRole('button', { name: /Gritty/i })
    expect(grittyBtn.className).toContain('bg-blue-600')
  })
})

describe('StyleSliders – slider interactions', () => {
  it('calls onChange when energy slider changes', () => {
    render(<StyleSliders {...defaultProps} />)
    const energySlider = screen.getByRole('slider', { name: 'Energy' })
    fireEvent.change(energySlider, { target: { value: '0.7' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ energy: 0.7 })
    )
  })

  it('calls onChange when darkness slider changes', () => {
    render(<StyleSliders {...defaultProps} />)
    const slider = screen.getByRole('slider', { name: 'Darkness' })
    fireEvent.change(slider, { target: { value: '0.9' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ darkness: 0.9 })
    )
  })

  it('calls onChange when bounce slider changes', () => {
    render(<StyleSliders {...defaultProps} />)
    const slider = screen.getByRole('slider', { name: 'Bounce' })
    fireEvent.change(slider, { target: { value: '0.3' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bounce: 0.3 })
    )
  })

  it('calls onChange when warmth slider changes', () => {
    render(<StyleSliders {...defaultProps} />)
    const slider = screen.getByRole('slider', { name: 'Warmth' })
    fireEvent.change(slider, { target: { value: '0.1' } })
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ warmth: 0.1 })
    )
  })

  it('updates percentage display when slider changes', () => {
    render(<StyleSliders {...defaultProps} />)
    const energySlider = screen.getByRole('slider', { name: 'Energy' })
    fireEvent.change(energySlider, { target: { value: '0.75' } })
    expect(screen.getByText('75%')).toBeInTheDocument()
  })
})

describe('StyleSliders – texture buttons', () => {
  it('calls onChange with texture=smooth when Smooth is clicked', async () => {
    render(<StyleSliders {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Smooth/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ texture: 'smooth' })
    )
  })

  it('calls onChange with texture=gritty when Gritty is clicked', async () => {
    render(<StyleSliders {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Gritty/i }))
    expect(defaultProps.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ texture: 'gritty' })
    )
  })

  it('highlights clicked texture button', async () => {
    render(<StyleSliders {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Smooth/i }))
    expect(screen.getByRole('button', { name: /Smooth/i }).className).toContain('bg-blue-600')
  })

  it('removes highlight from previously selected texture', async () => {
    render(<StyleSliders {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Smooth/i }))
    expect(screen.getByRole('button', { name: /Balanced/i }).className).not.toContain('bg-blue-600')
  })
})

describe('StyleSliders – disabled state', () => {
  it('disables all sliders when disabled=true', () => {
    render(<StyleSliders {...defaultProps} disabled={true} />)
    const sliders = screen.getAllByRole('slider')
    sliders.forEach((slider) => expect(slider).toBeDisabled())
  })

  it('disables texture buttons when disabled=true', () => {
    render(<StyleSliders {...defaultProps} disabled={true} />)
    expect(screen.getByRole('button', { name: /Smooth/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Balanced/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Gritty/i })).toBeDisabled()
  })
})
