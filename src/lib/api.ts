// ⚠️  DEPRECATION NOTICE
// The helpers in this file (getApiBasePath / apiUrl / apiFetch / fetchLoopPlayUrl)
// are an older, partial copy of the functions in api/client.ts.
//
// For new code – and especially for ANY upload logic – always import from
// api/client.ts.

function getApiBasePath(): string {
  // Always bypass the Next.js/Vercel proxy and go directly to the Railway
  // backend, both in the browser and server-side.  This ensures that all API
  // calls hit the same backend where render jobs run, so results are never
  // missed due to proxy caching or routing differences.
  //
  // NEXT_PUBLIC_BACKEND_ORIGIN must be set at build time in Vercel:
  //   Staging:    https://web-staging-cb7b.up.railway.app
  //   Production: https://web-production-3afc5.up.railway.app
  if (typeof window !== 'undefined') {
    // Browser: use ONLY NEXT_PUBLIC_BACKEND_ORIGIN – no fallback to
    // NEXT_PUBLIC_API_URL which may point to the Vercel frontend and cause
    // requests to be silently routed through the Next.js proxy instead of
    // going directly to the Railway backend.
    const configured = (process.env.NEXT_PUBLIC_BACKEND_ORIGIN || '').trim()
    if (configured.startsWith('http://') || configured.startsWith('https://')) {
      return `${configured.replace(/\/$/, '')}/api`
    }
    throw new Error(
      'NEXT_PUBLIC_BACKEND_ORIGIN environment variable is not set or invalid. Cannot determine API base path.'
    )
  }

  // Server-side: resolve the backend origin directly.
  const configured = (process.env.BACKEND_ORIGIN || '').trim()
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return `${configured.replace(/\/$/, '')}/api`
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000/api'
  }

  // No hardcoded fallback: throw so misconfigured deployments fail loudly
  // instead of silently routing to the wrong backend (e.g. production instead
  // of staging).  Set BACKEND_ORIGIN in your Vercel environment variables:
  //   Staging:    https://web-staging-cb7b.up.railway.app
  //   Production: https://web-production-3afc5.up.railway.app
  throw new Error('BACKEND_ORIGIN environment variable is not set. Cannot determine API base path.')
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
  const url = apiUrl('/v1/loops')
  console.log("API_CALL", url)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`)
  }

  return response.json()
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
  console.log("API_CALL", url)
  
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
