// API Client for LoopArchitect Frontend
// Connects Next.js frontend to FastAPI backend on Railway

const DEFAULT_BACKEND_ORIGIN = 'https://web-production-3afc5.up.railway.app';

function getApiBasePath(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return `${configured.replace(/\/$/, '')}/api`;
  }
  return `${DEFAULT_BACKEND_ORIGIN}/api`;
}

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBasePath()}${normalized}`;
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createJsonHeaders(correlationId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-correlation-id': correlationId,
  };
}

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
  stem_metadata?: {
    enabled?: boolean;
    backend?: string;
    succeeded?: boolean;
    upload_mode?: string;
    roles_detected?: string[];
    stems_generated?: string[];
    stem_s3_keys?: Record<string, string>;
    source_files?: string[];
    sample_rate?: number;
    duration_ms?: number;
    warnings?: string[];
    fallback_to_loop?: boolean;
    alignment?: {
      auto_aligned?: boolean;
      confidence?: number;
      low_confidence?: boolean;
      fallback_to_loop?: boolean;
      reference_offset_ms?: number;
      original_offsets_ms?: Record<string, number>;
      adjustments_ms?: Record<string, { trim_ms?: number; pad_ms?: number }>;
      warnings?: string[];
    };
  };
  created_at: string;
}

export interface Arrangement {
  id: number;
  loop_id: number;
  status: 'queued' | 'pending' | 'processing' | 'done' | 'completed' | 'failed';
  error_message?: string;
  output_file?: string;
  output_s3_key?: string;
  export_s3_key?: string;
  stems_zip_url?: string;
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
  output_url?: string;
  stems_zip_url?: string;
  export_s3_key?: string;
}

export interface DawExportResponse {
  arrangement_id: number;
  ready_for_export: boolean;
  download_url?: string;
  export_s3_key?: string;
  contents?: {
    stems: string[];
    midi: string[];
    metadata: string[];
  };
  midi_note?: string;
  status?: string;
  message?: string;
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
    bars?: number;
    loopBpm?: number;
    genre?: string;
    intensity?: string;
    includeStems?: boolean;
    stylePreset?: string;
    styleParams?: Record<string, number | string>;
    seed?: number | string;
    variationCount?: number;
    styleTextInput?: string;
    useAiParsing?: boolean;
    producerMoves?: string[];
    arrangementPlan?: ArrangementPlanResponse['plan'];
  }
): Promise<GenerateArrangementResponse> {
  try {
    const correlationId = generateCorrelationId();
    // Resolve target duration with priority: targetSeconds > duration > bars(+bpm) > default
    let targetSeconds = options?.targetSeconds || options?.duration;
    if (!targetSeconds && options?.bars) {
      const bpm = options.loopBpm && options.loopBpm > 0 ? options.loopBpm : 120;
      targetSeconds = Math.max(10, Math.round((options.bars * 4 * 60) / bpm));
    }
    if (!targetSeconds) {
      targetSeconds = 180;
    }
    
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
      producer_moves?: string[];
      arrangement_plan?: ArrangementPlanResponse['plan'];
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
    if (options?.producerMoves) requestBody.producer_moves = options.producerMoves;
    if (options?.arrangementPlan) requestBody.arrangement_plan = options.arrangementPlan;

    const response = await fetch(apiUrl('/v1/arrangements/generate'), {
      method: 'POST',
      headers: createJsonHeaders(correlationId),
      body: JSON.stringify(requestBody),
    });

    const payload = await handleResponse<GenerateArrangementResponse>(response);
    console.info('feature_event', {
      event: 'arrangement_created',
      correlation_id: correlationId,
      arrangement_id: payload.arrangement_id,
      sections_count: payload.structure_preview?.length || 0,
    });
    return payload;
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
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl('/v1/styles'), {
      method: 'GET',
      headers: createJsonHeaders(correlationId),
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
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl(`/v1/arrangements/${id}`), {
      method: 'GET',
      headers: {
        ...createJsonHeaders(correlationId),
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
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

export interface ProducerDebugSection {
  section_type: string;
  active_stem_roles?: string[] | null;
  transition_events?: string[] | null;
  difference_from_previous?: { reasons?: string[] } | null;
}

export interface ArrangementMetadataResponse {
  arrangement_id: number;
  producer_debug_report?: ProducerDebugSection[];
  timeline?: Record<string, unknown>;
}

export interface ArrangementPlanSection {
  index: number;
  type: 'intro' | 'verse' | 'pre_hook' | 'hook' | 'bridge' | 'breakdown' | 'outro';
  bars: number;
  energy: number;
  density: 'sparse' | 'medium' | 'full';
  active_roles: string[];
  transition_into:
    | 'none'
    | 'drum_fill'
    | 'fx_rise'
    | 'fx_hit'
    | 'mute_drop'
    | 'bass_drop'
    | 'vocal_chop'
    | 'arp_lift'
    | 'percussion_fill';
  notes: string;
}

export interface ArrangementPlanResponse {
  plan: {
    structure: string[];
    total_bars: number;
    sections: ArrangementPlanSection[];
    planner_notes: {
      strategy: string;
      fallback_used: boolean;
    };
  };
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  planner_meta: {
    model?: string | null;
    latency_ms: number;
    tokens?: number | null;
    fallback_used: boolean;
  };
}

/**
 * Get full metadata and producer debug report for a completed arrangement
 * @param id - The arrangement ID
 * @returns Promise with arrangement metadata including producer_debug_report
 */
export async function getArrangementMetadata(
  id: number
): Promise<ArrangementMetadataResponse> {
  try {
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl(`/v1/arrangements/${id}/metadata`), {
      method: 'GET',
      headers: {
        ...createJsonHeaders(correlationId),
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    return handleResponse<ArrangementMetadataResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to get arrangement metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Generate AI arrangement plan preview before render starts
 */
export async function getArrangementPlan(payload: {
  input: {
    bpm?: number | null;
    key?: string | null;
    time_signature?: string | null;
    bars_available?: number | null;
    genre_hint?: string | null;
    mood_hint?: string | null;
    detected_roles: string[];
    preferred_structure?: string[] | null;
    target_total_bars?: number | null;
    source_type: 'loop' | 'stem_pack' | 'unknown';
  };
  user_request?: string;
  planner_config?: {
    strict?: boolean;
    max_sections?: number;
    allow_full_mix?: boolean;
  };
}): Promise<ArrangementPlanResponse> {
  try {
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl('/v1/arrangements/plan'), {
      method: 'POST',
      headers: createJsonHeaders(correlationId),
      body: JSON.stringify(payload),
    });

    return handleResponse<ArrangementPlanResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to generate arrangement plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl('/v1/styles/validate'), {
      method: 'POST',
      headers: createJsonHeaders(correlationId),
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
    const correlationId = generateCorrelationId();
    const params = new URLSearchParams();
    if (options?.loopId) {
      params.set('loop_id', String(options.loopId));
    }

    const query = params.toString();
    const response = await fetch(
      `${apiUrl('/v1/arrangements')}${query ? `?${query}` : ''}`,
      {
        method: 'GET',
        headers: createJsonHeaders(correlationId),
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
      apiUrl(`/v1/arrangements/${id}/download`),
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

export async function getDawExportInfo(id: number): Promise<DawExportResponse> {
  try {
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl(`/v1/arrangements/${id}/daw-export`), {
      method: 'GET',
      headers: createJsonHeaders(correlationId),
    });
    return handleResponse<DawExportResponse>(response);
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to get DAW export info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

/**
 * Download DAW export ZIP file for an arrangement
 * @param id - The arrangement ID
 * @returns Promise with the ZIP file as a Blob
 */
export async function downloadDawExport(id: number): Promise<Blob> {
  try {
    const correlationId = generateCorrelationId();
    const response = await fetch(
      apiUrl(`/v1/arrangements/${id}/daw-export/download`),
      {
        method: 'GET',
        headers: {
          'x-correlation-id': correlationId,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new LoopArchitectApiError(
        `Failed to download DAW export: ${errorText}`,
        response.status
      );
    }

    return await response.blob();
  } catch (error) {
    if (error instanceof LoopArchitectApiError) {
      throw error;
    }
    throw new LoopArchitectApiError(
      `Failed to download DAW export: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl(`/v1/loops/${loopId}`), {
      method: 'GET',
      headers: createJsonHeaders(correlationId),
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
    const response = await fetch(apiUrl(`/v1/loops/${loopId}/download`), {
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
    const correlationId = generateCorrelationId();
    const response = await fetch(apiUrl(`/v1/loops/${loopId}/play`), {
      method: 'GET',
      headers: createJsonHeaders(correlationId),
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
export async function uploadLoop(file: File | File[]): Promise<LoopResponse> {
  try {
    const correlationId = generateCorrelationId();
    const formData = new FormData();
    const files = Array.isArray(file) ? file : [file];
    if (files.length === 0) {
      throw new LoopArchitectApiError('No upload files provided', 400);
    }

    const hasZip = files.some((candidate) => candidate.name.toLowerCase().endsWith('.zip'));
    const hasAudio = files.some((candidate) => !candidate.name.toLowerCase().endsWith('.zip'));
    if (hasZip && hasAudio) {
      throw new LoopArchitectApiError('Upload either audio stems or one ZIP stem pack, not both.', 400);
    }
    if (hasZip && files.length > 1) {
      throw new LoopArchitectApiError('Upload exactly one ZIP file for stem-pack ZIP mode.', 400);
    }
    
    // Create loop metadata with filename as name
    const loopMetadata = {
      name: hasZip ? files[0].name.replace(/\.zip$/i, '') : files[0].name,
      filename: files[0].name,
    };
    
    // Append as JSON string (backend expects loop_in as Form field)
    formData.append('loop_in', JSON.stringify(loopMetadata));
    // Append the audio file
    if (hasZip) {
      formData.append('stem_zip', files[0]);
    } else if (files.length > 1) {
      files.forEach((stem) => formData.append('stem_files', stem));
    } else {
      formData.append('file', files[0]);
    }

    const response = await fetch(apiUrl('/v1/loops/with-file'), {
      method: 'POST',
      headers: {
        'x-correlation-id': correlationId,
      },
      body: formData,
    });

    const payload = await handleResponse<LoopResponse>(response);
    console.info('feature_event', {
      event: 'loop_created',
      correlation_id: correlationId,
      loop_id: payload.id,
      bpm: payload.bpm,
      bars: payload.bars,
    });
    return payload;
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

export async function fetchLoopPlayUrl(loopId: number): Promise<string> {
  const correlationId = generateCorrelationId();
  const response = await fetch(apiUrl(`/v1/loops/${loopId}/play`), {
    method: 'GET',
    headers: createJsonHeaders(correlationId),
  });

  if (!response.ok) {
    throw new LoopArchitectApiError(
      `Failed to fetch loop: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = await response.json();
  if (!data?.url || typeof data.url !== 'string') {
    throw new LoopArchitectApiError('No URL returned from API', 500, data);
  }
  return data.url;
}

// Export error class for external use
export { LoopArchitectApiError };
