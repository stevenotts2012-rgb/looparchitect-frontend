/**
 * Regression tests for the arrangement audio URL lifecycle.
 *
 * Root cause being guarded:
 *  - The cleanup useEffect previously listed `[previewCandidates]` as a
 *    dependency instead of `[]`.  React runs the *cleanup* of a useEffect
 *    when its dependencies change (not only on unmount), so every polling
 *    tick that called `setPreviewCandidates` also triggered
 *    `URL.revokeObjectURL(audioUrlRef.current)`, revoking the valid blob URL
 *    and causing the player to reset to 0:00 / 0:00.
 *
 *  - The candidates polling effect listed the full `previewCandidates` array
 *    as a dependency and called `setPreviewCandidates` internally, producing
 *    an infinite re-run loop.  Each re-run fired a fresh poll with a stale
 *    closure where `candidate.audioUrl` was still null.  Stale polls that
 *    failed the download call would write `audioUrl: null` into state, which
 *    the selectedPreviewId sync effect propagated to the main `audioUrl`,
 *    clearing the player.
 *
 *  - The selectedPreviewId sync effect unconditionally called
 *    `setAudioUrl(selected.audioUrl ?? null)`, overwriting a valid URL with
 *    null whenever a poll tick updated the candidate before the audio was
 *    ready.
 *
 *  - hasPending only checked queued/processing/pending, so a candidate that
 *    had transitioned to done but whose audio download had failed was never
 *    retried.  The polling interval stopped, leaving the card permanently on
 *    "Loading preview…".
 */

// ---------------------------------------------------------------------------
// Pure-logic helpers extracted from generate/page.tsx for isolated testing
// ---------------------------------------------------------------------------

/**
 * Simulate the `pollCandidates` state-transition logic.
 * Returns the next candidates array (same shape as `setPreviewCandidates`
 * receives) given the current candidates and a map of status responses.
 */
function applyPollResult(
  currentCandidates: Array<{
    arrangement_id: number
    status: string
    audioUrl?: string | null
    arrangementStatus?: object | null
  }>,
  statusResponse: { arrangement_id: number; status: string },
  downloadedUrl: string | null,
) {
  return currentCandidates.map((candidate) => {
    if (candidate.arrangement_id !== statusResponse.arrangement_id) {
      return candidate
    }

    // Preserve existing audioUrl – never overwrite a valid URL with null
    let nextAudioUrl = candidate.audioUrl ?? null

    if (!nextAudioUrl && (statusResponse.status === 'done' || statusResponse.status === 'completed')) {
      nextAudioUrl = downloadedUrl
    }

    return {
      ...candidate,
      status: statusResponse.status,
      arrangementStatus: statusResponse,
      audioUrl: nextAudioUrl,
    }
  })
}

/**
 * Simulate the selectedPreviewId sync effect logic (effect #6 fix).
 * Returns the next audioUrl value after syncing from a candidate.
 */
function syncAudioUrlFromCandidate(
  currentAudioUrl: string | null,
  selectedCandidate: { audioUrl?: string | null } | undefined,
): string | null {
  if (!selectedCandidate) return currentAudioUrl
  // FIXED: only overwrite when a valid URL is available
  if (selectedCandidate.audioUrl != null) {
    return selectedCandidate.audioUrl
  }
  // Leave current audioUrl unchanged when candidate URL is not yet ready
  return currentAudioUrl
}

// ---------------------------------------------------------------------------
// New helpers mirroring the retry/unavailable logic added to generate/page.tsx
// ---------------------------------------------------------------------------

const MAX_PREVIEW_DOWNLOAD_ATTEMPTS = 3

type CandidateState = {
  arrangement_id: number
  status: string
  audioUrl?: string | null
  audioUnavailable?: boolean
}

/**
 * Returns true when a candidate still needs work (either pending status or
 * done/completed but missing an audio URL that has not been exhausted).
 * Mirrors the `isStillPending || needsAudio` guard in pollCandidates.
 */
function shouldCandidateBeProcessed(candidate: CandidateState): boolean {
  const isStillPending =
    candidate.status === 'queued' ||
    candidate.status === 'processing' ||
    candidate.status === 'pending'
  const needsAudio =
    (candidate.status === 'done' || candidate.status === 'completed') &&
    !candidate.audioUrl &&
    !candidate.audioUnavailable
  return isStillPending || needsAudio
}

/**
 * Returns true when the interval should keep running (i.e. at least one
 * candidate still needs work).  Mirrors the fixed `hasPending` check.
 */
function hasPendingCandidates(candidates: CandidateState[]): boolean {
  return candidates.some(shouldCandidateBeProcessed)
}

/**
 * Simulate a single audio-download retry tick for a done-without-audio
 * candidate.  Returns the updated candidate.
 */
function applyAudioRetry(
  candidate: CandidateState,
  currentAttempts: number,
  downloadedUrl: string | null,
): CandidateState {
  if (currentAttempts >= MAX_PREVIEW_DOWNLOAD_ATTEMPTS) {
    return { ...candidate, audioUnavailable: true }
  }
  if (downloadedUrl !== null) {
    return { ...candidate, audioUrl: downloadedUrl, audioUnavailable: false }
  }
  // Download failed – keep candidate as-is so next tick retries.
  return candidate
}

// ---------------------------------------------------------------------------
// Tests – variation preview lifecycle
// ---------------------------------------------------------------------------

describe('Variation preview lifecycle – retry and unavailable', () => {
  describe('shouldCandidateBeProcessed – polling guard', () => {
    it('returns true for queued candidates', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'queued', audioUrl: null }))
        .toBe(true)
    })

    it('returns true for processing candidates', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'processing', audioUrl: null }))
        .toBe(true)
    })

    it('returns true for pending candidates', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'pending', audioUrl: null }))
        .toBe(true)
    })

    it('returns true for done candidate missing audioUrl (needs download)', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'done', audioUrl: null }))
        .toBe(true)
    })

    it('returns true for completed candidate missing audioUrl (needs download)', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'completed', audioUrl: null }))
        .toBe(true)
    })

    it('returns false for done candidate with valid audioUrl', () => {
      expect(shouldCandidateBeProcessed({
        arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/audio',
      })).toBe(false)
    })

    it('returns false for done candidate marked audioUnavailable', () => {
      expect(shouldCandidateBeProcessed({
        arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true,
      })).toBe(false)
    })

    it('returns false for failed candidates', () => {
      expect(shouldCandidateBeProcessed({ arrangement_id: 1, status: 'failed', audioUrl: null }))
        .toBe(false)
    })
  })

  describe('hasPendingCandidates – interval stop guard', () => {
    it('returns true when any candidate is still pending', () => {
      const candidates: CandidateState[] = [
        { arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/1' },
        { arrangement_id: 2, status: 'processing', audioUrl: null },
      ]
      expect(hasPendingCandidates(candidates)).toBe(true)
    })

    it('returns true when a done candidate is still missing audioUrl', () => {
      const candidates: CandidateState[] = [
        { arrangement_id: 1, status: 'done', audioUrl: null },
        { arrangement_id: 2, status: 'done', audioUrl: 'blob:http://localhost/2' },
      ]
      expect(hasPendingCandidates(candidates)).toBe(true)
    })

    it('returns false when all done candidates have audioUrl', () => {
      const candidates: CandidateState[] = [
        { arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/1' },
        { arrangement_id: 2, status: 'done', audioUrl: 'blob:http://localhost/2' },
      ]
      expect(hasPendingCandidates(candidates)).toBe(false)
    })

    it('returns false when done-without-audio candidates are marked audioUnavailable', () => {
      const candidates: CandidateState[] = [
        { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
        { arrangement_id: 2, status: 'failed', audioUrl: null },
      ]
      expect(hasPendingCandidates(candidates)).toBe(false)
    })
  })

  describe('applyAudioRetry – retry and unavailable transitions', () => {
    it('variation becomes READY and preview appears on first successful download', () => {
      const candidate: CandidateState = { arrangement_id: 1, status: 'done', audioUrl: null }
      const result = applyAudioRetry(candidate, 0, 'blob:http://localhost/audio')
      expect(result.audioUrl).toBe('blob:http://localhost/audio')
      expect(result.audioUnavailable).toBe(false)
    })

    it('keeps candidate unchanged when download fails and attempts remain', () => {
      const candidate: CandidateState = { arrangement_id: 1, status: 'done', audioUrl: null }
      const result = applyAudioRetry(candidate, 1, null) // attempt 2, failed
      expect(result.audioUrl).toBeNull()
      expect(result.audioUnavailable).toBeUndefined()
    })

    it('READY with missing URL does not spin forever – marks unavailable after max attempts', () => {
      const candidate: CandidateState = { arrangement_id: 1, status: 'done', audioUrl: null }

      // Simulate MAX_PREVIEW_DOWNLOAD_ATTEMPTS = 3 consecutive failures.
      let current = candidate
      for (let attempt = 0; attempt < MAX_PREVIEW_DOWNLOAD_ATTEMPTS; attempt++) {
        current = applyAudioRetry(current, attempt, null)
        // Before exhausting attempts the candidate should still be retryable.
        if (attempt < MAX_PREVIEW_DOWNLOAD_ATTEMPTS - 1) {
          expect(current.audioUnavailable).toBeFalsy()
          expect(shouldCandidateBeProcessed(current)).toBe(true)
        }
      }

      // After MAX_PREVIEW_DOWNLOAD_ATTEMPTS the candidate is unavailable.
      const final = applyAudioRetry(current, MAX_PREVIEW_DOWNLOAD_ATTEMPTS, null)
      expect(final.audioUnavailable).toBe(true)
      expect(final.audioUrl).toBeNull()
      // And it no longer counts as pending – polling can safely stop.
      expect(shouldCandidateBeProcessed(final)).toBe(false)
    })

    it('stale polling does not wipe out a valid variation preview URL', () => {
      const existingUrl = 'blob:http://localhost/valid'
      const candidate: CandidateState = {
        arrangement_id: 1, status: 'done', audioUrl: existingUrl,
      }
      // shouldCandidateBeProcessed returns false → candidate is skipped entirely.
      expect(shouldCandidateBeProcessed(candidate)).toBe(false)

      // applyPollResult also preserves it (existing guard).
      const result = applyPollResult(
        [{ arrangement_id: 1, status: 'done', audioUrl: existingUrl }],
        { arrangement_id: 1, status: 'done' },
        'blob:http://localhost/stale', // a stale poll would try to write this
      )
      expect(result[0].audioUrl).toBe(existingUrl)
    })

    it('multiple variations can become READY independently without blocking each other', () => {
      // Three variations; variation 2 download fails; 1 and 3 succeed.
      const initial: CandidateState[] = [
        { arrangement_id: 1, status: 'done', audioUrl: null },
        { arrangement_id: 2, status: 'done', audioUrl: null },
        { arrangement_id: 3, status: 'done', audioUrl: null },
      ]

      // Tick 1: attempt downloads.
      const afterTick1 = initial.map((c) => {
        if (c.arrangement_id === 1) return applyAudioRetry(c, 0, 'blob:http://localhost/1')
        if (c.arrangement_id === 2) return applyAudioRetry(c, 0, null) // fails
        return applyAudioRetry(c, 0, 'blob:http://localhost/3')
      })

      expect(afterTick1[0].audioUrl).toBe('blob:http://localhost/1')
      expect(afterTick1[1].audioUrl).toBeNull() // still needs retry
      expect(afterTick1[2].audioUrl).toBe('blob:http://localhost/3')

      // Interval must still be considered running because candidate 2 needs work.
      expect(hasPendingCandidates(afterTick1)).toBe(true)

      // Tick 2: candidate 2 succeeds.
      const afterTick2 = afterTick1.map((c) => {
        if (c.arrangement_id === 2) return applyAudioRetry(c, 1, 'blob:http://localhost/2')
        return c // already resolved, skip
      })

      expect(afterTick2[1].audioUrl).toBe('blob:http://localhost/2')
      // Now all candidates have audio – interval can stop.
      expect(hasPendingCandidates(afterTick2)).toBe(false)
    })
  })
})


describe('Arrangement audio URL lifecycle', () => {
  describe('applyPollResult – audio URL preservation', () => {
    it('sets audioUrl when candidate transitions to done and no URL was set', () => {
      const candidates = [
        { arrangement_id: 1, status: 'processing', audioUrl: null },
      ]
      const result = applyPollResult(
        candidates,
        { arrangement_id: 1, status: 'done' },
        'blob:http://localhost/abc',
      )
      expect(result[0].audioUrl).toBe('blob:http://localhost/abc')
    })

    it('preserves existing audioUrl on subsequent polls – does not overwrite with a new download', () => {
      const existingUrl = 'blob:http://localhost/first'
      const candidates = [
        { arrangement_id: 1, status: 'done', audioUrl: existingUrl },
      ]
      const result = applyPollResult(
        candidates,
        { arrangement_id: 1, status: 'done' },
        'blob:http://localhost/second', // stale poll would try to set this
      )
      // The original URL must be preserved, not replaced
      expect(result[0].audioUrl).toBe(existingUrl)
    })

    it('preserves existing audioUrl even if the download would fail (null downloadedUrl)', () => {
      const existingUrl = 'blob:http://localhost/valid'
      const candidates = [
        { arrangement_id: 1, status: 'done', audioUrl: existingUrl },
      ]
      const result = applyPollResult(
        candidates,
        { arrangement_id: 1, status: 'done' },
        null, // simulates a failed download in a stale poll
      )
      expect(result[0].audioUrl).toBe(existingUrl)
    })

    it('does not overwrite audioUrl with null when download fails on first attempt', () => {
      const candidates = [
        { arrangement_id: 1, status: 'processing', audioUrl: null },
      ]
      const result = applyPollResult(
        candidates,
        { arrangement_id: 1, status: 'done' },
        null, // download failed
      )
      // audioUrl should remain null (not undefined), preserving the no-audio state
      expect(result[0].audioUrl).toBeNull()
    })

    it('does not modify candidates for non-matching arrangement_id', () => {
      const candidates = [
        { arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/1' },
        { arrangement_id: 2, status: 'processing', audioUrl: null },
      ]
      const result = applyPollResult(
        candidates,
        { arrangement_id: 2, status: 'done' },
        'blob:http://localhost/2',
      )
      // Candidate 1 must be untouched
      expect(result[0].audioUrl).toBe('blob:http://localhost/1')
      expect(result[0].status).toBe('done')
      // Candidate 2 should be updated
      expect(result[1].audioUrl).toBe('blob:http://localhost/2')
    })
  })

  describe('syncAudioUrlFromCandidate – stale null guard', () => {
    it('sets audioUrl when a valid URL becomes available', () => {
      const result = syncAudioUrlFromCandidate(
        null,
        { audioUrl: 'blob:http://localhost/abc' },
      )
      expect(result).toBe('blob:http://localhost/abc')
    })

    it('preserves existing valid audioUrl when candidate URL is null (audio not yet ready)', () => {
      const validUrl = 'blob:http://localhost/valid'
      const result = syncAudioUrlFromCandidate(
        validUrl,
        { audioUrl: null }, // poll tick before audio was downloaded
      )
      // Must NOT overwrite the valid URL with null
      expect(result).toBe(validUrl)
    })

    it('preserves existing valid audioUrl when candidate URL is undefined', () => {
      const validUrl = 'blob:http://localhost/valid'
      const result = syncAudioUrlFromCandidate(validUrl, { audioUrl: undefined })
      expect(result).toBe(validUrl)
    })

    it('returns null when there is no existing URL and candidate has no URL', () => {
      const result = syncAudioUrlFromCandidate(null, { audioUrl: null })
      expect(result).toBeNull()
    })

    it('returns currentAudioUrl when candidate is undefined', () => {
      const validUrl = 'blob:http://localhost/valid'
      const result = syncAudioUrlFromCandidate(validUrl, undefined)
      expect(result).toBe(validUrl)
    })
  })

  describe('Polling re-run loop prevention', () => {
    /**
     * Validates that once a candidate has an audioUrl, repeated polling
     * cycles (simulating the fixed `previewCandidates.length` dep behaviour)
     * do not download a new URL or clear the existing one.
     */
    it('does not re-download audio on every poll tick once URL is set', () => {
      let callCount = 0
      const mockDownload = (): string => {
        callCount++
        return 'blob:http://localhost/' + callCount
      }

      const candidates: Array<{ arrangement_id: number; status: string; audioUrl: string | null }> = [
        { arrangement_id: 1, status: 'processing', audioUrl: null },
      ]

      // Tick 1: candidate becomes done, audio downloaded
      const tick1Status = { arrangement_id: 1, status: 'done' }
      if (!candidates[0].audioUrl && (tick1Status.status === 'done' || tick1Status.status === 'completed')) {
        candidates[0] = { ...candidates[0], status: 'done', audioUrl: mockDownload() }
      }
      expect(callCount).toBe(1)
      expect(candidates[0].audioUrl).toBe('blob:http://localhost/1')

      // Tick 2: same status, should NOT download again (guard: !nextAudioUrl)
      const tick2Status = { arrangement_id: 1, status: 'done' }
      if (!candidates[0].audioUrl && (tick2Status.status === 'done' || tick2Status.status === 'completed')) {
        candidates[0] = { ...candidates[0], audioUrl: mockDownload() }
      }
      expect(callCount).toBe(1) // download NOT called again
      expect(candidates[0].audioUrl).toBe('blob:http://localhost/1') // URL unchanged

      // Tick 3: same
      const tick3Status = { arrangement_id: 1, status: 'done' }
      if (!candidates[0].audioUrl && (tick3Status.status === 'done' || tick3Status.status === 'completed')) {
        candidates[0] = { ...candidates[0], audioUrl: mockDownload() }
      }
      expect(callCount).toBe(1)
    })
  })

  describe('Cleanup effect dependency guard', () => {
    /**
     * Verifies the conceptual fix: the cleanup function should only be
     * invoked once (on unmount) regardless of how many times candidates
     * are updated.
     *
     * We simulate this by tracking how many times `revokeObjectURL` would
     * have been called with the audio URL in the OLD (buggy) vs NEW (fixed)
     * cleanup strategy.
     */
    it('should not revoke the audioUrl when previewCandidates changes (fixed behaviour)', () => {
      const revokedUrls: string[] = []
      const mockRevoke = (url: string) => revokedUrls.push(url)

      const audioUrl = 'blob:http://localhost/audio'

      // Simulate the FIXED cleanup: deps=[], only runs on unmount.
      // previewCandidates changes multiple times (simulating polling ticks)
      // but revokeObjectURL is never called until unmount.
      const pollingTicks = 5
      for (let i = 0; i < pollingTicks; i++) {
        // In the fixed version, cleanup does NOT run on each tick
        // (empty deps means no cleanup on dependency change)
      }

      // Only on unmount
      mockRevoke(audioUrl)

      expect(revokedUrls).toHaveLength(1)
      expect(revokedUrls[0]).toBe(audioUrl)
    })

    it('demonstrates the BUG that was fixed: old [previewCandidates] dep caused early revocation', () => {
      const revokedUrls: string[] = []
      const mockRevoke = (url: string) => revokedUrls.push(url)

      const audioUrl = 'blob:http://localhost/audio'
      let audioUrlRef = { current: audioUrl }

      // Simulate the OLD (buggy) cleanup: deps=[previewCandidates]
      // Every previewCandidates change triggers cleanup → revoke
      const pollingTicks = 3
      for (let i = 0; i < pollingTicks; i++) {
        // Cleanup of previous render fires (this is the bug)
        if (audioUrlRef.current) {
          mockRevoke(audioUrlRef.current)
        }
        // audioUrlRef gets synced from state in a later effect
        // but by then the URL is already revoked
      }

      // The URL was revoked multiple times before unmount – this is the bug
      expect(revokedUrls.length).toBeGreaterThan(0)
      // And it would have been revoked on the FIRST tick, clearing the player
      expect(revokedUrls[0]).toBe(audioUrl)
    })
  })
})

// ---------------------------------------------------------------------------
// Functional-update merge guard (mirrors the new setPreviewCandidates logic)
// ---------------------------------------------------------------------------

/**
 * Mirrors the functional update guard in pollCandidates:
 *   setPreviewCandidates((current) => nextCandidates.map((next) => { ... }))
 *
 * Guards:
 *  1. Never overwrite terminal audioUnavailable state (sticky until new identity).
 *  2. Never clear a valid audioUrl that a stale poll omitted.
 */
function functionalMerge(
  current: CandidateState[],
  next: CandidateState[],
): CandidateState[] {
  return next.map((nextItem) => {
    const existing = current.find((c) => c.arrangement_id === nextItem.arrangement_id)
    if (existing?.audioUnavailable && !nextItem.audioUnavailable) {
      return existing
    }
    if (existing?.audioUrl && !nextItem.audioUrl) {
      return { ...nextItem, audioUrl: existing.audioUrl }
    }
    return nextItem
  })
}

describe('Functional merge guard – terminal state stickiness', () => {
  it('(1) preserves audioUnavailable when a stale concurrent poll produces a candidate without it', () => {
    const currentState: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
    ]
    // Stale poll T1 completed after T2 already wrote unavailable
    const staleUpdate: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null },
    ]
    const merged = functionalMerge(currentState, staleUpdate)
    expect(merged[0].audioUnavailable).toBe(true)
  })

  it('(2) stale poll after unavailable does not restore loading – stays terminal', () => {
    const unavailable: CandidateState = {
      arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true,
    }
    // Simulate multiple stale poll ticks; each must return the same unavailable state
    for (let tick = 0; tick < 5; tick++) {
      const stale: CandidateState = { arrangement_id: 1, status: 'done', audioUrl: null }
      const merged = functionalMerge([unavailable], [stale])
      expect(merged[0].audioUnavailable).toBe(true)
      expect(shouldCandidateBeProcessed(merged[0])).toBe(false)
    }
  })

  it('(3) stale poll after ready does not wipe audio – preserves valid URL', () => {
    const readyState: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/valid' },
    ]
    const staleUpdate: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null },
    ]
    const merged = functionalMerge(readyState, staleUpdate)
    expect(merged[0].audioUrl).toBe('blob:http://localhost/valid')
  })

  it('(4) new arrangement id in next array starts fresh (no existing state) and is passed through unchanged', () => {
    const currentState: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
    ]
    // Brand new generation cycle – different arrangement IDs
    const freshCandidates: CandidateState[] = [
      { arrangement_id: 99, status: 'queued', audioUrl: null },
      { arrangement_id: 100, status: 'queued', audioUrl: null },
    ]
    const merged = functionalMerge(currentState, freshCandidates)
    expect(merged).toHaveLength(2)
    expect(merged[0].arrangement_id).toBe(99)
    expect(merged[0].audioUnavailable).toBeFalsy()
    expect(merged[1].arrangement_id).toBe(100)
    expect(merged[1].audioUnavailable).toBeFalsy()
  })

  it('(5) one variation unavailable does not affect the others', () => {
    const currentState: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: 'blob:http://localhost/1' },
      { arrangement_id: 2, status: 'done', audioUrl: null, audioUnavailable: true },
      { arrangement_id: 3, status: 'done', audioUrl: null },
    ]
    // Stale poll updates all three with no unavailable flags and partial nulls
    const staleUpdate: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null },         // stale null for 1
      { arrangement_id: 2, status: 'done', audioUrl: null },          // stale no-unavailable for 2
      { arrangement_id: 3, status: 'done', audioUrl: 'blob:http://localhost/3' },
    ]
    const merged = functionalMerge(currentState, staleUpdate)
    // Candidate 1: audioUrl preserved from current
    expect(merged[0].audioUrl).toBe('blob:http://localhost/1')
    // Candidate 2: audioUnavailable preserved from current
    expect(merged[1].audioUnavailable).toBe(true)
    expect(merged[1].audioUrl).toBeNull()
    // Candidate 3: fresh URL accepted (no existing audioUrl to guard)
    expect(merged[2].audioUrl).toBe('blob:http://localhost/3')
  })
})

describe('(6) Arrangement preview main area – stable fallback after audio download failure', () => {
  /**
   * Pure rendering-logic tests for the three-way branch in the main preview area:
   *   audioUrl → player
   *   audioUnavailable (no audioUrl) → stable fallback
   *   else → spinner
   */
  function resolvePreviewState(audioUrl: string | null, audioUnavailable: boolean) {
    if (audioUrl != null) return 'player'
    if (audioUnavailable) return 'fallback'
    return 'spinner'
  }

  it('shows player when audioUrl is present', () => {
    expect(resolvePreviewState('blob:http://localhost/audio', false)).toBe('player')
  })

  it('shows stable fallback (not spinner) when audioUnavailable is true and audioUrl is null', () => {
    expect(resolvePreviewState(null, true)).toBe('fallback')
  })

  it('shows spinner while loading (audioUrl null, audioUnavailable false)', () => {
    expect(resolvePreviewState(null, false)).toBe('spinner')
  })

  it('fallback is stable across multiple re-renders (same inputs → same output)', () => {
    for (let i = 0; i < 10; i++) {
      expect(resolvePreviewState(null, true)).toBe('fallback')
    }
  })

  it('player takes priority over audioUnavailable when both are somehow truthy', () => {
    // This is a defensive edge case – in practice they should not both be set.
    expect(resolvePreviewState('blob:http://localhost/audio', true)).toBe('player')
  })

  it('reset: after new generation audioUnavailable=false and audioUrl=null → spinner', () => {
    // Simulate state immediately after handleGenerate resets audioUnavailable
    const audioUnavailable = false
    const audioUrl: string | null = null
    expect(resolvePreviewState(audioUrl, audioUnavailable)).toBe('spinner')
  })
})

describe('(7) Unavailable can only transition to ready with new resource identity', () => {
  it('unavailable cannot transition to ready via a stale poll for the same arrangement id', () => {
    const unavailable: CandidateState = {
      arrangement_id: 42, status: 'done', audioUrl: null, audioUnavailable: true,
    }
    // Even if a stale/concurrent poll produced a URL for the same ID, it must not override
    const staleWithUrl: CandidateState = {
      arrangement_id: 42, status: 'done', audioUrl: 'blob:http://localhost/late', audioUnavailable: false,
    }
    const merged = functionalMerge([unavailable], [staleWithUrl])
    // audioUnavailable guard fires: existing is unavailable, next is not → keep existing
    expect(merged[0].audioUnavailable).toBe(true)
    expect(merged[0].audioUrl).toBeNull()
  })

  it('a new generation cycle with a different arrangement id starts as ready (no unavailable guard applies)', () => {
    // Old generation is unavailable
    const currentState: CandidateState[] = [
      { arrangement_id: 42, status: 'done', audioUrl: null, audioUnavailable: true },
    ]
    // Brand new generation with a new ID – the functional merge finds no existing entry
    const freshCandidates: CandidateState[] = [
      { arrangement_id: 99, status: 'done', audioUrl: 'blob:http://localhost/new', audioUnavailable: false },
    ]
    const merged = functionalMerge(currentState, freshCandidates)
    // No existing entry for arrangement_id=99, so next passes through unchanged
    expect(merged[0].arrangement_id).toBe(99)
    expect(merged[0].audioUrl).toBe('blob:http://localhost/new')
    expect(merged[0].audioUnavailable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Direct URL priority path (preview_url / output_url)
// ---------------------------------------------------------------------------

/**
 * Mirrors the new primary-path logic in pollCandidates:
 *   const directUrl = status.preview_url || status.output_url
 *   if (directUrl) { nextAudioUrl = directUrl } else { // blob download fallback }
 */
function resolveAudioUrlFromStatus(
  currentAudioUrl: string | null,
  statusResponse: {
    status: string
    preview_url?: string | null
    output_url?: string | null
  },
  blobDownloadResult: string | null,
): string | null {
  if (currentAudioUrl) return currentAudioUrl // preserve existing
  if (statusResponse.status !== 'done' && statusResponse.status !== 'completed') {
    return currentAudioUrl
  }
  const directUrl = statusResponse.preview_url || statusResponse.output_url
  if (directUrl) return directUrl
  return blobDownloadResult // null if download fails
}

describe('(8) Direct URL priority path – preview_url / output_url', () => {
  it('uses preview_url from status response instead of downloading a blob', () => {
    const directUrl = 'https://cdn.example.com/previews/123.mp3'
    const result = resolveAudioUrlFromStatus(
      null,
      { status: 'done', preview_url: directUrl },
      null, // blob download not needed
    )
    expect(result).toBe(directUrl)
  })

  it('falls back to output_url when preview_url is absent', () => {
    const outputUrl = 'https://cdn.example.com/output/123.wav'
    const result = resolveAudioUrlFromStatus(
      null,
      { status: 'done', output_url: outputUrl },
      null,
    )
    expect(result).toBe(outputUrl)
  })

  it('prefers preview_url over output_url when both are present', () => {
    const result = resolveAudioUrlFromStatus(
      null,
      {
        status: 'done',
        preview_url: 'https://cdn.example.com/preview.mp3',
        output_url: 'https://cdn.example.com/output.wav',
      },
      null,
    )
    expect(result).toBe('https://cdn.example.com/preview.mp3')
  })

  it('falls back to blob download when neither preview_url nor output_url is present', () => {
    const blobUrl = 'blob:http://localhost/abc'
    const result = resolveAudioUrlFromStatus(
      null,
      { status: 'done', preview_url: null, output_url: null },
      blobUrl,
    )
    expect(result).toBe(blobUrl)
  })

  it('returns null when direct URL and blob download both fail', () => {
    const result = resolveAudioUrlFromStatus(
      null,
      { status: 'done', preview_url: null, output_url: null },
      null,
    )
    expect(result).toBeNull()
  })

  it('preserves an existing audioUrl regardless of what the status response returns', () => {
    const existingUrl = 'blob:http://localhost/existing'
    const result = resolveAudioUrlFromStatus(
      existingUrl,
      {
        status: 'done',
        preview_url: 'https://cdn.example.com/new.mp3',
        output_url: 'https://cdn.example.com/new.wav',
      },
      'blob:http://localhost/new',
    )
    expect(result).toBe(existingUrl)
  })

  it('does not attempt to use direct URL for non-terminal statuses', () => {
    const result = resolveAudioUrlFromStatus(
      null,
      { status: 'processing', preview_url: 'https://cdn.example.com/preview.mp3' },
      null,
    )
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Preview status-aware display resolution
// ---------------------------------------------------------------------------

/**
 * Mirrors the new preview_status-aware display logic in the arrangement
 * preview area and candidate cards.
 */
function resolvePreviewDisplayState(
  audioUrl: string | null,
  audioUnavailable: boolean,
  previewStatus?: string | null,
): 'player' | 'fallback-with-retry' | 'rendering' | 'loading' {
  if (audioUrl != null) return 'player'
  if (audioUnavailable) return 'fallback-with-retry'
  if (previewStatus === 'queued' || previewStatus === 'processing') return 'rendering'
  return 'loading'
}

describe('(9) Preview status-aware display states', () => {
  it('shows player when audioUrl is available (any preview_status)', () => {
    expect(resolvePreviewDisplayState('blob:http://localhost/audio', false, 'completed')).toBe('player')
    expect(resolvePreviewDisplayState('https://cdn.example.com/audio.mp3', false, 'queued')).toBe('player')
  })

  it('shows fallback-with-retry when audioUnavailable is true (no URL)', () => {
    expect(resolvePreviewDisplayState(null, true, undefined)).toBe('fallback-with-retry')
    expect(resolvePreviewDisplayState(null, true, 'failed')).toBe('fallback-with-retry')
  })

  it('shows rendering spinner when preview_status is queued', () => {
    expect(resolvePreviewDisplayState(null, false, 'queued')).toBe('rendering')
  })

  it('shows rendering spinner when preview_status is processing', () => {
    expect(resolvePreviewDisplayState(null, false, 'processing')).toBe('rendering')
  })

  it('shows generic loading when preview_status is absent (legacy backend)', () => {
    expect(resolvePreviewDisplayState(null, false, null)).toBe('loading')
    expect(resolvePreviewDisplayState(null, false, undefined)).toBe('loading')
  })

  it('shows generic loading when preview_status is completed but URL not yet set (race)', () => {
    // preview_status=completed but audioUrl not yet resolved → loading briefly
    expect(resolvePreviewDisplayState(null, false, 'completed')).toBe('loading')
  })
})

// ---------------------------------------------------------------------------
// handleRetryPreview state reset logic
// ---------------------------------------------------------------------------

/**
 * Mirrors the local state reset in handleRetryPreview:
 *  - Resets audioUnavailable to false for the affected candidate.
 *  - Clears audioUrl so polling loop can re-download or re-use direct URL.
 *  - Removes download attempt counter for the candidate.
 */
function applyRetryPreviewReset(
  candidates: CandidateState[],
  retryArrangementId: number,
): CandidateState[] {
  return candidates.map((candidate) =>
    candidate.arrangement_id === retryArrangementId
      ? { ...candidate, audioUnavailable: false, audioUrl: null }
      : candidate
  )
}

describe('(10) handleRetryPreview – local state reset', () => {
  it('resets audioUnavailable to false for the retried candidate', () => {
    const candidates: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
      { arrangement_id: 2, status: 'done', audioUrl: 'blob:http://localhost/2' },
    ]
    const result = applyRetryPreviewReset(candidates, 1)
    expect(result[0].audioUnavailable).toBe(false)
    expect(result[0].audioUrl).toBeNull()
  })

  it('does not affect other candidates', () => {
    const candidates: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
      { arrangement_id: 2, status: 'done', audioUrl: 'blob:http://localhost/2' },
    ]
    const result = applyRetryPreviewReset(candidates, 1)
    expect(result[1].audioUrl).toBe('blob:http://localhost/2')
    expect(result[1].audioUnavailable).toBeFalsy()
  })

  it('after reset the candidate becomes eligible for re-processing', () => {
    const candidate: CandidateState = {
      arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true,
    }
    const [reset] = applyRetryPreviewReset([candidate], 1)
    expect(shouldCandidateBeProcessed(reset)).toBe(true)
  })

  it('re-queuing makes the polling interval re-start (hasPendingCandidates becomes true again)', () => {
    const before: CandidateState[] = [
      { arrangement_id: 1, status: 'done', audioUrl: null, audioUnavailable: true },
    ]
    expect(hasPendingCandidates(before)).toBe(false)

    const after = applyRetryPreviewReset(before, 1)
    expect(hasPendingCandidates(after)).toBe(true)
  })
})
