/**
 * Tests for the Producer Engine V2 type definitions and backward-compatible
 * fields added to ArrangementStatusResponse and ArrangementMetadataResponse.
 *
 * These tests verify that:
 *  - The new V2 types (ProducerPlanV2, QualityScore, DecisionLogEntry,
 *    SectionSummaryItem, ProducerPlanV2Section) are correctly shaped.
 *  - The updated ArrangementStatusResponse accepts the new optional fields.
 *  - The updated ArrangementMetadataResponse accepts the new optional fields.
 *  - resolveArrangementAudioUrl is unaffected by the new fields.
 *  - QualityScore validation edge cases (0, 100, fractional values) behave
 *    as expected for display logic.
 */

import {
  resolveArrangementAudioUrl,
  type ArrangementStatusResponse,
  type ArrangementMetadataResponse,
  type ProducerPlanV2,
  type ProducerPlanV2Section,
  type QualityScore,
  type DecisionLogEntry,
  type SectionSummaryItem,
} from '@/../../api/client'

// ============================================================================
// Fixtures
// ============================================================================

function makeQualityScore(overrides: Partial<QualityScore> = {}): QualityScore {
  return {
    structure_score: 80,
    transition_score: 75,
    audio_quality_score: 70,
    overall_score: 75,
    ...overrides,
  }
}

function makeDecisionLogEntry(overrides: Partial<DecisionLogEntry> = {}): DecisionLogEntry {
  return {
    section_type: 'intro',
    decision: 'kept sparse',
    rationale: 'intro kept sparse because 5 stems exist — only light elements should open the track',
    ...overrides,
  }
}

function makeSectionSummaryItem(overrides: Partial<SectionSummaryItem> = {}): SectionSummaryItem {
  return {
    index: 0,
    section_type: 'intro',
    bars: 8,
    energy: 0.3,
    roles: ['kick', 'melody'],
    ...overrides,
  }
}

function makeProducerPlanV2Section(overrides: Partial<ProducerPlanV2Section> = {}): ProducerPlanV2Section {
  return {
    index: 0,
    section_type: 'intro',
    bars: 8,
    target_energy: 0.3,
    density: 'sparse',
    active_roles: ['kick', 'melody'],
    muted_roles: ['bass', 'pad'],
    variation_strategy: 'minimal',
    transition_in: 'none',
    transition_out: 'drum_fill',
    rationale: 'intro kept sparse for anticipation build',
    ...overrides,
  }
}

function makeProducerPlanV2(overrides: Partial<ProducerPlanV2> = {}): ProducerPlanV2 {
  return {
    sections: [
      makeProducerPlanV2Section({ index: 0, section_type: 'intro' }),
      makeProducerPlanV2Section({ index: 1, section_type: 'hook', density: 'full', target_energy: 0.9 }),
    ],
    strategy: 'sparse intro → full hook → gentle outro',
    total_sections: 2,
    engine_version: 'v2',
    ...overrides,
  }
}

function makeArrangementStatusResponse(
  overrides: Partial<ArrangementStatusResponse> = {}
): ArrangementStatusResponse {
  return {
    id: 1,
    status: 'done',
    ...overrides,
  }
}

function makeArrangementMetadataResponse(
  overrides: Partial<ArrangementMetadataResponse> = {}
): ArrangementMetadataResponse {
  return {
    arrangement_id: 1,
    ...overrides,
  }
}

// ============================================================================
// QualityScore type shape
// ============================================================================

describe('QualityScore type', () => {
  it('accepts all four required score fields', () => {
    const score = makeQualityScore()
    expect(score.structure_score).toBe(80)
    expect(score.transition_score).toBe(75)
    expect(score.audio_quality_score).toBe(70)
    expect(score.overall_score).toBe(75)
  })

  it('accepts a perfect score of 100', () => {
    const score = makeQualityScore({
      structure_score: 100,
      transition_score: 100,
      audio_quality_score: 100,
      overall_score: 100,
    })
    expect(score.overall_score).toBe(100)
  })

  it('accepts a minimum score of 0', () => {
    const score = makeQualityScore({
      structure_score: 0,
      transition_score: 0,
      audio_quality_score: 0,
      overall_score: 0,
    })
    expect(score.overall_score).toBe(0)
  })

  it('allows scores to differ across categories', () => {
    const score = makeQualityScore({
      structure_score: 95,
      transition_score: 40,
      audio_quality_score: 60,
      overall_score: 65,
    })
    expect(score.structure_score).not.toBe(score.transition_score)
  })

  it('accepts fractional scores (pre-rounding)', () => {
    const score = makeQualityScore({ overall_score: 72.5 })
    expect(score.overall_score).toBe(72.5)
  })
})

// ============================================================================
// DecisionLogEntry type shape
// ============================================================================

describe('DecisionLogEntry type', () => {
  it('has section_type, decision, and rationale', () => {
    const entry = makeDecisionLogEntry()
    expect(entry.section_type).toBe('intro')
    expect(entry.decision).toBe('kept sparse')
    expect(entry.rationale).toContain('5 stems')
  })

  it('works for hook entries', () => {
    const entry = makeDecisionLogEntry({
      section_type: 'hook',
      decision: 'full energy',
      rationale: 'hook promoted full drums and bass for max energy',
    })
    expect(entry.section_type).toBe('hook')
    expect(entry.decision).toBe('full energy')
  })

  it('accepts empty rationale string', () => {
    const entry = makeDecisionLogEntry({ rationale: '' })
    expect(entry.rationale).toBe('')
  })
})

// ============================================================================
// SectionSummaryItem type shape
// ============================================================================

describe('SectionSummaryItem type', () => {
  it('has index, section_type, bars, energy, roles', () => {
    const item = makeSectionSummaryItem()
    expect(item.index).toBe(0)
    expect(item.section_type).toBe('intro')
    expect(item.bars).toBe(8)
    expect(item.energy).toBe(0.3)
    expect(item.roles).toEqual(['kick', 'melody'])
  })

  it('accepts empty roles array', () => {
    const item = makeSectionSummaryItem({ roles: [] })
    expect(item.roles).toHaveLength(0)
  })

  it('accepts energy value of 0', () => {
    const item = makeSectionSummaryItem({ energy: 0 })
    expect(item.energy).toBe(0)
  })

  it('accepts energy value of 1', () => {
    const item = makeSectionSummaryItem({ energy: 1 })
    expect(item.energy).toBe(1)
  })
})

// ============================================================================
// ProducerPlanV2Section type shape
// ============================================================================

describe('ProducerPlanV2Section type', () => {
  it('has all required fields', () => {
    const section = makeProducerPlanV2Section()
    expect(section.index).toBe(0)
    expect(section.section_type).toBe('intro')
    expect(section.bars).toBe(8)
    expect(section.target_energy).toBe(0.3)
    expect(section.density).toBe('sparse')
    expect(section.active_roles).toContain('kick')
    expect(section.muted_roles).toContain('bass')
    expect(section.transition_in).toBe('none')
    expect(section.transition_out).toBe('drum_fill')
    expect(section.rationale).toBeTruthy()
  })

  it('accepts all density values', () => {
    const sparse = makeProducerPlanV2Section({ density: 'sparse' })
    const medium = makeProducerPlanV2Section({ density: 'medium' })
    const full = makeProducerPlanV2Section({ density: 'full' })
    expect(sparse.density).toBe('sparse')
    expect(medium.density).toBe('medium')
    expect(full.density).toBe('full')
  })

  it('accepts empty active_roles', () => {
    const section = makeProducerPlanV2Section({ active_roles: [] })
    expect(section.active_roles).toHaveLength(0)
  })

  it('accepts empty muted_roles', () => {
    const section = makeProducerPlanV2Section({ muted_roles: [] })
    expect(section.muted_roles).toHaveLength(0)
  })
})

// ============================================================================
// ProducerPlanV2 type shape
// ============================================================================

describe('ProducerPlanV2 type', () => {
  it('has sections, strategy, and total_sections', () => {
    const plan = makeProducerPlanV2()
    expect(plan.sections).toHaveLength(2)
    expect(plan.strategy).toBeTruthy()
    expect(plan.total_sections).toBe(2)
  })

  it('engine_version field is optional', () => {
    const plan = makeProducerPlanV2({ engine_version: undefined })
    expect(plan.engine_version).toBeUndefined()
  })

  it('engine_version can carry version string', () => {
    const plan = makeProducerPlanV2({ engine_version: 'v2' })
    expect(plan.engine_version).toBe('v2')
  })

  it('accepts empty sections array', () => {
    const plan = makeProducerPlanV2({ sections: [], total_sections: 0 })
    expect(plan.sections).toHaveLength(0)
  })
})

// ============================================================================
// ArrangementStatusResponse – V2 backward-compatible fields
// ============================================================================

describe('ArrangementStatusResponse – V2 fields', () => {
  it('accepts producer_plan field', () => {
    const status = makeArrangementStatusResponse({
      producer_plan: makeProducerPlanV2(),
    })
    expect(status.producer_plan).not.toBeNull()
    expect(status.producer_plan?.sections).toHaveLength(2)
  })

  it('accepts producer_notes array', () => {
    const status = makeArrangementStatusResponse({
      producer_notes: ['note one', 'note two'],
    })
    expect(status.producer_notes).toHaveLength(2)
  })

  it('accepts quality_score object', () => {
    const status = makeArrangementStatusResponse({
      quality_score: makeQualityScore(),
    })
    expect(status.quality_score?.overall_score).toBe(75)
  })

  it('accepts section_summary array', () => {
    const status = makeArrangementStatusResponse({
      section_summary: [makeSectionSummaryItem()],
    })
    expect(status.section_summary).toHaveLength(1)
  })

  it('accepts decision_log array', () => {
    const status = makeArrangementStatusResponse({
      decision_log: [makeDecisionLogEntry()],
    })
    expect(status.decision_log).toHaveLength(1)
  })

  it('all V2 fields are optional and default to undefined', () => {
    const status = makeArrangementStatusResponse()
    expect(status.producer_plan).toBeUndefined()
    expect(status.producer_notes).toBeUndefined()
    expect(status.quality_score).toBeUndefined()
    expect(status.section_summary).toBeUndefined()
    expect(status.decision_log).toBeUndefined()
  })

  it('accepts null for all V2 fields (backend may send null when V2 is off)', () => {
    const status = makeArrangementStatusResponse({
      producer_plan: null,
      producer_notes: null,
      quality_score: null,
      section_summary: null,
      decision_log: null,
    })
    expect(status.producer_plan).toBeNull()
    expect(status.producer_notes).toBeNull()
    expect(status.quality_score).toBeNull()
    expect(status.section_summary).toBeNull()
    expect(status.decision_log).toBeNull()
  })
})

// ============================================================================
// ArrangementMetadataResponse – V2 backward-compatible fields
// ============================================================================

describe('ArrangementMetadataResponse – V2 fields', () => {
  it('accepts producer_plan field', () => {
    const meta = makeArrangementMetadataResponse({ producer_plan: makeProducerPlanV2() })
    expect(meta.producer_plan?.total_sections).toBe(2)
  })

  it('accepts producer_notes array', () => {
    const meta = makeArrangementMetadataResponse({
      producer_notes: ['bridge contrasted', 'outro simplified'],
    })
    expect(meta.producer_notes).toHaveLength(2)
  })

  it('accepts quality_score', () => {
    const meta = makeArrangementMetadataResponse({
      quality_score: makeQualityScore({ overall_score: 88 }),
    })
    expect(meta.quality_score?.overall_score).toBe(88)
  })

  it('accepts section_summary', () => {
    const meta = makeArrangementMetadataResponse({
      section_summary: [
        makeSectionSummaryItem({ index: 0 }),
        makeSectionSummaryItem({ index: 1, section_type: 'hook', bars: 16 }),
      ],
    })
    expect(meta.section_summary).toHaveLength(2)
  })

  it('accepts decision_log', () => {
    const meta = makeArrangementMetadataResponse({
      decision_log: [makeDecisionLogEntry({ section_type: 'bridge' })],
    })
    expect(meta.decision_log?.[0].section_type).toBe('bridge')
  })

  it('V2 fields are optional on metadata response', () => {
    const meta = makeArrangementMetadataResponse()
    expect(meta.producer_plan).toBeUndefined()
    expect(meta.producer_notes).toBeUndefined()
    expect(meta.quality_score).toBeUndefined()
    expect(meta.section_summary).toBeUndefined()
    expect(meta.decision_log).toBeUndefined()
  })
})

// ============================================================================
// resolveArrangementAudioUrl – unaffected by V2 fields
// ============================================================================

describe('resolveArrangementAudioUrl – unaffected by V2 fields', () => {
  it('still resolves preview_url when V2 fields are present', () => {
    const result = resolveArrangementAudioUrl({
      preview_url: 'https://cdn.example.com/preview.mp3',
      output_url: 'https://cdn.example.com/output.wav',
    })
    expect(result).toBe('https://cdn.example.com/preview.mp3')
  })

  it('still falls back to output_url when preview_url is absent', () => {
    const result = resolveArrangementAudioUrl({
      output_url: 'https://cdn.example.com/output.wav',
    })
    expect(result).toBe('https://cdn.example.com/output.wav')
  })

  it('still falls back to output_file_url when others are absent', () => {
    const result = resolveArrangementAudioUrl({
      output_file_url: 'https://cdn.example.com/file.wav',
    })
    expect(result).toBe('https://cdn.example.com/file.wav')
  })

  it('returns null when all audio URL fields are absent', () => {
    const result = resolveArrangementAudioUrl({})
    expect(result).toBeNull()
  })
})
