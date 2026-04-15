/**
 * Tests for ArrangementStatus component.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import ArrangementStatus from '@/components/ArrangementStatus'
import type { ArrangementStatusResponse } from '@/../../api/client'

function makeStatus(overrides: Partial<ArrangementStatusResponse> = {}): ArrangementStatusResponse {
  return {
    id: 1,
    status: 'queued',
    ...overrides,
  }
}

describe('ArrangementStatus – status display', () => {
  it('shows queued status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'queued' })} />)
    expect(screen.getByText(/Queued -- waiting for a worker/i)).toBeInTheDocument()
  })

  it('shows pending status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'pending' })} />)
    expect(screen.getByText(/Preparing/i)).toBeInTheDocument()
  })

  it('shows processing status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'processing' })} />)
    expect(screen.getByText(/Rendering arrangement/i)).toBeInTheDocument()
  })

  it('shows done status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'done' })} />)
    expect(screen.getByText(/Arrangement ready/i)).toBeInTheDocument()
  })

  it('shows completed status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'completed' })} />)
    expect(screen.getByText(/Arrangement ready/i)).toBeInTheDocument()
  })

  it('shows failed status text', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'failed' })} />)
    expect(screen.getByText(/Generation failed/i)).toBeInTheDocument()
  })

  it('shows arrangement ID', () => {
    render(<ArrangementStatus arrangement={makeStatus({ id: 42 })} />)
    expect(screen.getByText(/Arrangement ID: 42/)).toBeInTheDocument()
  })

  it('shows status badge with uppercase status', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'queued' })} />)
    // The badge span with uppercase status
    const badges = screen.getAllByText(/queued/i)
    expect(badges.length).toBeGreaterThan(0)
  })
})

describe('ArrangementStatus – progress bar', () => {
  it('shows progress bar when processing with progress', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'processing', progress: 50 })} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('does not show progress bar when not processing', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'queued' })} />)
    expect(screen.queryByText('Progress')).not.toBeInTheDocument()
  })

  it('does not show progress bar when processing but no progress value', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'processing' })} />)
    expect(screen.queryByText('Progress')).not.toBeInTheDocument()
  })
})

describe('ArrangementStatus – error message', () => {
  it('shows error details when status is failed with error message', () => {
    render(<ArrangementStatus arrangement={makeStatus({
      status: 'failed',
      error_message: 'Out of memory',
    })} />)
    expect(screen.getByText('Out of memory')).toBeInTheDocument()
    expect(screen.getByText('Error Details:')).toBeInTheDocument()
  })

  it('does not show error section when no error_message', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'failed' })} />)
    expect(screen.queryByText('Error Details:')).not.toBeInTheDocument()
  })
})

describe('ArrangementStatus – output file info', () => {
  it('shows "File ready for download" when done with output_file', () => {
    render(<ArrangementStatus arrangement={makeStatus({
      status: 'done',
      output_file: 's3://bucket/arrangement.mp3',
    })} />)
    expect(screen.getByText(/File ready for download/i)).toBeInTheDocument()
  })

  it('shows file ready when status is completed', () => {
    render(<ArrangementStatus arrangement={makeStatus({
      status: 'completed',
      output_file: 's3://bucket/arrangement.mp3',
    })} />)
    expect(screen.getByText(/File ready for download/i)).toBeInTheDocument()
  })

  it('does not show file section when no output_file', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'done' })} />)
    expect(screen.queryByText(/File ready for download/i)).not.toBeInTheDocument()
  })
})

describe('ArrangementStatus – additional info messages', () => {
  it('shows processing update message', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'processing' })} />)
    expect(screen.getByText(/Status updates every 3 seconds/i)).toBeInTheDocument()
  })

  it('shows pending preparation message', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'pending' })} />)
    expect(screen.getByText(/being prepared for processing/i)).toBeInTheDocument()
  })

  it('shows queued wait message', () => {
    render(<ArrangementStatus arrangement={makeStatus({ status: 'queued' })} />)
    expect(screen.getByText(/queued and will start shortly/i)).toBeInTheDocument()
  })
})
