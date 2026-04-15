/**
 * Tests for src/lib/styleSchema.ts – Zod schema validation.
 */

import {
  SimpleStyleProfileSchema,
  StyleValidationRequestSchema,
  StyleValidationResponseSchema,
  AudioArrangementWithStyleSchema,
} from '@/lib/styleSchema'

// ===========================================================================
// SimpleStyleProfileSchema
// ===========================================================================

describe('SimpleStyleProfileSchema', () => {
  const validProfile = {
    intent: 'dark trap',
    energy: 0.8,
    darkness: 0.9,
    bounce: 0.6,
    warmth: 0.3,
    texture: 'gritty' as const,
    references: ['Artist A'],
    avoid: ['claps'],
    seed: 123,
    confidence: 0.9,
  }

  it('accepts a fully populated valid profile', () => {
    const result = SimpleStyleProfileSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
  })

  it('requires intent field', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, intent: '' })
    expect(result.success).toBe(false)
  })

  it('rejects intent longer than 500 characters', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, intent: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts intent exactly 500 characters', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, intent: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('rejects energy below 0', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, energy: -0.1 })
    expect(result.success).toBe(false)
  })

  it('rejects energy above 1', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, energy: 1.1 })
    expect(result.success).toBe(false)
  })

  it('accepts energy boundary values 0 and 1', () => {
    expect(SimpleStyleProfileSchema.safeParse({ ...validProfile, energy: 0 }).success).toBe(true)
    expect(SimpleStyleProfileSchema.safeParse({ ...validProfile, energy: 1 }).success).toBe(true)
  })

  it('accepts all valid texture values', () => {
    const textures = ['smooth', 'balanced', 'gritty'] as const
    textures.forEach((texture) => {
      const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, texture })
      expect(result.success).toBe(true)
    })
  })

  it('rejects unknown texture value', () => {
    const result = SimpleStyleProfileSchema.safeParse({ ...validProfile, texture: 'rough' })
    expect(result.success).toBe(false)
  })

  it('applies default values for optional fields when omitted', () => {
    const minimal = { intent: 'chill vibes' }
    const result = SimpleStyleProfileSchema.safeParse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.energy).toBe(0.5)
      expect(result.data.darkness).toBe(0.5)
      expect(result.data.bounce).toBe(0.5)
      expect(result.data.warmth).toBe(0.5)
      expect(result.data.texture).toBe('balanced')
      expect(result.data.references).toEqual([])
      expect(result.data.avoid).toEqual([])
      expect(result.data.seed).toBe(42)
      expect(result.data.confidence).toBe(0.8)
    }
  })

  it('rejects confidence outside 0-1 range', () => {
    expect(SimpleStyleProfileSchema.safeParse({ ...validProfile, confidence: -0.1 }).success).toBe(false)
    expect(SimpleStyleProfileSchema.safeParse({ ...validProfile, confidence: 1.1 }).success).toBe(false)
  })
})

// ===========================================================================
// StyleValidationRequestSchema
// ===========================================================================

describe('StyleValidationRequestSchema', () => {
  it('requires profile field', () => {
    const result = StyleValidationRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('accepts a valid profile', () => {
    const result = StyleValidationRequestSchema.safeParse({
      profile: { intent: 'dark trap' },
    })
    expect(result.success).toBe(true)
  })
})

// ===========================================================================
// StyleValidationResponseSchema
// ===========================================================================

describe('StyleValidationResponseSchema', () => {
  const validResponse = {
    valid: true,
    normalized_profile: {
      intent: 'dark trap',
      energy: 0.8,
      darkness: 0.9,
      bounce: 0.6,
      warmth: 0.3,
      texture: 'gritty' as const,
      references: [],
      avoid: [],
      seed: 42,
      confidence: 0.8,
    },
    warnings: [],
    message: 'Valid',
  }

  it('accepts a valid response', () => {
    const result = StyleValidationResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('requires valid boolean field', () => {
    const result = StyleValidationResponseSchema.safeParse({ ...validResponse, valid: 'yes' })
    expect(result.success).toBe(false)
  })

  it('requires message field', () => {
    const { message: _omitted, ...withoutMessage } = validResponse
    const result = StyleValidationResponseSchema.safeParse(withoutMessage)
    expect(result.success).toBe(false)
  })

  it('defaults warnings to empty array', () => {
    const { warnings: _omitted, ...withoutWarnings } = validResponse
    const result = StyleValidationResponseSchema.safeParse(withoutWarnings)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.warnings).toEqual([])
    }
  })
})

// ===========================================================================
// AudioArrangementWithStyleSchema
// ===========================================================================

describe('AudioArrangementWithStyleSchema', () => {
  const validArrangement = {
    loop_id: 5,
    target_seconds: 60,
    style_profile: {
      intent: 'dark trap',
      energy: 0.8,
      darkness: 0.9,
      bounce: 0.6,
      warmth: 0.3,
      texture: 'gritty' as const,
      references: [],
      avoid: [],
      seed: 42,
      confidence: 0.8,
    },
  }

  it('accepts a valid arrangement request', () => {
    const result = AudioArrangementWithStyleSchema.safeParse(validArrangement)
    expect(result.success).toBe(true)
  })

  it('requires loop_id to be a positive integer', () => {
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, loop_id: 0 }).success).toBe(false)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, loop_id: -1 }).success).toBe(false)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, loop_id: 1.5 }).success).toBe(false)
  })

  it('requires target_seconds minimum of 10', () => {
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, target_seconds: 9 }).success).toBe(false)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, target_seconds: 10 }).success).toBe(true)
  })

  it('requires target_seconds maximum of 3600', () => {
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, target_seconds: 3601 }).success).toBe(false)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, target_seconds: 3600 }).success).toBe(true)
  })

  it('defaults use_ai_parsing to false', () => {
    const result = AudioArrangementWithStyleSchema.safeParse(validArrangement)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.use_ai_parsing).toBe(false)
    }
  })

  it('defaults include_stems to false', () => {
    const result = AudioArrangementWithStyleSchema.safeParse(validArrangement)
    if (result.success) {
      expect(result.data.include_stems).toBe(false)
    }
  })

  it('defaults variation_count to 1', () => {
    const result = AudioArrangementWithStyleSchema.safeParse(validArrangement)
    if (result.success) {
      expect(result.data.variation_count).toBe(1)
    }
  })

  it('rejects variation_count outside 1-3', () => {
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, variation_count: 0 }).success).toBe(false)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, variation_count: 4 }).success).toBe(false)
  })

  it('accepts variation_count of 2 and 3', () => {
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, variation_count: 2 }).success).toBe(true)
    expect(AudioArrangementWithStyleSchema.safeParse({ ...validArrangement, variation_count: 3 }).success).toBe(true)
  })
})
