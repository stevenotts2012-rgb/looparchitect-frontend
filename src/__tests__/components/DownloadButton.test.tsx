/**
 * Regression tests for DownloadButton.
 *
 * Root causes guarded:
 *  - The original component had no timeout on the blob fetch, so a slow or
 *    hanging server request left the spinner running forever.
 *  - There was no direct-URL fast-path: even when the backend returned a
 *    pre-signed URL in the arrangement status, the component always streamed
 *    the blob through the Next.js proxy, doubling the chance of a stall.
 *  - isDownloading was never reset through a finally block that could be
 *    bypassed (it was in finally, but a never-resolving promise meant finally
 *    never ran).
 *  These tests lock down the corrected state machine.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DownloadButton from '@/components/DownloadButton'
import * as apiClient from '@/../../api/client'

jest.mock('@/../../api/client', () => ({
  ...jest.requireActual('@/../../api/client'),
  downloadArrangement: jest.fn(),
}))

const mockDownloadArrangement = apiClient.downloadArrangement as jest.MockedFunction<
  typeof apiClient.downloadArrangement
>

const mockCreateObjectURL = jest.fn(() => 'blob:http://localhost/mock-arrangement')
const mockRevokeObjectURL = jest.fn()

beforeAll(() => {
  Object.defineProperty(window, 'URL', {
    value: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
    writable: true,
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  mockDownloadArrangement.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
})

// ---------------------------------------------------------------------------
// Idle state
// ---------------------------------------------------------------------------

describe('DownloadButton – idle state', () => {
  it('renders with idle label', () => {
    render(<DownloadButton arrangementId={1} />)
    expect(screen.getByRole('button', { name: /Download Arrangement/i })).toBeInTheDocument()
  })

  it('is enabled by default', () => {
    render(<DownloadButton arrangementId={1} />)
    expect(screen.getByRole('button', { name: /Download Arrangement/i })).not.toBeDisabled()
  })

  it('is disabled when the disabled prop is true', () => {
    render(<DownloadButton arrangementId={1} disabled />)
    expect(screen.getByRole('button', { name: /Download Arrangement/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Direct-URL fast path
// ---------------------------------------------------------------------------

describe('DownloadButton – direct URL path', () => {
  it('does NOT call downloadArrangement when downloadUrl is provided', async () => {
    render(
      <DownloadButton arrangementId={5} downloadUrl="https://cdn.example.com/arrangement_5.mp3" />
    )
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    )
    expect(mockDownloadArrangement).not.toHaveBeenCalled()
  })

  it('creates an anchor with the correct href and download attribute', async () => {
    const createdAnchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') createdAnchors.push(el as HTMLAnchorElement)
      return el
    })

    render(
      <DownloadButton arrangementId={5} downloadUrl="https://cdn.example.com/arrangement_5.mp3" />
    )
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    )

    expect(createdAnchors[0]?.href).toBe('https://cdn.example.com/arrangement_5.mp3')
    expect(createdAnchors[0]?.download).toBe('arrangement_5.mp3')

    jest.restoreAllMocks()
  })

  it('shows "Downloaded!" after a successful direct-URL download', async () => {
    render(
      <DownloadButton arrangementId={5} downloadUrl="https://cdn.example.com/arrangement_5.mp3" />
    )
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    )
  })
})

// ---------------------------------------------------------------------------
// Blob fetch path
// ---------------------------------------------------------------------------

describe('DownloadButton – blob fetch path', () => {
  it('calls downloadArrangement with the correct ID when no downloadUrl is given', async () => {
    render(<DownloadButton arrangementId={7} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() => expect(mockDownloadArrangement).toHaveBeenCalledWith(7))
  })

  it('shows "Downloaded!" after a successful blob download', async () => {
    render(<DownloadButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    )
  })

  it('creates a blob URL, sets the correct download filename, and revokes the URL', async () => {
    const createdAnchors: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') createdAnchors.push(el as HTMLAnchorElement)
      return el
    })

    render(<DownloadButton arrangementId={3} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() => expect(mockCreateObjectURL).toHaveBeenCalledTimes(1))

    expect(createdAnchors[0]?.download).toBe('arrangement_3.mp3')
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1)

    jest.restoreAllMocks()
  })

  it('shows the spinner ("Downloading…") while the blob is being fetched', async () => {
    let resolveDownload!: (b: Blob) => void
    mockDownloadArrangement.mockImplementation(
      () => new Promise((r) => { resolveDownload = r })
    )

    render(<DownloadButton arrangementId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Downloading/i })).toBeInTheDocument()
    )

    resolveDownload(new Blob(['audio'], { type: 'audio/mpeg' }))
  })
})

// ---------------------------------------------------------------------------
// Error handling – spinner must always clear
// ---------------------------------------------------------------------------

describe('DownloadButton – error handling', () => {
  it('clears the spinner and shows an error when the API request fails', async () => {
    const { LoopArchitectApiError: RealError } =
      jest.requireActual<typeof apiClient>('@/../../api/client')
    mockDownloadArrangement.mockRejectedValue(new RealError('Server error', 500))

    render(<DownloadButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'))

    // Spinner must be gone; button shows retry label
    expect(screen.queryByText(/Downloading/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Download Failed/i })).toBeInTheDocument()
  })

  it('shows a generic error message for non-API errors', async () => {
    mockDownloadArrangement.mockRejectedValue(new Error('Network failure'))

    render(<DownloadButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to download arrangement/i)
    )
  })

  it('shows an actionable timeout error and clears the spinner', async () => {
    const { LoopArchitectApiError: RealError } =
      jest.requireActual<typeof apiClient>('@/../../api/client')
    mockDownloadArrangement.mockRejectedValue(
      new RealError('Download timed out after 30 seconds. Please try again.', 408)
    )

    render(<DownloadButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /Download Arrangement/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/timed out/i)
    )

    // Button must not be spinning
    expect(screen.getByRole('button', { name: /Download Failed/i })).toBeInTheDocument()
    expect(screen.queryByText(/Downloading/i)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Race-condition prevention – no double-click requests
// ---------------------------------------------------------------------------

describe('DownloadButton – race condition prevention', () => {
  it('disables the button while the blob fetch is in progress', async () => {
    let resolveDownload!: (b: Blob) => void
    mockDownloadArrangement.mockImplementation(
      () => new Promise((r) => { resolveDownload = r })
    )

    render(<DownloadButton arrangementId={1} />)
    const btn = screen.getByRole('button', { name: /Download Arrangement/i })

    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())

    resolveDownload(new Blob(['audio'], { type: 'audio/mpeg' }))
  })

  it('does not fire a second request when clicked while already active', async () => {
    let resolveDownload!: (b: Blob) => void
    mockDownloadArrangement.mockImplementation(
      () => new Promise((r) => { resolveDownload = r })
    )

    render(<DownloadButton arrangementId={1} />)
    const btn = screen.getByRole('button', { name: /Download Arrangement/i })

    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())

    // Second click while disabled – should not fire another request
    fireEvent.click(btn)
    expect(mockDownloadArrangement).toHaveBeenCalledTimes(1)

    resolveDownload(new Blob(['audio'], { type: 'audio/mpeg' }))
  })
})
