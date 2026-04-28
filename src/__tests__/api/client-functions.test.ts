/**
 * Tests for api/client.ts – all major API functions.
 *
 * The jsdom test environment provides `window`, so:
 *  - `getApiBasePath()` → '/api' (relative proxy path)
 *  - `getUploadUrl()` → direct Railway backend origin
 */

import {
  renderLoopAsync,
  getJobStatus,
  getArrangementStatus,
  listArrangements,
  saveArrangement,
  listStylePresets,
  getArrangementMetadata,
  getArrangementPlan,
  validateStyle,
  getDawExportInfo,
  downloadDawExport,
  getLoop,
  downloadLoop,
  validateLoopSource,
  fetchLoopPlayUrl,
  retryPreviewRender,
  analyzeReferenceTrack,
  LoopArchitectApiError,
} from '@/../../api/client'

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function makeFetchMock(responseBody: unknown, status = 200): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(responseBody)], { type: 'audio/mpeg' })),
  })
}

function makeErrorFetchMock(status: number, body: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    blob: () => Promise.resolve(new Blob()),
  })
}

beforeEach(() => {
  jest.spyOn(console, 'debug').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ===========================================================================
// renderLoopAsync
// ===========================================================================

describe('renderLoopAsync', () => {
  const mockRenderResponse = {
    job_id: 'job-abc-123',
    loop_id: 1,
    status: 'queued',
    message: 'Render job enqueued',
  }

  it('posts to /api/v1/loops/:loop_id/render-async', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(1, { targetSeconds: 60 })
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/loops/1/render-async')
  })

  it('sends target_seconds in the request body', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(5, { targetSeconds: 120 })
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.target_seconds).toBe(120)
  })

  it('calculates target_seconds from bars and bpm', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(1, { bars: 32, loopBpm: 120 })
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    // 32 bars * 4 beats/bar * 60s / 120 bpm = 64s
    expect(body.target_seconds).toBe(64)
  })

  it('uses default 180s when no duration is provided', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(1)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.target_seconds).toBe(180)
  })

  it('includes optional fields when provided', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(1, {
      targetSeconds: 60,
      genre: 'trap',
      stylePreset: 'dark',
      seed: 42,
      producerMoves: ['hook_drop'],
      includeStems: true,
      variationCount: 2,
    })
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.genre).toBe('trap')
    expect(body.style_preset).toBe('dark')
    expect(body.seed).toBe(42)
    expect(body.producer_moves).toEqual(['hook_drop'])
    expect(body.include_stems).toBe(true)
    expect(body.variation_count).toBe(2)
  })

  it('sends reference analysis fields when provided', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    await renderLoopAsync(1, {
      targetSeconds: 60,
      referenceAnalysisId: 'ref-123',
      adaptationStrength: 'close',
      guidanceMode: 'structure_energy',
    })
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.reference_analysis_id).toBe('ref-123')
    expect(body.adaptation_strength).toBe('close')
    expect(body.guidance_mode).toBe('structure_energy')
  })

  it('returns the job_id from the response', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    const result = await renderLoopAsync(1, { targetSeconds: 60 })
    expect(result.job_id).toBe('job-abc-123')
    expect(result.loop_id).toBe(1)
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(500, { message: 'Internal server error' })
    await expect(renderLoopAsync(1, { targetSeconds: 60 })).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors in LoopArchitectApiError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failure'))
    await expect(renderLoopAsync(1)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('enforces minimum 10s when bars calculation underflows', async () => {
    global.fetch = makeFetchMock(mockRenderResponse)
    // 1 bar * 4 * 60 / 240 bpm = 1s, which is below the minimum of 10
    await renderLoopAsync(1, { bars: 1, loopBpm: 240 })
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.target_seconds).toBeGreaterThanOrEqual(10)
  })
})

// ===========================================================================
// getJobStatus
// ===========================================================================

describe('getJobStatus', () => {
  const mockJobQueued = {
    job_id: 'job-abc-123',
    status: 'queued',
  }

  const mockJobFinished = {
    job_id: 'job-abc-123',
    status: 'finished',
    arrangement_id: 99,
    audio_url: 'https://cdn.example.com/audio.wav',
    structure_preview: [{ name: 'Intro', bars: 8, energy: 0.3 }],
  }

  it('fetches /api/v1/jobs/:job_id', async () => {
    global.fetch = makeFetchMock(mockJobQueued)
    await getJobStatus('job-abc-123')
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/jobs/job-abc-123')
  })

  it('uses GET method', async () => {
    global.fetch = makeFetchMock(mockJobQueued)
    await getJobStatus('job-abc-123')
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    expect(init.method).toBe('GET')
  })

  it('sends cache-busting headers', async () => {
    global.fetch = makeFetchMock(mockJobQueued)
    await getJobStatus('job-abc-123')
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    expect((init.headers as Record<string, string>)['Cache-Control']).toMatch(/no-cache/)
  })

  it('returns queued status', async () => {
    global.fetch = makeFetchMock(mockJobQueued)
    const result = await getJobStatus('job-abc-123')
    expect(result.job_id).toBe('job-abc-123')
    expect(result.status).toBe('queued')
  })

  it('returns finished status with arrangement_id and audio_url', async () => {
    global.fetch = makeFetchMock(mockJobFinished)
    const result = await getJobStatus('job-abc-123')
    expect(result.status).toBe('finished')
    expect(result.arrangement_id).toBe(99)
    expect(result.audio_url).toBe('https://cdn.example.com/audio.wav')
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(500, { message: 'Internal server error' })
    await expect(getJobStatus('job-abc-123')).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors in LoopArchitectApiError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failure'))
    await expect(getJobStatus('job-abc-123')).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// saveArrangement
// ===========================================================================

describe('saveArrangement', () => {
  const mockArrangement = {
    id: 10,
    loop_id: 1,
    status: 'done',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:01:00Z',
  }

  it('posts to /api/v1/arrangements/:id/save', async () => {
    global.fetch = makeFetchMock(mockArrangement)
    await saveArrangement(10)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/10/save')
  })

  it('uses POST method', async () => {
    global.fetch = makeFetchMock(mockArrangement)
    await saveArrangement(10)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    expect(init.method).toBe('POST')
  })

  it('returns the saved arrangement', async () => {
    global.fetch = makeFetchMock(mockArrangement)
    const result = await saveArrangement(10)
    expect(result.id).toBe(10)
  })

  it('throws LoopArchitectApiError on failure', async () => {
    global.fetch = makeErrorFetchMock(403, { message: 'Forbidden' })
    await expect(saveArrangement(10)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(saveArrangement(10)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// listStylePresets
// ===========================================================================

describe('listStylePresets', () => {
  const mockPresets = [
    { id: 'dark_trap', display_name: 'Dark Trap', description: 'Heavy 808s', defaults: {} },
    { id: 'pop', display_name: 'Pop', description: 'Catchy', defaults: {} },
  ]

  it('fetches /api/v1/styles', async () => {
    global.fetch = makeFetchMock({ styles: mockPresets })
    await listStylePresets()
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/styles')
  })

  it('returns the styles array', async () => {
    global.fetch = makeFetchMock({ styles: mockPresets })
    const result = await listStylePresets()
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('dark_trap')
  })

  it('returns empty array when styles field is absent', async () => {
    global.fetch = makeFetchMock({})
    const result = await listStylePresets()
    expect(result).toEqual([])
  })

  it('throws LoopArchitectApiError on failure', async () => {
    global.fetch = makeErrorFetchMock(500, { message: 'Server error' })
    await expect(listStylePresets()).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// getArrangementStatus
// ===========================================================================

describe('getArrangementStatus', () => {
  const mockStatus = {
    id: 5,
    status: 'done',
    output_url: 'https://cdn.example.com/arrangement.mp3',
  }

  it('fetches /api/v1/arrangements/:id', async () => {
    global.fetch = makeFetchMock(mockStatus)
    await getArrangementStatus(5)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/5')
    expect(url).not.toContain('metadata')
  })

  it('sends cache-busting headers', async () => {
    global.fetch = makeFetchMock(mockStatus)
    await getArrangementStatus(5)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const headers = init.headers as Record<string, string>
    expect(headers['Cache-Control']).toContain('no-cache')
  })

  it('returns the status response', async () => {
    global.fetch = makeFetchMock(mockStatus)
    const result = await getArrangementStatus(5)
    expect(result.id).toBe(5)
    expect(result.status).toBe('done')
  })

  it('throws LoopArchitectApiError on 404', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Not found' })
    await expect(getArrangementStatus(99)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    await expect(getArrangementStatus(1)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// getArrangementMetadata
// ===========================================================================

describe('getArrangementMetadata', () => {
  const mockMeta = {
    arrangement_id: 7,
    producer_debug_report: [{ section_type: 'intro', active_stem_roles: ['kick'] }],
  }

  it('fetches /api/v1/arrangements/:id/metadata', async () => {
    global.fetch = makeFetchMock(mockMeta)
    await getArrangementMetadata(7)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/7/metadata')
  })

  it('returns the metadata response', async () => {
    global.fetch = makeFetchMock(mockMeta)
    const result = await getArrangementMetadata(7)
    expect(result.arrangement_id).toBe(7)
    expect(result.producer_debug_report).toHaveLength(1)
  })

  it('throws LoopArchitectApiError on failure', async () => {
    global.fetch = makeErrorFetchMock(500, { message: 'Server error' })
    await expect(getArrangementMetadata(7)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps non-API errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Fetch failed'))
    await expect(getArrangementMetadata(7)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// getArrangementPlan
// ===========================================================================

describe('getArrangementPlan', () => {
  const mockPlan = {
    plan: {
      structure: ['intro', 'verse', 'hook'],
      total_bars: 96,
      sections: [],
      planner_notes: { strategy: 'sparse intro', fallback_used: false },
    },
    validation: { valid: true, errors: [], warnings: [] },
    planner_meta: { model: 'gpt-4', latency_ms: 250, tokens: null, fallback_used: false },
  }

  const payload = {
    input: {
      detected_roles: ['kick', 'bass'],
      source_type: 'loop' as const,
    },
  }

  it('posts to /api/v1/arrangements/plan', async () => {
    global.fetch = makeFetchMock(mockPlan)
    await getArrangementPlan(payload)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/plan')
  })

  it('returns plan response', async () => {
    global.fetch = makeFetchMock(mockPlan)
    const result = await getArrangementPlan(payload)
    expect(result.plan.structure).toContain('hook')
    expect(result.validation.valid).toBe(true)
  })

  it('throws LoopArchitectApiError on failure', async () => {
    global.fetch = makeErrorFetchMock(422, { detail: 'Invalid input' })
    await expect(getArrangementPlan(payload)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// validateStyle
// ===========================================================================

describe('validateStyle', () => {
  const mockValidationResponse = {
    valid: true,
    normalized_profile: { intent: 'dark trap', energy: 0.8 },
    warnings: [],
    message: 'Valid',
  }

  const profile = { intent: 'dark trap', energy: 0.8 }

  it('posts to /api/v1/styles/validate', async () => {
    global.fetch = makeFetchMock(mockValidationResponse)
    await validateStyle(profile)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/styles/validate')
  })

  it('sends profile in request body', async () => {
    global.fetch = makeFetchMock(mockValidationResponse)
    await validateStyle(profile)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const body = JSON.parse(init.body as string)
    expect(body.profile.intent).toBe('dark trap')
  })

  it('returns validation result', async () => {
    global.fetch = makeFetchMock(mockValidationResponse)
    const result = await validateStyle(profile)
    expect(result.valid).toBe(true)
    expect(result.message).toBe('Valid')
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(422, { detail: 'Validation error' })
    await expect(validateStyle(profile)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// listArrangements
// ===========================================================================

describe('listArrangements', () => {
  const mockArrangements = [
    { id: 1, loop_id: 5, status: 'done', created_at: '2024-01-01', updated_at: '2024-01-01' },
    { id: 2, loop_id: 5, status: 'processing', created_at: '2024-01-02', updated_at: '2024-01-02' },
    { id: 3, loop_id: 6, status: 'failed', created_at: '2024-01-03', updated_at: '2024-01-03' },
  ]

  it('fetches /api/v1/arrangements', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    await listArrangements()
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements')
  })

  it('appends loop_id query param when provided', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    await listArrangements({ loopId: 5 })
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('loop_id=5')
  })

  it('does not append loop_id when not provided', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    await listArrangements()
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).not.toContain('loop_id')
  })

  it('filters by status client-side', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    const result = await listArrangements({ status: 'done' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('does not filter when status is "all"', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    const result = await listArrangements({ status: 'all' })
    expect(result).toHaveLength(3)
  })

  it('limits results when limit is provided', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    const result = await listArrangements({ limit: 2 })
    expect(result).toHaveLength(2)
  })

  it('returns all results when limit is 0', async () => {
    global.fetch = makeFetchMock(mockArrangements)
    const result = await listArrangements({ limit: 0 })
    expect(result).toHaveLength(3)
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(500, { message: 'Server error' })
    await expect(listArrangements()).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// getDawExportInfo
// ===========================================================================

describe('getDawExportInfo', () => {
  const mockExport = {
    arrangement_id: 3,
    ready_for_export: true,
    download_url: 'https://cdn.example.com/export.zip',
  }

  it('fetches /api/v1/arrangements/:id/daw-export', async () => {
    global.fetch = makeFetchMock(mockExport)
    await getDawExportInfo(3)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/3/daw-export')
  })

  it('returns export info', async () => {
    global.fetch = makeFetchMock(mockExport)
    const result = await getDawExportInfo(3)
    expect(result.ready_for_export).toBe(true)
    expect(result.arrangement_id).toBe(3)
  })

  it('throws on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Not found' })
    await expect(getDawExportInfo(99)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    await expect(getDawExportInfo(3)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// downloadDawExport
// ===========================================================================

describe('downloadDawExport', () => {
  it('fetches /api/v1/arrangements/:id/daw-export/download', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/zip' },
      blob: () => Promise.resolve(new Blob(['zip'], { type: 'application/zip' })),
    })
    await downloadDawExport(4)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/4/daw-export/download')
  })

  it('returns a blob on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/zip' },
      blob: () => Promise.resolve(new Blob(['zip'], { type: 'application/zip' })),
    })
    const result = await downloadDawExport(4)
    expect(result).toBeInstanceOf(Blob)
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('Access denied'),
    })
    await expect(downloadDawExport(4)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
    await expect(downloadDawExport(4)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// getLoop
// ===========================================================================

describe('getLoop', () => {
  const mockLoop = {
    id: 8,
    name: 'my-loop.mp3',
    bpm: 140,
    bars: 8,
    created_at: '2024-01-01T00:00:00Z',
  }

  it('fetches /api/v1/loops/:id', async () => {
    global.fetch = makeFetchMock(mockLoop)
    await getLoop(8)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/loops/8')
    expect(url).not.toContain('download')
  })

  it('returns the loop details', async () => {
    global.fetch = makeFetchMock(mockLoop)
    const result = await getLoop(8)
    expect(result.id).toBe(8)
    expect(result.bpm).toBe(140)
  })

  it('throws on 404', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Loop not found' })
    await expect(getLoop(999)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getLoop(8)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// downloadLoop
// ===========================================================================

describe('downloadLoop', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'URL', {
      value: {
        createObjectURL: jest.fn(() => 'blob:http://localhost/loop-audio'),
        revokeObjectURL: jest.fn(),
      },
      writable: true,
    })
  })

  it('fetches /api/v1/loops/:id/download', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'audio/mpeg' },
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })
    await downloadLoop(3)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/loops/3/download')
  })

  it('returns a blob URL', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'audio/mpeg' },
      blob: () => Promise.resolve(new Blob(['audio'], { type: 'audio/mpeg' })),
    })
    const result = await downloadLoop(3)
    expect(result).toBe('blob:http://localhost/loop-audio')
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: () => 'application/json' },
      blob: () => Promise.resolve(new Blob()),
    })
    await expect(downloadLoop(999)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(downloadLoop(3)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// validateLoopSource
// ===========================================================================

describe('validateLoopSource', () => {
  it('fetches /api/v1/loops/:id/play', async () => {
    global.fetch = makeFetchMock({ url: 'https://cdn.example.com/loop.mp3' })
    await validateLoopSource(6)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/loops/6/play')
  })

  it('resolves without error on success', async () => {
    global.fetch = makeFetchMock({ url: 'https://cdn.example.com/loop.mp3' })
    await expect(validateLoopSource(6)).resolves.toBeUndefined()
  })

  it('throws LoopArchitectApiError on 404', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Loop not found' })
    await expect(validateLoopSource(999)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('uses error detail field from JSON response', async () => {
    global.fetch = makeErrorFetchMock(422, { detail: 'Source file unavailable' })
    const err = await validateLoopSource(6).catch((e: unknown) => e)
    expect((err as LoopArchitectApiError).message).toContain('Source file unavailable')
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failure'))
    await expect(validateLoopSource(6)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// fetchLoopPlayUrl
// ===========================================================================

describe('fetchLoopPlayUrl', () => {
  it('fetches /api/v1/loops/:id/play', async () => {
    global.fetch = makeFetchMock({ url: 'https://cdn.example.com/play.mp3' })
    await fetchLoopPlayUrl(11)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/loops/11/play')
  })

  it('returns the URL from the response', async () => {
    global.fetch = makeFetchMock({ url: 'https://cdn.example.com/play.mp3' })
    const result = await fetchLoopPlayUrl(11)
    expect(result).toBe('https://cdn.example.com/play.mp3')
  })

  it('throws LoopArchitectApiError when URL is absent in response', async () => {
    global.fetch = makeFetchMock({ url: null })
    await expect(fetchLoopPlayUrl(11)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('throws LoopArchitectApiError when url is not a string', async () => {
    global.fetch = makeFetchMock({ url: 12345 })
    await expect(fetchLoopPlayUrl(11)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Not found' })
    await expect(fetchLoopPlayUrl(999)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('preserves error status from server', async () => {
    global.fetch = makeErrorFetchMock(403, { detail: 'Forbidden' })
    const err = await fetchLoopPlayUrl(11).catch((e: unknown) => e)
    expect((err as LoopArchitectApiError).status).toBe(403)
  })
})

// ===========================================================================
// retryPreviewRender
// ===========================================================================

describe('retryPreviewRender', () => {
  it('posts to /api/v1/arrangements/:id/retry-preview', async () => {
    global.fetch = makeFetchMock({ queued: true, message: 'Queued' })
    await retryPreviewRender(12)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/arrangements/12/retry-preview')
  })

  it('uses POST method', async () => {
    global.fetch = makeFetchMock({ queued: true, message: 'Queued' })
    await retryPreviewRender(12)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    expect(init.method).toBe('POST')
  })

  it('returns queued status and message', async () => {
    global.fetch = makeFetchMock({ queued: true, message: 'Preview render queued' })
    const result = await retryPreviewRender(12)
    expect(result.queued).toBe(true)
    expect(result.message).toBe('Preview render queued')
  })

  it('throws LoopArchitectApiError on 404 (endpoint not yet deployed)', async () => {
    global.fetch = makeErrorFetchMock(404, { detail: 'Not found' })
    await expect(retryPreviewRender(12)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(retryPreviewRender(12)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// analyzeReferenceTrack
// ===========================================================================

describe('analyzeReferenceTrack', () => {
  const mockAnalysis = {
    reference_analysis_id: 'ref-abc',
    summary: {
      section_count: 5,
      detected_tempo: 130,
      structure_overview: 'intro-verse-hook',
    },
    status: 'done',
  }

  it('posts to the backend /api/v1/reference/analyze', async () => {
    global.fetch = makeFetchMock(mockAnalysis)
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    await analyzeReferenceTrack(file)
    const [[url]] = (global.fetch as jest.Mock).mock.calls
    expect(url).toContain('/v1/reference/analyze')
  })

  it('sends the file in FormData', async () => {
    global.fetch = makeFetchMock(mockAnalysis)
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    await analyzeReferenceTrack(file)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
  })

  it('does not manually set Content-Type', async () => {
    global.fetch = makeFetchMock(mockAnalysis)
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    await analyzeReferenceTrack(file)
    const [[, init]] = (global.fetch as jest.Mock).mock.calls
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['content-type']).toBeUndefined()
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('returns the analysis response', async () => {
    global.fetch = makeFetchMock(mockAnalysis)
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    const result = await analyzeReferenceTrack(file)
    expect(result.reference_analysis_id).toBe('ref-abc')
    expect(result.summary?.detected_tempo).toBe(130)
  })

  it('throws LoopArchitectApiError on HTTP error', async () => {
    global.fetch = makeErrorFetchMock(422, { detail: 'Unsupported format' })
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    await expect(analyzeReferenceTrack(file)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('wraps network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network failure'))
    const file = new File(['audio'], 'reference.mp3', { type: 'audio/mpeg' })
    await expect(analyzeReferenceTrack(file)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ===========================================================================
// LoopArchitectApiError shape
// ===========================================================================

describe('LoopArchitectApiError', () => {
  it('sets name to LoopArchitectApiError', () => {
    const err = new LoopArchitectApiError('Test', 400)
    expect(err.name).toBe('LoopArchitectApiError')
  })

  it('sets status', () => {
    const err = new LoopArchitectApiError('Test', 422)
    expect(err.status).toBe(422)
  })

  it('sets details when provided', () => {
    const err = new LoopArchitectApiError('Test', 400, { field: 'value' })
    expect(err.details).toEqual({ field: 'value' })
  })

  it('is an instance of Error', () => {
    const err = new LoopArchitectApiError('Test', 500)
    expect(err).toBeInstanceOf(Error)
  })
})
