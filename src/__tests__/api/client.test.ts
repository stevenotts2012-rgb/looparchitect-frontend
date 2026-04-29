/**
 * Unit tests for api/client.ts – uploadLoop function and URL resolution.
 *
 * The jsdom test environment provides `window`, so `getUploadUrl()` resolves
 * to the direct Railway backend origin (bypassing the Vercel proxy), which is
 * exactly the browser upload path we care about.
 */

import { uploadLoop, LoopArchitectApiError } from '@/../../api/client'

const RAILWAY_ORIGIN = 'https://web-production-3afc5.up.railway.app'
const EXPECTED_UPLOAD_URL = `${RAILWAY_ORIGIN}/api/v1/loops/with-file`

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------

function makeFetchMock(
  responseBody: unknown,
  status = 200,
): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(responseBody),
    text: () => Promise.resolve(JSON.stringify(responseBody)),
  })
}

function makeLoopResponse(id = 1) {
  return {
    id,
    name: 'test-loop',
    bpm: 120,
    bars: 8,
    created_at: '2024-01-01T00:00:00Z',
  }
}

beforeEach(() => {
  // Provide a clean fetch mock before each test
  global.fetch = makeFetchMock(makeLoopResponse())
  // Set the backend origin so getUploadUrl() resolves correctly (no hardcoded fallback)
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN = RAILWAY_ORIGIN
  // Silence intentional console.debug noise in test output
  jest.spyOn(console, 'debug').mockImplementation(() => {})
  jest.spyOn(console, 'info').mockImplementation(() => {})
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// URL resolution – no relative /api/… paths in browser upload flow
// ---------------------------------------------------------------------------

describe('uploadLoop – URL resolution', () => {
  it('calls fetch with a fully-qualified https URL, never a relative /api/... path', async () => {
    await uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))

    const [[calledUrl]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    expect(calledUrl).toMatch(/^https?:\/\//)
    expect(calledUrl).not.toMatch(/^\/api\//)
  })

  it('targets the Railway backend origin for the upload endpoint', async () => {
    await uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))

    const [[calledUrl]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    expect(calledUrl).toBe(EXPECTED_UPLOAD_URL)
  })
})

// ---------------------------------------------------------------------------
// Single-file upload path
// ---------------------------------------------------------------------------

describe('uploadLoop – single file', () => {
  it('sends the file under the "file" FormData field', async () => {
    const audioFile = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
    await uploadLoop(audioFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('file')).toBe(audioFile)
  })

  it('appends loop_in metadata', async () => {
    const audioFile = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
    await uploadLoop(audioFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    const loopIn = body.get('loop_in')
    expect(loopIn).not.toBeNull()
    const parsed = JSON.parse(loopIn as string)
    expect(parsed.name).toBe('loop.mp3')
    expect(parsed.filename).toBe('loop.mp3')
  })

  it('does NOT manually set Content-Type (browser sets multipart boundary)', async () => {
    await uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const headers = init.headers as Record<string, string> | undefined
    // headers should be absent or not contain Content-Type
    if (headers) {
      expect(headers['content-type']).toBeUndefined()
      expect(headers['Content-Type']).toBeUndefined()
    } else {
      expect(headers).toBeFalsy()
    }
  })

  it('does NOT send x-correlation-id (would force CORS preflight)', async () => {
    await uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['x-correlation-id']).toBeUndefined()
  })

  it('does NOT append stem_files or stem_zip for a single audio file', async () => {
    const audioFile = new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
    await uploadLoop(audioFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('stem_files')).toBeNull()
    expect(body.get('stem_zip')).toBeNull()
  })

  it('returns the loop response from the API', async () => {
    const loop = makeLoopResponse(42)
    global.fetch = makeFetchMock(loop)
    const result = await uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))
    expect(result.id).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// Multi-stem upload path
// ---------------------------------------------------------------------------

describe('uploadLoop – multi-stem (stem-files mode)', () => {
  function makeStemFiles(count: number): File[] {
    return Array.from({ length: count }, (_, i) =>
      new File([`audio${i}`], `stem${i}.wav`, { type: 'audio/wav' })
    )
  }

  it('sends each stem under the "stem_files" key', async () => {
    const stems = makeStemFiles(2)
    await uploadLoop(stems)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    const values = body.getAll('stem_files')
    expect(values).toHaveLength(2)
    expect(values[0]).toBe(stems[0])
    expect(values[1]).toBe(stems[1])
  })

  it('sends 20 stems without error', async () => {
    const stems = makeStemFiles(20)
    await uploadLoop(stems)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.getAll('stem_files')).toHaveLength(20)
  })

  it('does NOT append a "file" field for multi-stem uploads', async () => {
    await uploadLoop(makeStemFiles(3))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('file')).toBeNull()
  })

  it('does NOT append stem_zip for multi-stem audio uploads', async () => {
    await uploadLoop(makeStemFiles(3))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('stem_zip')).toBeNull()
  })

  it('does NOT manually set Content-Type', async () => {
    await uploadLoop(makeStemFiles(2))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['content-type']).toBeUndefined()
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('does NOT send x-correlation-id', async () => {
    await uploadLoop(makeStemFiles(2))

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['x-correlation-id']).toBeUndefined()
  })

  it('posts to the same direct Railway URL as the single-file path', async () => {
    await uploadLoop(makeStemFiles(2))

    const [[calledUrl]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    expect(calledUrl).toBe(EXPECTED_UPLOAD_URL)
  })

  it('throws LoopArchitectApiError when no files are provided', async () => {
    await expect(uploadLoop([])).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('throws when mixing audio and ZIP files', async () => {
    const files = [
      new File(['audio'], 'stem.wav', { type: 'audio/wav' }),
      new File(['zip'], 'pack.zip', { type: 'application/zip' }),
    ]
    await expect(uploadLoop(files)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ---------------------------------------------------------------------------
// Stem-ZIP upload path
// ---------------------------------------------------------------------------

describe('uploadLoop – stem ZIP (stem-pack mode)', () => {
  it('sends the ZIP under the "stem_zip" FormData field', async () => {
    const zipFile = new File(['zip'], 'stems.zip', { type: 'application/zip' })
    await uploadLoop(zipFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('stem_zip')).toBe(zipFile)
  })

  it('does NOT append "file" or "stem_files" for a ZIP upload', async () => {
    const zipFile = new File(['zip'], 'stems.zip', { type: 'application/zip' })
    await uploadLoop(zipFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    expect(body.get('file')).toBeNull()
    expect(body.get('stem_files')).toBeNull()
  })

  it('strips .zip from the name in loop_in metadata', async () => {
    const zipFile = new File(['zip'], 'my-stems.zip', { type: 'application/zip' })
    await uploadLoop(zipFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const body = init.body as FormData
    const parsed = JSON.parse(body.get('loop_in') as string)
    expect(parsed.name).toBe('my-stems')
    expect(parsed.filename).toBe('my-stems.zip')
  })

  it('does NOT send x-correlation-id', async () => {
    const zipFile = new File(['zip'], 'stems.zip', { type: 'application/zip' })
    await uploadLoop(zipFile)

    const [[, init]] = (global.fetch as jest.Mock).mock.calls as [[string, RequestInit]]
    const headers = (init.headers ?? {}) as Record<string, string>
    expect(headers['x-correlation-id']).toBeUndefined()
  })

  it('throws when more than one ZIP is provided', async () => {
    const files = [
      new File(['zip1'], 'a.zip', { type: 'application/zip' }),
      new File(['zip2'], 'b.zip', { type: 'application/zip' }),
    ]
    await expect(uploadLoop(files)).rejects.toBeInstanceOf(LoopArchitectApiError)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('uploadLoop – error handling', () => {
  it('wraps network errors in LoopArchitectApiError', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      uploadLoop(new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' }))
    ).rejects.toBeInstanceOf(LoopArchitectApiError)
  })

  it('surfaces the original LoopArchitectApiError without double-wrapping', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ detail: 'Bad file format' }),
      text: () => Promise.resolve('{"detail":"Bad file format"}'),
    })
    const err = await uploadLoop(
      new File(['audio'], 'loop.mp3', { type: 'audio/mpeg' })
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LoopArchitectApiError)
    expect((err as LoopArchitectApiError).status).toBe(422)
  })
})
