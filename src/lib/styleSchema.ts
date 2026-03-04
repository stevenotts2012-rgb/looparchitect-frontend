import { z } from 'zod';

/**
 * PHASE 3: Style Direction Engine Schema
 * 
 * Zod schemas for frontend validation of style parameters
 * and arrangement requests with slider controls.
 */

export const SimpleStyleProfileSchema = z.object({
  intent: z.string().min(1).max(500).describe('Style description'),
  energy: z.number().min(0).max(1).default(0.5).describe('Energy: 0=quiet, 1=loud'),
  darkness: z.number().min(0).max(1).default(0.5).describe('Darkness: 0=bright, 1=dark'),
  bounce: z.number().min(0).max(1).default(0.5).describe('Bounce: 0=laid-back, 1=driving'),
  warmth: z.number().min(0).max(1).default(0.5).describe('Warmth: 0=cold, 1=warm'),
  texture: z.enum(['smooth', 'balanced', 'gritty']).default('balanced').describe('Texture type'),
  references: z.array(z.string()).default([]).describe('Reference artists/tracks'),
  avoid: z.array(z.string()).default([]).describe('Elements to avoid'),
  seed: z.number().int().default(42).describe('Random seed'),
  confidence: z.number().min(0).max(1).default(0.8).describe('Parser confidence'),
});

export type SimpleStyleProfile = z.infer<typeof SimpleStyleProfileSchema>;

export const StyleValidationRequestSchema = z.object({
  profile: SimpleStyleProfileSchema,
});

export type StyleValidationRequest = z.infer<typeof StyleValidationRequestSchema>;

export const StyleValidationResponseSchema = z.object({
  valid: z.boolean(),
  normalized_profile: SimpleStyleProfileSchema,
  warnings: z.array(z.string()).default([]),
  message: z.string(),
});

export type StyleValidationResponse = z.infer<typeof StyleValidationResponseSchema>;

/**
 * Extended arrangement request that includes style profile
 */
export const AudioArrangementWithStyleSchema = z.object({
  loop_id: z.number().int().positive(),
  target_seconds: z.number().int().positive().min(10).max(3600),
  style_profile: SimpleStyleProfileSchema,
  use_ai_parsing: z.boolean().default(false),
  include_stems: z.boolean().default(false),
  variation_count: z.number().int().min(1).max(3).default(1),
});

export type AudioArrangementWithStyle = z.infer<typeof AudioArrangementWithStyleSchema>;
