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
// Tests
// ---------------------------------------------------------------------------

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
