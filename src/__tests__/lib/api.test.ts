/**
 * Tests for src/lib/api.ts – legacy API helpers.
 */

// We need to control window availability. Import after setting up environment.

const RAILWAY_ORIGIN = 'https://web-production-3afc5.up.railway.app'

describe('src/lib/api.ts – browser environment (window defined)', () => {
  // window is defined in jsdom, so getApiBasePath() resolves via NEXT_PUBLIC_BACKEND_ORIGIN
  // and goes directly to the Railway backend (no Vercel proxy).

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN = RAILWAY_ORIGIN
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN
    jest.restoreAllMocks()
  })

  describe('fetchLoopPlayUrl', () => {
    it('fetches the play URL for a loop', async () => {
      const { fetchLoopPlayUrl } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: 'https://cdn.example.com/loop.mp3' }),
      })
      const result = await fetchLoopPlayUrl(1)
      expect(result).toBe('https://cdn.example.com/loop.mp3')
    })

    it('calls the correct URL path', async () => {
      const { fetchLoopPlayUrl } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ url: 'https://cdn.example.com/loop.mp3' }),
      })
      await fetchLoopPlayUrl(42)
      const [[calledUrl]] = (global.fetch as jest.Mock).mock.calls
      expect(calledUrl).toContain('/v1/loops/42/play')
    })

    it('throws when response is not ok', async () => {
      const { fetchLoopPlayUrl } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Not found'),
      })
      await expect(fetchLoopPlayUrl(1)).rejects.toThrow()
    })

    it('throws when url is absent from response', async () => {
      const { fetchLoopPlayUrl } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
      await expect(fetchLoopPlayUrl(1)).rejects.toThrow('No URL returned from API')
    })

    it('re-throws after logging on network error', async () => {
      const { fetchLoopPlayUrl } = await import('@/lib/api')
      global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'))
      await expect(fetchLoopPlayUrl(1)).rejects.toThrow('Network failure')
    })
  })

  describe('fetchLoops', () => {
    it('fetches the loops list', async () => {
      const { fetchLoops } = await import('@/lib/api')
      const mockLoops = [{ id: 1, name: 'loop.mp3' }, { id: 2, name: 'beat.mp3' }]
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockLoops),
      })
      const result = await fetchLoops()
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
    })

    it('calls the correct URL', async () => {
      const { fetchLoops } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })
      await fetchLoops()
      const [[url]] = (global.fetch as jest.Mock).mock.calls
      expect(url).toContain('/v1/loops')
    })
  })

  describe('apiFetch', () => {
    it('fetches and returns parsed JSON', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'value' }),
      })
      const result = await apiFetch<{ data: string }>('/v1/something')
      expect(result.data).toBe('value')
    })

    it('strips leading /api from endpoint to avoid double prefix', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
      await apiFetch('/api/v1/loops')
      const [[url]] = (global.fetch as jest.Mock).mock.calls
      // Should not have /api/api/ double prefix
      expect(url).not.toContain('/api/api/')
    })

    it('throws on HTTP error', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      })
      await expect(apiFetch('/v1/something')).rejects.toThrow()
    })

    it('passes custom options to fetch', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
      await apiFetch('/v1/something', { method: 'POST', body: '{}' })
      const [[, init]] = (global.fetch as jest.Mock).mock.calls
      expect(init.method).toBe('POST')
    })

    it('merges Content-Type with custom headers', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })
      await apiFetch('/v1/something', { headers: { 'X-Custom': 'test' } })
      const [[, init]] = (global.fetch as jest.Mock).mock.calls
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
      expect((init.headers as Record<string, string>)['X-Custom']).toBe('test')
    })

    it('re-throws after logging on error', async () => {
      const { apiFetch } = await import('@/lib/api')
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))
      await expect(apiFetch('/v1/something')).rejects.toThrow('Network error')
    })
  })
})
