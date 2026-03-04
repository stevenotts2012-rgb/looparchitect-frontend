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
  status: 'queued' | 'pending' | 'processing' | 'done' | 'completed' | 'failed';
  error_message?: string;
  output_file?: string;
  output_s3_key?: string;
  target_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface GenerateArrangementResponse {
  arrangement_id: number;
  loop_id: number;
  status: string;
  created_at: string;
  render_job_ids?: string[];
  seed_used?: number;
  style_preset?: string;
  style_profile?: Record<string, unknown>;
  structure_preview?: Array<{ name: string; bars: number; energy: number }>;
}

export interface StylePresetResponse {
  id: string;
  display_name: string;
  description: string;
  defaults: {
    tempo_multiplier: number;
    drum_density: number;
    hat_roll_probability: number;
    glide_probability: number;
    swing: number;
    aggression: number;
    melody_complexity: number;
    fx_intensity: number;
  };
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
  options?: {
    targetSeconds?: number;
    duration?: number;
    genre?: string;
    intensity?: string;
    includeStems?: boolean;
    stylePreset?: string;
    styleParams?: Record<string, number | string>;
    seed?: number | string;
    variationCount?: number;
    styleTextInput?: string;
    useAiParsing?: boolean;
  }
): Promise<GenerateArrangementResponse> {
  try {
    // Use targetSeconds if provided, otherwise duration, otherwise default to 180 seconds
    const targetSeconds = options?.targetSeconds || options?.duration || 180;
    
    const requestBody: {
      loop_id: number;
      target_seconds: number;
      genre?: string;
      intensity?: string;
      include_stems?: boolean;
      style_preset?: string;
      style_params?: Record<string, number | string>;
      seed?: number | string;
      variation_count?: number;
      style_text_input?: string;
      use_ai_parsing?: boolean;
    } = {
      loop_id: loopId,
      target_seconds: targetSeconds,
    };
    
    if (options?.genre) requestBody.genre = options.genre;
    if (options?.intensity) requestBody.intensity = options.intensity;
    if (options?.includeStems !== undefined) requestBody.include_stems = options.includeStems;
    if (options?.stylePreset) requestBody.style_preset = options.stylePreset;
    if (options?.styleParams) requestBody.style_params = options.styleParams;
    if (options?.seed !== undefined) requestBody.seed = options.seed;
    if (options?.variationCount !== undefined) requestBody.variation_count = options.variationCount;
    if (options?.styleTextInput) requestBody.style_text_input = options.styleTextInput;
    if (options?.useAiParsing !== undefined) requestBody.use_ai_parsing = options.useAiParsing;

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

export async function listStylePresets(): Promise<StylePresetResponse[]> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/styles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const payload = await handleResponse<{ styles: StylePresetResponse[] }>(response);
    return payload.styles || [];
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to list style presets: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Validate a style profile without generating audio
 * @param profile - The style profile to validate
 * @returns Promise with validation result and normalized profile
 */
export async function validateStyle(profile: {
  intent: string;
  energy?: number;
  darkness?: number;
  bounce?: number;
  warmth?: number;
  texture?: string;
  references?: string[];
  avoid?: string[];
  seed?: number;
  confidence?: number;
}): Promise<{
  valid: boolean;
  normalized_profile: typeof profile;
  warnings: string[];
  message: string;
}> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/styles/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ profile }),
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to validate style: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * List recent arrangements
 * @param options - Optional filters for loop and max results
 * @returns Promise with arrangement rows sorted by newest first
 */
export async function listArrangements(options?: {
  loopId?: number;
  status?: string;
  limit?: number;
}): Promise<Arrangement[]> {
  try {
    const params = new URLSearchParams();
    if (options?.loopId) {
      params.set('loop_id', String(options.loopId));
    }

    const query = params.toString();
    const response = await fetch(
      `${API_BASE_PATH}/v1/arrangements${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    let rows = await handleResponse<Arrangement[]>(response);
    
    // Client-side status filter since backend doesn't support it yet
    if (options?.status && options.status !== 'all') {
      rows = rows.filter((row) => row.status === options.status);
    }
    
    if (options?.limit && options.limit > 0) {
      return rows.slice(0, options.limit);
    }
    return rows;
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to list arrangements: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
 * Get loop details
 * @param loopId - The loop ID
 * @returns Promise with the loop details
 */
export async function getLoop(loopId: number): Promise<LoopResponse> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/loops/${loopId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse<LoopResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to get loop details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Download loop audio as a blob
 * @param loopId - The loop ID
 * @returns Promise with a blob URL for the loop audio
 */
export async function downloadLoop(loopId: number): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/loops/${loopId}/download`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new LoopArchitectApiError(
        `Failed to download loop: ${response.statusText}`,
        response.status
      );
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to download loop audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Validate that a loop has an accessible source file
 * @param loopId - The loop ID
 */
export async function validateLoopSource(loopId: number): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_PATH}/v1/loops/${loopId}/play`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `Loop source unavailable: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch {
      }
      throw new LoopArchitectApiError(errorMessage, response.status);
    }
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to validate loop source: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
