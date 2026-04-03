// ⚠️  DEPRECATION NOTICE
// The helpers in this file (getApiBasePath / apiUrl / apiFetch / fetchLoopPlayUrl)
// are an older, partial copy of the functions in api/client.ts.
//
// For new code – and especially for ANY upload logic – always import from
// api/client.ts.  The `getApiBasePath` below returns a relative "/api" path
// for browser calls, which routes through the Vercel proxy.  That is
// intentional for lightweight JSON requests but MUST NOT be used for
// multipart uploads: Vercel's body-size limit causes 413 errors and the proxy
// adds x-correlation-id, triggering a CORS preflight that blocks uploads.
//
// Upload URL resolution lives exclusively in `getUploadUrl()` in api/client.ts.

const DEFAULT_BACKEND_ORIGIN = 'https://web-production-3afc5.up.railway.app'

function getApiBasePath(): string {
  // In the browser, use a relative path so all API calls are routed through
  // the Next.js API proxy route (src/app/api/[...path]/route.ts), which then
  // forwards the request to the backend on the server side. This avoids CORS
  // issues because the browser never makes a request directly to the backend.
  //
  // NOTE: This path must NEVER be used for multipart uploads – see the
  // deprecation notice at the top of this file.
  if (typeof window !== 'undefined') {
    return '/api'
  }

  // Server-side: resolve the backend origin directly.
  const configured = (process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return `${configured.replace(/\/$/, '')}/api`
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000/api'
  }

  return `${DEFAULT_BACKEND_ORIGIN}/api`
}

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getApiBasePath()}${normalized}`
}

interface LoopPlayResponse {
  url: string
}

export interface LoopResponse {
  id: number
  name: string
  title?: string | null
  bpm?: number | null
}

/**
 * Fetch the play URL for a specific loop
 * @param loopId - The ID of the loop to fetch
 * @returns Promise resolving to the audio URL
 */
export async function fetchLoopPlayUrl(loopId: number): Promise<string> {
  const url = apiUrl(`/v1/loops/${loopId}/play`)
  console.log(`[API] Fetching play URL for loop ID ${loopId}:`, url)
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[API] Request failed with status ${response.status}`, await response.text())
      throw new Error(`Failed to fetch loop: ${response.status} ${response.statusText}`)
    }

    const data: LoopPlayResponse = await response.json()
    console.log(`[API] Successfully retrieved URL for loop ${loopId}:`, data.url)
    
    if (!data.url) {
      throw new Error('No URL returned from API')
    }

    return data.url
  } catch (error) {
    console.error(`[API] Error fetching loop play URL for ID ${loopId}:`, error)
    throw error
  }
}

/**
 * Fetch available loops
 * @returns Promise resolving to loop list
 */
export async function fetchLoops(): Promise<LoopResponse[]> {
  return apiFetch<LoopResponse[]>('/v1/loops')
}

/**
 * Generic API fetch helper with error handling
 * @param endpoint - API endpoint path (without base URL)
 * @param options - Fetch options
 * @returns Promise resolving to the response data
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiEndpoint = endpoint.startsWith('/api/') ? endpoint.replace(/^\/api/, '') : endpoint
  const url = apiUrl(apiEndpoint)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API fetch error:', error)
    throw error
  }
}
