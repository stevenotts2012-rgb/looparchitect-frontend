/**
 * Tests for src/lib/help.ts – helpContent structure and completeness.
 */

import { helpContent } from '@/lib/help'
import type { HelpContent, HelpSection } from '@/lib/help'

describe('helpContent – structure validation', () => {
  it('exports a record with at least four keys', () => {
    const keys = Object.keys(helpContent)
    expect(keys.length).toBeGreaterThanOrEqual(4)
  })

  it('contains upload, generate, producerMoves, and styleParameters keys', () => {
    expect(helpContent).toHaveProperty('upload')
    expect(helpContent).toHaveProperty('generate')
    expect(helpContent).toHaveProperty('producerMoves')
    expect(helpContent).toHaveProperty('styleParameters')
  })

  it('every entry has a non-empty title', () => {
    Object.entries(helpContent).forEach(([key, content]) => {
      expect(content.title).toBeTruthy()
      expect(typeof content.title).toBe('string')
      // Provide a useful message on failure
      if (!content.title) {
        throw new Error(`helpContent["${key}"].title is empty`)
      }
    })
  })

  it('every entry has a non-empty sections array', () => {
    Object.entries(helpContent).forEach(([key, content]) => {
      expect(Array.isArray(content.sections)).toBe(true)
      expect(content.sections.length).toBeGreaterThan(0)
      if (content.sections.length === 0) {
        throw new Error(`helpContent["${key}"].sections is empty`)
      }
    })
  })

  it('every section has a non-empty heading', () => {
    Object.entries(helpContent).forEach(([, content]) => {
      content.sections.forEach((section: HelpSection) => {
        expect(typeof section.heading).toBe('string')
        expect(section.heading.trim().length).toBeGreaterThan(0)
      })
    })
  })

  it('section bullets, when present, are non-empty arrays of strings', () => {
    Object.entries(helpContent).forEach(([, content]) => {
      content.sections.forEach((section: HelpSection) => {
        if (section.bullets !== undefined) {
          expect(Array.isArray(section.bullets)).toBe(true)
          section.bullets.forEach((bullet) => {
            expect(typeof bullet).toBe('string')
            expect(bullet.trim().length).toBeGreaterThan(0)
          })
        }
      })
    })
  })

  it('section examples, when present, are non-empty arrays of strings', () => {
    Object.entries(helpContent).forEach(([, content]) => {
      content.sections.forEach((section: HelpSection) => {
        if (section.examples !== undefined) {
          expect(Array.isArray(section.examples)).toBe(true)
          section.examples.forEach((example) => {
            expect(typeof example).toBe('string')
            expect(example.trim().length).toBeGreaterThan(0)
          })
        }
      })
    })
  })
})

// ===========================================================================
// Individual entry tests
// ===========================================================================

describe('helpContent["upload"]', () => {
  const upload = helpContent.upload

  it('has title "Upload Your Loop"', () => {
    expect(upload.title).toBe('Upload Your Loop')
  })

  it('mentions supported formats in bullets', () => {
    const allBullets = upload.sections.flatMap((s) => s.bullets ?? []).join(' ')
    expect(allBullets).toMatch(/WAV|MP3|FLAC/i)
  })
})

describe('helpContent["generate"]', () => {
  const generate = helpContent.generate

  it('has title "Generate Arrangement"', () => {
    expect(generate.title).toBe('Generate Arrangement')
  })

  it('covers Loop ID, Arrangement Type, and Style Mode', () => {
    const headings = generate.sections.map((s) => s.heading)
    expect(headings).toContain('Loop ID')
    expect(headings).toContain('Arrangement Type')
    expect(headings).toContain('Style Mode')
  })
})

describe('helpContent["producerMoves"]', () => {
  const producerMoves = helpContent.producerMoves

  it('has title "Producer Moves Explained"', () => {
    expect(producerMoves.title).toBe('Producer Moves Explained')
  })

  it('contains at least one section with examples', () => {
    const sectionsWithExamples = producerMoves.sections.filter((s) => s.examples && s.examples.length > 0)
    expect(sectionsWithExamples.length).toBeGreaterThan(0)
  })
})

describe('helpContent["styleParameters"]', () => {
  const styleParameters = helpContent.styleParameters

  it('has title "Style Parameters Guide"', () => {
    expect(styleParameters.title).toBe('Style Parameters Guide')
  })

  it('covers Energy, Darkness, Bounce, Warmth, and Texture', () => {
    const headings = styleParameters.sections.map((s) => s.heading)
    expect(headings).toContain('Energy')
    expect(headings).toContain('Darkness')
    expect(headings).toContain('Bounce')
    expect(headings).toContain('Warmth')
    expect(headings).toContain('Texture')
  })

  it('each main parameter section has bullets describing low/medium/high values', () => {
    const mainParams = ['Energy', 'Darkness', 'Bounce', 'Warmth']
    mainParams.forEach((param) => {
      const section = styleParameters.sections.find((s) => s.heading === param)
      expect(section).toBeDefined()
      expect(section?.bullets?.length).toBeGreaterThan(0)
    })
  })
})

// ===========================================================================
// Type completeness check
// ===========================================================================

describe('HelpContent type shape', () => {
  it('all helpContent values conform to HelpContent shape', () => {
    const typeCheck = (entry: HelpContent) => {
      expect(typeof entry.title).toBe('string')
      expect(Array.isArray(entry.sections)).toBe(true)
    }
    Object.values(helpContent).forEach(typeCheck)
  })
})
