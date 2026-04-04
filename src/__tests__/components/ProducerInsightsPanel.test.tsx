/**
 * Tests for the ProducerInsightsPanel component.
 *
 * Covers:
 *  - Returns null / renders nothing when no data is provided
 *  - Quality score section: rendering, color classes, label text, score bars
 *  - Section summary: rendering items, bars, energy, roles
 *  - Decision log: rendering entries, decision text, rationale
 *  - Producer notes: rendering notes list
 *  - Producer plan V2: rendering sections, density badges, transitions, rationale
 *  - Collapse/expand behaviour for each collapsible section
 *  - Edge cases: empty arrays, null vs undefined, scores at boundary values
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProducerInsightsPanel } from '@/components/ProducerInsightsPanel'
import type {
  ProducerPlanV2,
  QualityScore,
  DecisionLogEntry,
  SectionSummaryItem,
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

const sampleSectionSummary: SectionSummaryItem[] = [
  { index: 0, section_type: 'intro', bars: 8, energy: 0.3, roles: ['kick', 'melody'] },
  { index: 1, section_type: 'hook', bars: 16, energy: 0.9, roles: ['kick', 'bass', 'pad'] },
]

const sampleDecisionLog: DecisionLogEntry[] = [
  {
    section_type: 'intro',
    decision: 'kept sparse',
    rationale: 'Only light elements should open the track',
  },
  {
    section_type: 'hook',
    decision: 'full energy',
    rationale: 'Hook promoted full drums and bass for max energy',
  },
]

const sampleProducerNotes: string[] = [
  'Intro kept sparse because 5 stems exist',
  'Hook elevated for maximum energy impact',
  'Bridge stripped to create contrast',
]

const sampleProducerPlan: ProducerPlanV2 = {
  sections: [
    {
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
      rationale: 'Intro kept sparse for anticipation build',
    },
    {
      index: 1,
      section_type: 'hook',
      bars: 16,
      target_energy: 0.9,
      density: 'full',
      active_roles: ['kick', 'bass', 'pad', 'melody'],
      muted_roles: [],
      variation_strategy: 'full_energy',
      transition_in: 'fx_rise',
      transition_out: 'none',
      rationale: 'Hook gets full energy for maximum impact',
    },
  ],
  strategy: 'sparse intro → full hook → gentle outro',
  total_sections: 2,
  engine_version: 'v2',
}

// ============================================================================
// Rendering: no data
// ============================================================================

describe('ProducerInsightsPanel – no data', () => {
  it('renders nothing when all props are null', () => {
    const { container } = render(
      <ProducerInsightsPanel
        producerPlan={null}
        producerNotes={null}
        qualityScore={null}
        sectionSummary={null}
        decisionLog={null}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all props are undefined', () => {
    const { container } = render(<ProducerInsightsPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when arrays are empty', () => {
    const { container } = render(
      <ProducerInsightsPanel
        producerNotes={[]}
        sectionSummary={[]}
        decisionLog={[]}
        producerPlan={{ sections: [], strategy: '', total_sections: 0 }}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when only producerNotes is provided as empty array', () => {
    const { container } = render(<ProducerInsightsPanel producerNotes={[]} />)
    expect(container.firstChild).toBeNull()
  })
})

// ============================================================================
// Quality Score panel
// ============================================================================

describe('ProducerInsightsPanel – quality score', () => {
  it('renders the quality score section when qualityScore is provided', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByText('Quality Score')).toBeInTheDocument()
  })

  it('displays the overall_score value', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 75 })} />)
    expect(screen.getByTestId('overall-score')).toHaveTextContent('75')
  })

  it('shows "Excellent" label for score >= 90', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 92 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Excellent')
  })

  it('shows "Good" label for score 70–89', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 75 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Good')
  })

  it('shows "Fair" label for score 40–69', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 55 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Fair')
  })

  it('shows "Poor" label for score < 40', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 30 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Poor')
  })

  it('shows "Poor" label at score 0', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 0 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Poor')
  })

  it('shows "Excellent" label at score 100', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 100 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Excellent')
  })

  it('shows "Fair" label at boundary score 40', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 40 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Fair')
  })

  it('shows "Good" label at boundary score 70', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 70 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Good')
  })

  it('shows "Excellent" label at boundary score 90', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 90 })} />)
    expect(screen.getByTestId('quality-label')).toHaveTextContent('Excellent')
  })

  it('renders Structure score bar label', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByText('Structure')).toBeInTheDocument()
  })

  it('renders Transitions score bar label', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByText('Transitions')).toBeInTheDocument()
  })

  it('renders Audio Quality score bar label', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByText('Audio Quality')).toBeInTheDocument()
  })

  it('does not render quality score section when qualityScore is null', () => {
    render(<ProducerInsightsPanel qualityScore={null} producerNotes={['a note']} />)
    expect(screen.queryByText('Quality Score')).not.toBeInTheDocument()
  })

  it('renders the panel container when qualityScore is provided', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByTestId('producer-insights-panel')).toBeInTheDocument()
  })

  it('quality score section is expanded by default', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 80 })} />)
    expect(screen.getByTestId('overall-score')).toBeVisible()
  })

  it('collapses quality score when header is clicked', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    const button = screen.getByRole('button', { name: /quality score/i })
    fireEvent.click(button)
    expect(screen.queryByTestId('overall-score')).not.toBeInTheDocument()
  })

  it('expands quality score again after second click', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 88 })} />)
    const button = screen.getByRole('button', { name: /quality score/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.getByTestId('overall-score')).toHaveTextContent('88')
  })
})

// ============================================================================
// Section Summary panel
// ============================================================================

describe('ProducerInsightsPanel – section summary', () => {
  it('renders the section summary heading', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    expect(screen.getByText('Section Summary')).toBeInTheDocument()
  })

  it('renders one item per section', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    const items = screen.getAllByTestId('section-summary-item')
    expect(items).toHaveLength(2)
  })

  it('renders section_type text', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    expect(screen.getByText('intro')).toBeInTheDocument()
    expect(screen.getByText('hook')).toBeInTheDocument()
  })

  it('renders bar counts', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    expect(screen.getByText('8b')).toBeInTheDocument()
    expect(screen.getByText('16b')).toBeInTheDocument()
  })

  it('renders role badges for sections with roles', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    expect(screen.getAllByText('kick').length).toBeGreaterThan(0)
  })

  it('does not render section summary when sectionSummary is null', () => {
    render(<ProducerInsightsPanel sectionSummary={null} producerNotes={['note']} />)
    expect(screen.queryByText('Section Summary')).not.toBeInTheDocument()
  })

  it('collapses section summary when header is clicked', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    const button = screen.getByRole('button', { name: /section summary/i })
    fireEvent.click(button)
    expect(screen.queryAllByTestId('section-summary-item')).toHaveLength(0)
  })

  it('truncates roles beyond 3 with a +N indicator', () => {
    const manySections: SectionSummaryItem[] = [
      { index: 0, section_type: 'chorus', bars: 16, energy: 0.9, roles: ['kick', 'bass', 'pad', 'melody', 'vocal'] },
    ]
    render(<ProducerInsightsPanel sectionSummary={manySections} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})

// ============================================================================
// Decision Log panel
// ============================================================================

describe('ProducerInsightsPanel – decision log', () => {
  it('renders the Decision Log heading', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    expect(screen.getByText('Decision Log')).toBeInTheDocument()
  })

  it('renders one entry per decision', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    const entries = screen.getAllByTestId('decision-log-entry')
    expect(entries).toHaveLength(2)
  })

  it('renders section_type badges', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    expect(screen.getAllByText('intro').length).toBeGreaterThan(0)
    expect(screen.getAllByText('hook').length).toBeGreaterThan(0)
  })

  it('renders decision text', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    expect(screen.getByText('kept sparse')).toBeInTheDocument()
    expect(screen.getByText('full energy')).toBeInTheDocument()
  })

  it('renders rationale text', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    expect(screen.getByText(/Only light elements should open/)).toBeInTheDocument()
  })

  it('does not render decision log when decisionLog is null', () => {
    render(<ProducerInsightsPanel decisionLog={null} producerNotes={['note']} />)
    expect(screen.queryByText('Decision Log')).not.toBeInTheDocument()
  })

  it('decision log is collapsed by default', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    expect(screen.queryAllByTestId('decision-log-entry')).toHaveLength(0)
  })

  it('expands decision log when header is clicked', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    expect(screen.getAllByTestId('decision-log-entry')).toHaveLength(2)
  })

  it('collapses decision log after second click', () => {
    render(<ProducerInsightsPanel decisionLog={sampleDecisionLog} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.queryAllByTestId('decision-log-entry')).toHaveLength(0)
  })

  it('renders entries with empty rationale without crashing', () => {
    const log: DecisionLogEntry[] = [{ section_type: 'bridge', decision: 'stripped', rationale: '' }]
    render(<ProducerInsightsPanel decisionLog={log} />)
    const button = screen.getByRole('button', { name: /decision log/i })
    fireEvent.click(button)
    expect(screen.getByText('stripped')).toBeInTheDocument()
  })
})

// ============================================================================
// Producer Notes panel
// ============================================================================

describe('ProducerInsightsPanel – producer notes', () => {
  it('renders the Producer Notes heading', () => {
    render(<ProducerInsightsPanel producerNotes={sampleProducerNotes} />)
    expect(screen.getByText('Producer Notes')).toBeInTheDocument()
  })

  it('renders each note in the list', () => {
    render(<ProducerInsightsPanel producerNotes={sampleProducerNotes} />)
    const button = screen.getByRole('button', { name: /producer notes/i })
    fireEvent.click(button)
    const notes = screen.getAllByTestId('producer-note')
    expect(notes).toHaveLength(3)
  })

  it('renders note text content', () => {
    render(<ProducerInsightsPanel producerNotes={sampleProducerNotes} />)
    const button = screen.getByRole('button', { name: /producer notes/i })
    fireEvent.click(button)
    expect(screen.getByText('Intro kept sparse because 5 stems exist')).toBeInTheDocument()
  })

  it('does not render producer notes when producerNotes is null', () => {
    render(<ProducerInsightsPanel producerNotes={null} qualityScore={makeQualityScore()} />)
    expect(screen.queryByText('Producer Notes')).not.toBeInTheDocument()
  })

  it('producer notes is collapsed by default', () => {
    render(<ProducerInsightsPanel producerNotes={sampleProducerNotes} />)
    expect(screen.queryAllByTestId('producer-note')).toHaveLength(0)
  })

  it('expands notes on click', () => {
    render(<ProducerInsightsPanel producerNotes={['Single note']} />)
    const button = screen.getByRole('button', { name: /producer notes/i })
    fireEvent.click(button)
    expect(screen.getByTestId('producer-note')).toBeInTheDocument()
  })

  it('renders single note correctly', () => {
    render(<ProducerInsightsPanel producerNotes={['Only note']} />)
    const button = screen.getByRole('button', { name: /producer notes/i })
    fireEvent.click(button)
    expect(screen.getByText('Only note')).toBeInTheDocument()
  })
})

// ============================================================================
// Producer Plan V2 panel
// ============================================================================

describe('ProducerInsightsPanel – producer plan', () => {
  it('renders the Producer Plan heading', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    expect(screen.getByText('Producer Plan')).toBeInTheDocument()
  })

  it('producer plan is collapsed by default', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    expect(screen.queryAllByTestId('producer-plan-section')).toHaveLength(0)
  })

  it('expands producer plan on click', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getAllByTestId('producer-plan-section')).toHaveLength(2)
  })

  it('renders strategy text', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getByText(/sparse intro → full hook/)).toBeInTheDocument()
  })

  it('renders density badges for each section', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getByText('sparse')).toBeInTheDocument()
    expect(screen.getByText('full')).toBeInTheDocument()
  })

  it('renders active_roles as badges', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getAllByText('kick').length).toBeGreaterThan(0)
    expect(screen.getAllByText('bass').length).toBeGreaterThan(0)
  })

  it('renders transition_out info when not none', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getByText(/drum fill/i)).toBeInTheDocument()
  })

  it('renders transition_in info when not none', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getByText(/fx rise/i)).toBeInTheDocument()
  })

  it('renders rationale for each section', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    expect(screen.getByText('Intro kept sparse for anticipation build')).toBeInTheDocument()
  })

  it('does not render producer plan when producerPlan is null', () => {
    render(<ProducerInsightsPanel producerPlan={null} producerNotes={['a note']} />)
    expect(screen.queryByText('Producer Plan')).not.toBeInTheDocument()
  })

  it('collapses producer plan after second click', () => {
    render(<ProducerInsightsPanel producerPlan={sampleProducerPlan} />)
    const button = screen.getByRole('button', { name: /producer plan/i })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(screen.queryAllByTestId('producer-plan-section')).toHaveLength(0)
  })
})

// ============================================================================
// Full data rendering
// ============================================================================

describe('ProducerInsightsPanel – full data', () => {
  it('renders all sections when all data is provided', () => {
    render(
      <ProducerInsightsPanel
        qualityScore={makeQualityScore()}
        sectionSummary={sampleSectionSummary}
        decisionLog={sampleDecisionLog}
        producerNotes={sampleProducerNotes}
        producerPlan={sampleProducerPlan}
      />
    )
    expect(screen.getByText('Quality Score')).toBeInTheDocument()
    expect(screen.getByText('Section Summary')).toBeInTheDocument()
    expect(screen.getByText('Decision Log')).toBeInTheDocument()
    expect(screen.getByText('Producer Notes')).toBeInTheDocument()
    expect(screen.getByText('Producer Plan')).toBeInTheDocument()
  })

  it('renders the panel heading "Producer Engine V2"', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore()} />)
    expect(screen.getByText('Producer Engine V2')).toBeInTheDocument()
  })

  it('renders panel with only quality score data', () => {
    render(<ProducerInsightsPanel qualityScore={makeQualityScore({ overall_score: 82 })} />)
    expect(screen.getByTestId('producer-insights-panel')).toBeInTheDocument()
    expect(screen.queryByText('Section Summary')).not.toBeInTheDocument()
  })

  it('renders panel with only section summary data', () => {
    render(<ProducerInsightsPanel sectionSummary={sampleSectionSummary} />)
    expect(screen.getByTestId('producer-insights-panel')).toBeInTheDocument()
    expect(screen.queryByText('Quality Score')).not.toBeInTheDocument()
  })
})
