/**
 * Tests for LoopCard component.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoopCard from '@/components/LoopCard'
import * as apiClient from '@/../../api/client'

// Mock the API client
jest.mock('@/../../api/client', () => ({
  fetchLoopPlayUrl: jest.fn(),
}))

const mockFetchLoopPlayUrl = apiClient.fetchLoopPlayUrl as jest.MockedFunction<
  typeof apiClient.fetchLoopPlayUrl
>

// Mock AudioManagerContext
const mockPlay = jest.fn()
const mockPause = jest.fn()

let mockCurrentLoopId: number | null = null
let mockIsPlaying = false
let mockProgress = 0

jest.mock('@/context/AudioManagerContext', () => ({
  useAudioManager: () => ({
    get currentLoopId() { return mockCurrentLoopId },
    get isPlaying() { return mockIsPlaying },
    get progress() { return mockProgress },
    duration: 0,
    play: mockPlay,
    pause: mockPause,
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockCurrentLoopId = null
  mockIsPlaying = false
  mockProgress = 0
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

const makeLoop = (overrides = {}) => ({
  id: 1,
  name: 'my-loop.mp3',
  title: null,
  bpm: 120,
  ...overrides,
})

describe('LoopCard – rendering', () => {
  it('renders loop name when title is null', () => {
    render(<LoopCard loop={makeLoop({ title: null, name: 'test-loop.mp3' })} />)
    expect(screen.getByText('test-loop.mp3')).toBeInTheDocument()
  })

  it('renders title when present', () => {
    render(<LoopCard loop={makeLoop({ title: 'My Awesome Loop', name: 'test-loop.mp3' })} />)
    expect(screen.getByText('My Awesome Loop')).toBeInTheDocument()
    expect(screen.queryByText('test-loop.mp3')).not.toBeInTheDocument()
  })

  it('shows BPM when present', () => {
    render(<LoopCard loop={makeLoop({ bpm: 140 })} />)
    expect(screen.getByText('140 BPM')).toBeInTheDocument()
  })

  it('shows "Loop Preview" when bpm is null', () => {
    render(<LoopCard loop={makeLoop({ bpm: null })} />)
    expect(screen.getByText('Loop Preview')).toBeInTheDocument()
  })

  it('renders Play button', () => {
    render(<LoopCard loop={makeLoop()} />)
    expect(screen.getByRole('button', { name: /Play/i })).toBeInTheDocument()
  })

  it('shows 0% progress when this loop is not active', () => {
    render(<LoopCard loop={makeLoop()} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

describe('LoopCard – play interaction', () => {
  it('fetches play URL and calls play when Play is clicked', async () => {
    mockFetchLoopPlayUrl.mockResolvedValue('https://cdn.example.com/loop.mp3')
    mockPlay.mockResolvedValue(undefined)
    render(<LoopCard loop={makeLoop({ id: 1 })} />)
    await userEvent.click(screen.getByRole('button', { name: /Play/i }))
    await waitFor(() => expect(mockFetchLoopPlayUrl).toHaveBeenCalledWith(1))
    await waitFor(() => expect(mockPlay).toHaveBeenCalledWith(1, 'https://cdn.example.com/loop.mp3'))
  })

  it('shows "Loading..." while fetching', async () => {
    let resolveFetch!: (url: string) => void
    mockFetchLoopPlayUrl.mockImplementation(
      () => new Promise<string>((r) => { resolveFetch = r })
    )
    render(<LoopCard loop={makeLoop()} />)
    fireEvent.click(screen.getByRole('button', { name: /Play/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument()
    )
    resolveFetch('https://cdn.example.com/loop.mp3')
  })

  it('disables button while loading', async () => {
    let resolveFetch!: (url: string) => void
    mockFetchLoopPlayUrl.mockImplementation(
      () => new Promise<string>((r) => { resolveFetch = r })
    )
    render(<LoopCard loop={makeLoop()} />)
    fireEvent.click(screen.getByRole('button', { name: /Play/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled())
    resolveFetch('https://cdn.example.com/loop.mp3')
  })

  it('shows error message when play fails', async () => {
    mockFetchLoopPlayUrl.mockRejectedValue(new Error('Unable to load audio'))
    render(<LoopCard loop={makeLoop()} />)
    await userEvent.click(screen.getByRole('button', { name: /Play/i }))
    await waitFor(() => screen.getByText(/Unable to load audio/i))
    expect(screen.getByText('Unable to load audio')).toBeInTheDocument()
  })

  it('shows generic error for non-Error exceptions', async () => {
    mockFetchLoopPlayUrl.mockRejectedValue('unknown error')
    render(<LoopCard loop={makeLoop()} />)
    await userEvent.click(screen.getByRole('button', { name: /Play/i }))
    await waitFor(() => screen.getByText(/Unable to play loop/i))
  })
})

describe('LoopCard – pause interaction', () => {
  it('calls pause when Pause is clicked for the active playing loop', async () => {
    mockCurrentLoopId = 1
    mockIsPlaying = true
    render(<LoopCard loop={makeLoop({ id: 1 })} />)
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Pause/i }))
    expect(mockPause).toHaveBeenCalledTimes(1)
    expect(mockFetchLoopPlayUrl).not.toHaveBeenCalled()
  })
})

describe('LoopCard – progress display', () => {
  it('shows progress percentage for active loop', () => {
    mockCurrentLoopId = 1
    mockIsPlaying = true
    mockProgress = 0.45
    render(<LoopCard loop={makeLoop({ id: 1 })} />)
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('shows 0% for inactive loop even if audio manager has progress', () => {
    mockCurrentLoopId = 2 // different loop
    mockIsPlaying = true
    mockProgress = 0.8
    render(<LoopCard loop={makeLoop({ id: 1 })} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
