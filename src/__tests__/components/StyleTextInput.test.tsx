/**
 * Tests for StyleTextInput component.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleTextInput } from '@/components/StyleTextInput'

const defaultProps = {
  onChange: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('StyleTextInput – rendering', () => {
  it('renders the "Describe Your Style" label', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.getByText('Describe Your Style')).toBeInTheDocument()
  })

  it('renders the textarea', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.getByRole('textbox', { name: /Style description/i })).toBeInTheDocument()
  })

  it('shows character count starting at 0/500', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.getByText('0/500')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.getByPlaceholderText(/cinematic dark atmospheric/i)).toBeInTheDocument()
  })

  it('renders example styles toggle', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.getByText(/Example styles/i)).toBeInTheDocument()
  })

  it('does not render Validate Style button when onValidate is not provided', () => {
    render(<StyleTextInput {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /Validate Style/i })).not.toBeInTheDocument()
  })

  it('renders Validate Style button when onValidate is provided', () => {
    render(<StyleTextInput {...defaultProps} onValidate={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).toBeInTheDocument()
  })
})

describe('StyleTextInput – initial value', () => {
  it('shows initialValue when provided', () => {
    render(<StyleTextInput {...defaultProps} initialValue="dark trap" />)
    expect(screen.getByRole('textbox')).toHaveValue('dark trap')
  })

  it('shows character count for initial value', () => {
    render(<StyleTextInput {...defaultProps} initialValue="dark trap" />)
    expect(screen.getByText('9/500')).toBeInTheDocument()
  })
})

describe('StyleTextInput – text input', () => {
  it('calls onChange when typing', async () => {
    render(<StyleTextInput {...defaultProps} />)
    await userEvent.type(screen.getByRole('textbox'), 'chill synthwave')
    expect(defaultProps.onChange).toHaveBeenCalled()
  })

  it('updates character count when typing', async () => {
    render(<StyleTextInput {...defaultProps} />)
    await userEvent.type(screen.getByRole('textbox'), 'hi')
    expect(screen.getByText('2/500')).toBeInTheDocument()
  })

  it('enforces max 500 character limit', async () => {
    render(<StyleTextInput {...defaultProps} />)
    const textarea = screen.getByRole('textbox')
    const longText = 'a'.repeat(600)
    fireEvent.change(textarea, { target: { value: longText } })
    // The component slices to 500
    expect(textarea).toHaveValue('a'.repeat(500))
    expect(screen.getByText('500/500')).toBeInTheDocument()
  })

  it('disables Validate button when text is empty', () => {
    render(<StyleTextInput {...defaultProps} onValidate={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).toBeDisabled()
  })

  it('clears error message after typing new text', async () => {
    const onValidate = jest.fn().mockRejectedValue(new Error('Server error'))
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} initialValue="dark trap" />)
    // First trigger a validation error
    await userEvent.click(screen.getByRole('button', { name: /Validate Style/i }))
    await waitFor(() => screen.getByText('Server error'))
    // Now type to clear the error
    await userEvent.type(screen.getByRole('textbox'), ' new')
    await waitFor(() =>
      expect(screen.queryByText('Server error')).not.toBeInTheDocument()
    )
  })
})

describe('StyleTextInput – validation', () => {
  it('does not call onValidate when text is empty (button is disabled)', () => {
    const onValidate = jest.fn()
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).toBeDisabled()
    expect(onValidate).not.toHaveBeenCalled()
  })

  it('shows "Validating..." while onValidate is pending', async () => {
    let resolveValidation!: (val: boolean) => void
    const onValidate = jest.fn().mockImplementation(
      () => new Promise<boolean>((r) => { resolveValidation = r })
    )
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} initialValue="dark trap" />)
    fireEvent.click(screen.getByRole('button', { name: /Validate Style/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Validating/i })).toBeInTheDocument()
    )
    resolveValidation(true)
  })

  it('shows success message after successful validation', async () => {
    const onValidate = jest.fn().mockResolvedValue(true)
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} initialValue="dark trap" />)
    await userEvent.click(screen.getByRole('button', { name: /Validate Style/i }))
    await waitFor(() => screen.getByText(/Style validated successfully/i))
    expect(screen.getByText(/Style validated successfully/i)).toBeInTheDocument()
  })

  it('shows error message when onValidate throws', async () => {
    const onValidate = jest.fn().mockRejectedValue(new Error('Server validation failed'))
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} initialValue="dark trap" />)
    await userEvent.click(screen.getByRole('button', { name: /Validate Style/i }))
    await waitFor(() => screen.getByText('Server validation failed'))
    expect(screen.getByText('Server validation failed')).toBeInTheDocument()
  })

  it('disables Validate button while validating', async () => {
    let resolveValidation!: (val: boolean) => void
    const onValidate = jest.fn().mockImplementation(
      () => new Promise<boolean>((r) => { resolveValidation = r })
    )
    render(<StyleTextInput {...defaultProps} onValidate={onValidate} initialValue="dark trap" />)
    fireEvent.click(screen.getByRole('button', { name: /Validate Style/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Validating/i })).toBeDisabled()
    )
    resolveValidation(true)
  })

  it('disables Validate button when text is empty', () => {
    render(<StyleTextInput {...defaultProps} onValidate={jest.fn()} />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).toBeDisabled()
  })

  it('enables Validate button when text is non-empty', async () => {
    render(<StyleTextInput {...defaultProps} onValidate={jest.fn()} initialValue="dark trap" />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).not.toBeDisabled()
  })
})

describe('StyleTextInput – disabled state', () => {
  it('disables textarea when disabled=true', () => {
    render(<StyleTextInput {...defaultProps} disabled={true} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('disables Validate button when disabled=true', () => {
    render(<StyleTextInput {...defaultProps} disabled={true} onValidate={jest.fn()} initialValue="dark trap" />)
    expect(screen.getByRole('button', { name: /Validate Style/i })).toBeDisabled()
  })
})
