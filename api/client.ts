// API Client for LoopArchitect Frontend
// Connects Next.js frontend to FastAPI backend on Railway

const API_BASE_PATH = '/api';

// ============================================================================
// Type Definitions
// ============================================================================

export interface LoopResponse {
  id: number;
  name: string;
  filename?: string;
  file_url?: string;
  file_key?: string;
  title?: string;
  tempo?: number;
  bpm?: number;
  bars?: number;
  key?: string;
  musical_key?: string;
  genre?: string;
  duration_seconds?: number;
  status?: string;
  processed_file_url?: string;
  analysis_json?: string;
  created_at: string;
}

export interface Arrangement {
  id: number;
  loop_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  output_file?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateArrangementResponse {
  arrangement_id: number;
  loop_id: number;
  status: string;
  created_at: string;
}

export interface ArrangementStatusResponse {
  id: number;
  status: 'queued' | 'processing' | 'done' | 'failed' | 'pending' | 'completed';
  progress?: number;
  error_message?: string;
  output_file?: string;
}

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

// ============================================================================
// Error Handling
// ============================================================================

class LoopArchitectApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'LoopArchitectApiError';
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    let errorDetails: unknown;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.detail || errorMessage;
      errorDetails = errorData;
    } catch {
      // If response is not JSON, use status text
    }

    throw new LoopArchitectApiError(errorMessage, response.status, errorDetails);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return {} as T;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Generate a new arrangement from a loop
 * @param loopId - The ID of the loop to generate an arrangement from
 * @param options - Parameters including targetSeconds (required) and other options
 * @returns Promise with the generated arrangement details
 */
export async function generateArrangement(
  loopId: number,
  options?: { targetSeconds?: number; duration?: number; genre?: string; intensity?: string; includeStems?: boolean }
): Promise<GenerateArrangementResponse> {
  try {
    // Use targetSeconds if provided, otherwise duration, otherwise default to 180 seconds
    const targetSeconds = options?.targetSeconds || options?.duration || 180;
    
    const requestBody: { loop_id: number; target_seconds: number; genre?: string; intensity?: string; include_stems?: boolean } = {
      loop_id: loopId,
      target_seconds: targetSeconds,
    };
    
    if (options?.genre) requestBody.genre = options.genre;
    if (options?.intensity) requestBody.intensity = options.intensity;
    if (options?.includeStems !== undefined) requestBody.include_stems = options.includeStems;

    const response = await fetch(`${API_BASE_PATH}/v1/arrangements/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    return handleResponse<GenerateArrangementResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to generate arrangement: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Get the status of an arrangement
 * @param id - The arrangement ID
 * @returns Promise with the arrangement status
 */
export async function getArrangementStatus(
  id: number
): Promise<ArrangementStatusResponse> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/arrangements/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse<ArrangementStatusResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to get arrangement status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Download a completed arrangement
 * @param id - The arrangement ID
 * @returns Promise with the audio file as a Blob
 */
export async function downloadArrangement(id: number): Promise<Blob> {
  try {
    const response = await fetch(
      `${API_BASE_PATH}/v1/arrangements/${id}/download`,
      {
        method: 'GET',
      }
    );

    if (!response.ok) {
      let errorMessage = `Download failed: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch {
        // Not JSON, use status text
      }
      throw new LoopArchitectApiError(errorMessage, response.status);
    }

    return response.blob();
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to download arrangement: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Upload a loop file
 * @param file - The audio file to upload
 * @returns Promise with the created loop details
 */
export async function uploadLoop(file: File): Promise<LoopResponse> {
  try {
    const formData = new FormData();
    
    // Create loop metadata with filename as name
    const loopMetadata = {
      name: file.name,
      filename: file.name,
    };
    
    // Append as JSON string (backend expects loop_in as Form field)
    formData.append('loop_in', JSON.stringify(loopMetadata));
    // Append the audio file
    formData.append('file', file);

    const response = await fetch(`${API_BASE_PATH}/v1/loops/with-file`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse<LoopResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to upload loop: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

// Export error class for external use
export { LoopArchitectApiError };
