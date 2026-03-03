const API_BASE_PATH = '/api'

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
  const url = `${API_BASE_PATH}/v1/loops/${loopId}/play`
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
  return apiFetch<LoopResponse[]>('/api/v1/loops')
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
  const url = endpoint.startsWith('/api/') ? endpoint : `${API_BASE_PATH}${endpoint}`
  
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
