/**
 * Tests for GenerationHistory component.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GenerationHistory from '@/components/GenerationHistory'
import type { Arrangement } from '@/../../api/client'

function makeArrangement(overrides: Partial<Arrangement> = {}): Arrangement {
  return {
    id: 1,
    loop_id: 5,
    status: 'done',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:01:00Z',
    target_seconds: 60,
    ...overrides,
  }
}

const defaultProps = {
  rows: [],
  loading: false,
  error: null,
  activeArrangementId: null,
  onRefresh: jest.fn(),
  onTrack: jest.fn(),
  onDownload: jest.fn(),
  onRetry: jest.fn(),
  onFilterChange: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GenerationHistory – empty state', () => {
  it('shows empty state message when no rows', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.getByText(/No arrangements yet/i)).toBeInTheDocument()
  })

  it('shows the "Recent Generations" heading', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.getByText('Recent Generations')).toBeInTheDocument()
  })
})

describe('GenerationHistory – refresh', () => {
  it('renders Refresh button', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })

  it('shows "Refreshing..." when loading', () => {
    render(<GenerationHistory {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: /Refreshing/i })).toBeInTheDocument()
  })

  it('calls onRefresh when Refresh button is clicked', async () => {
    render(<GenerationHistory {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1)
  })

  it('disables Refresh button when loading', () => {
    render(<GenerationHistory {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: /Refreshing/i })).toBeDisabled()
  })
})

describe('GenerationHistory – error display', () => {
  it('shows error message when error is provided', () => {
    render(<GenerationHistory {...defaultProps} error="Failed to load arrangements" />)
    expect(screen.getByText('Failed to load arrangements')).toBeInTheDocument()
  })

  it('does not show error section when error is null', () => {
    render(<GenerationHistory {...defaultProps} error={null} />)
    expect(screen.queryByText('Failed to load arrangements')).not.toBeInTheDocument()
  })
})

describe('GenerationHistory – rows display', () => {
  const rows = [
    makeArrangement({ id: 1, loop_id: 5, status: 'done' }),
    makeArrangement({ id: 2, loop_id: 6, status: 'processing' }),
    makeArrangement({ id: 3, loop_id: 7, status: 'failed', error_message: 'Timeout error' }),
  ]

  it('renders all rows', () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    expect(screen.getByText('Arrangement #1 • Loop #5')).toBeInTheDocument()
    expect(screen.getByText('Arrangement #2 • Loop #6')).toBeInTheDocument()
    expect(screen.getByText('Arrangement #3 • Loop #7')).toBeInTheDocument()
  })

  it('shows target_seconds when present', () => {
    render(<GenerationHistory {...defaultProps} rows={[makeArrangement({ target_seconds: 90 })]} />)
    expect(screen.getByText(/Target: 90s/i)).toBeInTheDocument()
  })

  it('shows error message for failed rows', () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    expect(screen.getByText(/Timeout error/)).toBeInTheDocument()
  })

  it('renders Download button for done rows', () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    expect(screen.getByRole('button', { name: /Download/i })).toBeInTheDocument()
  })

  it('renders Retry button for failed rows with target_seconds', () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })

  it('does not render Retry for failed rows without target_seconds', () => {
    const failedNoSeconds = [makeArrangement({ status: 'failed', target_seconds: undefined })]
    render(<GenerationHistory {...defaultProps} rows={failedNoSeconds} />)
    expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument()
  })

  it('renders Track button for all rows', () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    const trackButtons = screen.getAllByRole('button', { name: /Track/i })
    expect(trackButtons).toHaveLength(3)
  })

  it('highlights active arrangement row', () => {
    const { container } = render(<GenerationHistory {...defaultProps} rows={rows} activeArrangementId={1} />)
    // Active row should have border-blue-600 class
    expect(container.querySelector('.border-blue-600')).not.toBeNull()
  })
})

describe('GenerationHistory – row interactions', () => {
  const rows = [
    makeArrangement({ id: 10, loop_id: 5, status: 'done' }),
    makeArrangement({ id: 11, loop_id: 5, status: 'failed', target_seconds: 60 }),
  ]

  it('calls onTrack with row id when Track is clicked', async () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    const trackButtons = screen.getAllByRole('button', { name: /Track/i })
    await userEvent.click(trackButtons[0])
    expect(defaultProps.onTrack).toHaveBeenCalledWith(10)
  })

  it('calls onDownload with row id when Download is clicked', async () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    await userEvent.click(screen.getByRole('button', { name: /Download/i }))
    expect(defaultProps.onDownload).toHaveBeenCalledWith(10)
  })

  it('calls onRetry with loop_id and target_seconds when Retry is clicked', async () => {
    render(<GenerationHistory {...defaultProps} rows={rows} />)
    await userEvent.click(screen.getByRole('button', { name: /Retry/i }))
    expect(defaultProps.onRetry).toHaveBeenCalledWith(5, 60)
  })
})

describe('GenerationHistory – filters', () => {
  it('renders status filter select', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument()
  })

  it('renders loop ID filter input', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.getByLabelText(/Loop ID/i)).toBeInTheDocument()
  })

  it('calls onFilterChange when status filter changes', async () => {
    render(<GenerationHistory {...defaultProps} />)
    const select = screen.getByLabelText(/Status/i)
    await userEvent.selectOptions(select, 'done')
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('done', '')
  })

  it('calls onFilterChange when loop ID filter changes', async () => {
    render(<GenerationHistory {...defaultProps} />)
    const input = screen.getByLabelText(/Loop ID/i)
    await userEvent.type(input, '5')
    expect(defaultProps.onFilterChange).toHaveBeenCalled()
  })

  it('shows Clear Filters button when filters are active', async () => {
    render(<GenerationHistory {...defaultProps} />)
    const select = screen.getByLabelText(/Status/i)
    await userEvent.selectOptions(select, 'done')
    expect(screen.getByRole('button', { name: /Clear Filters/i })).toBeInTheDocument()
  })

  it('does not show Clear Filters when no filters active', () => {
    render(<GenerationHistory {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /Clear Filters/i })).not.toBeInTheDocument()
  })

  it('clears filters and calls onFilterChange with defaults when Clear is clicked', async () => {
    render(<GenerationHistory {...defaultProps} />)
    await userEvent.selectOptions(screen.getByLabelText(/Status/i), 'done')
    await userEvent.click(screen.getByRole('button', { name: /Clear Filters/i }))
    expect(defaultProps.onFilterChange).toHaveBeenLastCalledWith('all', '')
  })
})

describe('GenerationHistory – date formatting', () => {
  it('renders created_at date', () => {
    render(<GenerationHistory {...defaultProps} rows={[makeArrangement()]} />)
    expect(screen.getByText(/Created:/)).toBeInTheDocument()
  })
})
