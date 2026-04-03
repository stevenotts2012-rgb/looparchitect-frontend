/**
 * Regression tests for DawExportButton.
 *
 * Root cause being guarded:
 *  - The original DAW export was an inline button that used alert() for errors,
 *    had no loading/disabled state, and would fire duplicate requests on rapid
 *    clicks.  These tests lock down the new component's correct state machine.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DawExportButton from '@/components/DawExportButton'
import * as apiClient from '@/../../api/client'

jest.mock('@/../../api/client', () => ({
  ...jest.requireActual('@/../../api/client'),
  getDawExportInfo: jest.fn(),
  downloadDawExport: jest.fn(),
}))

const mockGetDawExportInfo = apiClient.getDawExportInfo as jest.MockedFunction<
  typeof apiClient.getDawExportInfo
>
const mockDownloadDawExport = apiClient.downloadDawExport as jest.MockedFunction<
  typeof apiClient.downloadDawExport
>

// Minimal URL/anchor mocks so blob-URL download path doesn't throw in jsdom
const mockCreateObjectURL = jest.fn(() => 'blob:http://localhost/mock-zip')
const mockRevokeObjectURL = jest.fn()

beforeAll(() => {
  Object.defineProperty(window, 'URL', {
    value: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
    writable: true,
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  // Default: export is ready
  mockGetDawExportInfo.mockResolvedValue({
    arrangement_id: 1,
    ready_for_export: true,
    download_url: 'https://example.com/export.zip',
  })
  mockDownloadDawExport.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }))
})

describe('DawExportButton', () => {
  it('renders with idle label', () => {
    render(<DawExportButton arrangementId={1} />)
    expect(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i })).toBeInTheDocument()
  })

  it('shows "Checking export…" while querying export info', async () => {
    let resolveInfo!: (v: unknown) => void
    mockGetDawExportInfo.mockImplementation(() => new Promise((r) => { resolveInfo = r }))

    render(<DawExportButton arrangementId={1} />)
    const btn = screen.getByRole('button', { name: /DAW Export \(ZIP\)/i })

    // Don't await – let it stay pending
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Checking export/i })).toBeInTheDocument()
    })

    // Button should be disabled during check
    expect(screen.getByRole('button', { name: /Checking export/i })).toBeDisabled()

    resolveInfo({ arrangement_id: 1, ready_for_export: true })
  })

  it('shows "Downloading ZIP…" while the blob is being fetched', async () => {
    let resolveDownload!: (v: Blob) => void
    mockDownloadDawExport.mockImplementation(
      () => new Promise((r) => { resolveDownload = r })
    )

    render(<DawExportButton arrangementId={1} />)
    fireEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Downloading ZIP/i })).toBeInTheDocument()
    })

    resolveDownload(new Blob(['zip'], { type: 'application/zip' }))
  })

  it('shows "Downloaded!" after a successful export', async () => {
    render(<DawExportButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    })
  })

  it('disables the button during download to prevent duplicate requests', async () => {
    let resolveDownload!: (v: Blob) => void
    mockDownloadDawExport.mockImplementation(
      () => new Promise((r) => { resolveDownload = r })
    )

    render(<DawExportButton arrangementId={1} />)
    const btn = screen.getByRole('button', { name: /DAW Export \(ZIP\)/i })

    fireEvent.click(btn)

    await waitFor(() => {
      expect(btn).toBeDisabled()
    })

    resolveDownload(new Blob(['zip'], { type: 'application/zip' }))
  })

  it('shows an error message when export is not ready', async () => {
    mockGetDawExportInfo.mockResolvedValue({
      arrangement_id: 1,
      ready_for_export: false,
      message: 'Export is still being prepared.',
    })

    render(<DawExportButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Export is still being prepared.')
    })

    // Button label should reflect failure state
    expect(screen.getByRole('button', { name: /Export Failed/i })).toBeInTheDocument()
  })

  it('shows an error message when the download API call fails', async () => {
    const { LoopArchitectApiError: RealError } =
      jest.requireActual<typeof apiClient>('@/../../api/client')
    mockDownloadDawExport.mockRejectedValue(new RealError('Server error', 500))

    render(<DawExportButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error')
    })
  })

  it('shows a generic error message for non-API errors', async () => {
    mockDownloadDawExport.mockRejectedValue(new Error('Network failure'))

    render(<DawExportButton arrangementId={1} />)
    await userEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Failed to download DAW export/i)
    })
  })

  it('does not fire a second request when clicked while already active', async () => {
    let resolveInfo!: (v: unknown) => void
    mockGetDawExportInfo.mockImplementation(() => new Promise((r) => { resolveInfo = r }))

    render(<DawExportButton arrangementId={1} />)
    const btn = screen.getByRole('button', { name: /DAW Export \(ZIP\)/i })

    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())

    // Second click while disabled – no additional API call
    fireEvent.click(btn)
    expect(mockGetDawExportInfo).toHaveBeenCalledTimes(1)

    resolveInfo({ arrangement_id: 1, ready_for_export: true })
  })

  it('uses the correct arrangement ID in the download filename', async () => {
    // Spy on document.createElement to capture anchor download attribute
    const originalCreateElement = document.createElement.bind(document)
    const createdAnchors: HTMLAnchorElement[] = []
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName)
      if (tagName === 'a') createdAnchors.push(el as HTMLAnchorElement)
      return el
    })

    render(<DawExportButton arrangementId={42} />)
    await userEvent.click(screen.getByRole('button', { name: /DAW Export \(ZIP\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Downloaded!/i })).toBeInTheDocument()
    })

    const anchor = createdAnchors[0]
    expect(anchor?.download).toBe('arrangement_42_daw_export.zip')

    jest.restoreAllMocks()
  })
})
