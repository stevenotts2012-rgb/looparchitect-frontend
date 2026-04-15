/**
 * Tests for ArrangementTimeline component.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ArrangementTimeline } from '@/components/ArrangementTimeline'

const SECTIONS = [
  { name: 'Intro', bar_start: 0, bars: 8, energy: 0.3, instruments: ['kick', 'bass'] },
  { name: 'Verse', bar_start: 8, bars: 16, energy: 0.5 },
  { name: 'Hook', bar_start: 24, bars: 8, energy: 0.9, instruments: ['kick', 'bass', 'melody', 'pad', 'synth'] },
  { name: 'Outro', bar_start: 32, bars: 8, energy: 0.2 },
]

describe('ArrangementTimeline – empty state', () => {
  it('shows "No arrangement data available" when sections is empty', () => {
    render(<ArrangementTimeline sections={[]} />)
    expect(screen.getByText(/No arrangement data available/i)).toBeInTheDocument()
  })
})

describe('ArrangementTimeline – rendering', () => {
  it('renders the timeline heading', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    expect(screen.getByText(/Arrangement Timeline/i)).toBeInTheDocument()
  })

  it('shows total bars count', () => {
    render(<ArrangementTimeline sections={SECTIONS} totalBars={40} />)
    expect(screen.getByText(/40 bars/i)).toBeInTheDocument()
  })

  it('shows tempo', () => {
    render(<ArrangementTimeline sections={SECTIONS} tempo={140} />)
    expect(screen.getByText(/140 BPM/i)).toBeInTheDocument()
  })

  it('shows total seconds', () => {
    render(<ArrangementTimeline sections={SECTIONS} totalSeconds={60.5} />)
    expect(screen.getByText(/60\.5s/)).toBeInTheDocument()
  })

  it('renders section names', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    // Names may appear both in the timeline and the legend – getAllByText handles duplicates
    expect(screen.getAllByText('Intro').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Verse').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hook').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Outro').length).toBeGreaterThanOrEqual(1)
  })

  it('renders bar counts for each section', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    // Three sections have 8 bars; one has 16 – getAllByText covers the multiple matches
    const eightBarCounts = screen.getAllByText('8b')
    expect(eightBarCounts.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('16b')).toBeInTheDocument()
  })

  it('renders energy percentages', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('renders instruments for sections that have them', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    // Multiple sections have instruments – check at least one element shows the kick, bass pair
    const items = screen.getAllByText(/kick, bass/)
    expect(items.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "+N" for sections with more than 4 instruments', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    // Hook has 5 instruments: kick, bass, melody, pad, synth → should show "+1"
    expect(screen.getByText(/\+1/)).toBeInTheDocument()
  })

  it('does not show instruments line for sections without instruments', () => {
    render(<ArrangementTimeline sections={[{ name: 'Verse', bar_start: 0, bars: 8, energy: 0.5 }]} />)
    // No instruments key at all – no 🎵 prefix
    expect(screen.queryByText(/🎵/)).not.toBeInTheDocument()
  })
})

describe('ArrangementTimeline – legend', () => {
  it('renders the legend section', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    expect(screen.getByText('Legend:')).toBeInTheDocument()
  })

  it('shows known section types in legend', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    // Legend should include Intro, Verse, Hook, etc.
    const legendItems = screen.getAllByText('Intro')
    expect(legendItems.length).toBeGreaterThan(0)
  })
})

describe('ArrangementTimeline – color mapping', () => {
  it('renders sections with unknown names without crashing', () => {
    const sections = [{ name: 'CustomSection', bar_start: 0, bars: 8, energy: 0.5 }]
    expect(() => render(<ArrangementTimeline sections={sections} />)).not.toThrow()
  })

  it('renders all standard section types without crashing', () => {
    const standardSections = ['Intro', 'Verse', 'Hook', 'Chorus', 'Bridge', 'Breakdown', 'Outro'].map(
      (name, i) => ({ name, bar_start: i * 8, bars: 8, energy: 0.5 })
    )
    expect(() => render(<ArrangementTimeline sections={standardSections} totalBars={56} />)).not.toThrow()
  })
})

describe('ArrangementTimeline – default props', () => {
  it('uses default totalBars=96 when not provided', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    expect(screen.getByText(/96 bars/i)).toBeInTheDocument()
  })

  it('uses default tempo=120 when not provided', () => {
    render(<ArrangementTimeline sections={SECTIONS} />)
    expect(screen.getByText(/120 BPM/i)).toBeInTheDocument()
  })
})
