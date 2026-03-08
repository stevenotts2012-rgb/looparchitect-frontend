export interface HelpContent {
  title: string
  sections: HelpSection[]
}

export interface HelpSection {
  heading: string
  content?: string
  bullets?: string[]
  examples?: string[]
}

export const helpContent: Record<string, HelpContent> = {
  upload: {
    title: 'Upload Your Loop',
    sections: [
      {
        heading: 'What is a Loop?',
        content:
          'A loop is a short audio file (typically 2-16 bars) that repeats seamlessly. LoopArchitect analyzes your loop and extends it into a full arrangement.',
        bullets: [
          'Supported formats: WAV, MP3, FLAC',
          'Recommended: 4-8 bars at consistent BPM',
          'Include drums, bass, melody, or any combination',
        ],
      },
      {
        heading: 'How to Upload',
        content:
          'Drag and drop your audio file into the upload area, or click to select a file from your computer. After upload, you will receive a Loop ID to use for generating arrangements.',
      },
      {
        heading: 'What Happens Next?',
        content:
          'LoopArchitect will analyze your loop to detect BPM, components (kick, bass, melody, etc.), and musical features. This analysis enables intelligent arrangement generation.',
      },
    ],
  },
  generate: {
    title: 'Generate Arrangement',
    sections: [
      {
        heading: 'Loop ID',
        content:
          'Enter the Loop ID from your upload. This identifies which loop to extend into an arrangement.',
      },
      {
        heading: 'Arrangement Type',
        content:
          'Choose how to specify arrangement length:',
        bullets: [
          'Bars: Specify total number of bars (e.g., 32 for a full beat)',
          'Duration: Specify target duration in seconds (e.g., 60 for 1 minute)',
        ],
      },
      {
        heading: 'Style Mode',
        content:
          'Control arrangement style in two ways:',
        bullets: [
          'Natural Language: Describe your style in plain English (e.g., "Dark cinematic, Metro vibe, minimal bounce")',
          'Preset: Choose from curated style presets',
        ],
      },
      {
        heading: 'Style Parameters (Sliders)',
        content:
          'Fine-tune the arrangement style with these controls:',
        bullets: [
          'Energy: Overall intensity and fullness (0 = minimal, 1 = maximal)',
          'Darkness: Tonal character (0 = bright, 1 = dark)',
          'Bounce: Rhythmic feel (0 = smooth, 1 = bouncy)',
          'Warmth: Tonal warmth (0 = cold, 1 = warm)',
          'Texture: Surface quality (smooth, balanced, gritty)',
        ],
      },
      {
        heading: 'Producer Moves',
        content:
          'Select arrangement techniques the producer engine will automatically apply:',
        bullets: [
          'Intro Tease: Start sparse to build anticipation',
          'Hook Drop: Full energy arrival at hooks',
          'Verse Space: Reduce elements for vocal clarity',
          '8-Bar Hat Roll: Add rhythmic variations',
          'Silence Drop: Strategic silence for impact',
          'Layer Lift: Gradually add instruments',
          '...and 6 more moves',
        ],
        examples: [
          'The engine intelligently places moves at optimal positions',
          'Multiple moves work together harmoniously',
          'Moves adapt to your loop detected components',
        ],
      },
      {
        heading: 'Seed',
        content:
          'Optional: Specify a seed (number or text) to reproduce the same arrangement. Same loop + same parameters + same seed = identical result.',
      },
    ],
  },
  producerMoves: {
    title: 'Producer Moves Explained',
    sections: [
      {
        heading: 'What are Producer Moves?',
        content:
          'Producer moves are arrangement techniques used by professional producers to create dynamic, engaging beats. LoopArchitect producer engine automatically places these moves at optimal positions.',
      },
      {
        heading: 'Intro Moves',
        bullets: [
          'Intro Tease: Start with limited elements to build anticipation',
        ],
      },
      {
        heading: 'Transition Moves',
        bullets: [
          'Hook Drop: Full energy arrival with all elements',
          'End-of-Section Fill: Drum fills to signal transitions',
          'Pre-Hook Mute: Brief silence before hook for impact',
          'Silence Drop: Strategic silence for dramatic effect',
        ],
      },
      {
        heading: 'Variation Moves',
        bullets: [
          'Verse Space: Reduce melody/high-end for "vocal space"',
          '8-Bar Hat Roll: Hi-hat rolls every 8 bars',
          'Layer Lift: Gradually add instruments to build energy',
          'Bridge Breakdown: Strip to minimal elements',
          'Final Hook Expansion: Extra layers on last hook',
          'Call-and-Response: Alternate between full and sparse',
        ],
      },
      {
        heading: 'Outro Moves',
        bullets: [
          'Outro Strip: Gradually remove elements for smooth ending',
        ],
      },
      {
        heading: 'How to Use',
        content:
          'Select the moves you want in your arrangement. The producer engine will:',
        bullets: [
          'Intelligently place moves at appropriate positions',
          'Adapt moves to your loop components',
          'Coordinate multiple moves to work together',
          'Respect your style parameters and genre',
        ],
        examples: [
          'For trap: Try "Hook Drop" + "8-Bar Hat Roll" + "Pre-Hook Mute"',
          'For cinematic: Try "Intro Tease" + "Layer Lift" + "Bridge Breakdown"',
          'For aggressive: Try "Hook Drop" + "Silence Drop" + "Final Hook Expansion"',
        ],
      },
    ],
  },
  styleParameters: {
    title: 'Style Parameters Guide',
    sections: [
      {
        heading: 'Energy',
        content:
          'Controls overall intensity and fullness of the arrangement.',
        bullets: [
          'Low (0.0-0.3): Minimal, sparse, intro-style',
          'Medium (0.4-0.6): Balanced, verse-style',
          'High (0.7-1.0): Full, intense, hook/drop-style',
        ],
      },
      {
        heading: 'Darkness',
        content:
          'Controls tonal character and mood.',
        bullets: [
          'Low (0.0-0.3): Bright, uplifting, pop-style',
          'Medium (0.4-0.6): Balanced, neutral tone',
          'High (0.7-1.0): Dark, moody, trap/drill-style',
        ],
      },
      {
        heading: 'Bounce',
        content:
          'Controls rhythmic feel and groove.',
        bullets: [
          'Low (0.0-0.3): Smooth, flowing, cinematic',
          'Medium (0.4-0.6): Balanced groove',
          'High (0.7-1.0): Bouncy, syncopated, Atlanta-style',
        ],
      },
      {
        heading: 'Warmth',
        content:
          'Controls tonal warmth and analog feel.',
        bullets: [
          'Low (0.0-0.3): Cold, digital, modern',
          'Medium (0.4-0.6): Balanced warmth',
          'High (0.7-1.0): Warm, analog, vintage',
        ],
      },
      {
        heading: 'Texture',
        content:
          'Controls surface quality and clarity.',
        bullets: [
          'Smooth: Clean, polished, pop/R&B-style',
          'Balanced: Natural, versatile',
          'Gritty: Raw, distorted, underground-style',
        ],
      },
      {
        heading: 'Combining Parameters',
        examples: [
          'Dark Trap: High darkness, high energy, high bounce',
          'Cinematic: Low bounce, medium warmth, smooth texture',
          'Lo-fi: High warmth, gritty texture, low energy',
          'Pop: Low darkness, medium energy, smooth texture',
        ],
      },
    ],
  },
}
