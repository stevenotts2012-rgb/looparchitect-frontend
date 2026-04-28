'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  renderLoopAsync,
  getJobStatus,
  saveArrangement,
  getArrangementPlan,
  getArrangementStatus,
  getArrangementMetadata,
  downloadArrangement,
  listArrangements,
  listStylePresets,
  validateLoopSource,
  getLoop,
  downloadLoop,
  validateStyle,
  retryPreviewRender,
  resolveArrangementAudioUrl,
  LoopArchitectApiError,
  type Arrangement,
  type ArrangementPlanResponse,
  type ArrangementPlanSection,
  type ArrangementStatusResponse,
  type ArrangementPreviewCandidate,
  type StylePresetResponse,
  type ProducerDebugSection,
  type ProducerPlanV2,
  type QualityScore,
  type DecisionLogEntry,
  type SectionSummaryItem,
  type ReferenceAnalysisSummary,
} from '@/../../api/client'
import ArrangementStatus from '@/components/ArrangementStatus'
import DownloadButton from '@/components/DownloadButton'
import DawExportButton from '@/components/DawExportButton'
import GenerationHistory from '@/components/GenerationHistory'
import WaveformViewer from '@/components/WaveformViewer'
import BeforeAfterComparison from '@/components/BeforeAfterComparison'
import { ArrangementTimeline } from '@/components/ArrangementTimeline'
import { StyleSliders } from '@/components/StyleSliders'
import { StyleTextInput } from '@/components/StyleTextInput'
import { ProducerMoves } from '@/components/ProducerMoves'
import { HelpButton } from '@/components/HelpButton'
import { ProducerInsightsPanel } from '@/components/ProducerInsightsPanel'
import ReferenceTrackPanel, { type AdaptationStrength, type GuidanceMode } from '@/components/ReferenceTrackPanel'
import { ReferenceGuidancePanel } from '@/components/ReferenceGuidancePanel'
import { SectionStateBadge, deriveSectionState } from '@/components/SectionStateBadge'
import { SimpleStyleProfile } from '@/lib/styleSchema'

export default function GeneratePage() {
  type PreviewCandidateState = ArrangementPreviewCandidate & {
    arrangementStatus?: ArrangementStatusResponse | null
    audioUrl?: string | null
    isSaved?: boolean
    /** Set to true once audio download has been retried MAX_PREVIEW_DOWNLOAD_ATTEMPTS
     *  times without success.  Prevents infinite "Loading preview..." spinner. */
    audioUnavailable?: boolean
  }

  /** Maximum number of times we attempt to download a preview audio blob for a
   *  single candidate before giving up and showing "Preview unavailable". */
  const MAX_PREVIEW_DOWNLOAD_ATTEMPTS = 3

  const [loopId, setLoopId] = useState<string>('')
  const [arrangementType, setArrangementType] = useState<'bars' | 'duration'>('bars')
  const [bars, setBars] = useState<string>('8')
  const [duration, setDuration] = useState<string>('30')

  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [arrangementId, setArrangementId] = useState<number | null>(null)
  const [arrangementStatus, setArrangementStatus] = useState<ArrangementStatusResponse | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  /** True once audio download for the main arrangement preview has failed after
   *  MAX_PREVIEW_DOWNLOAD_ATTEMPTS.  Only resets when a new arrangement/generation
   *  cycle begins.  Prevents the arrangement preview area from spinning forever. */
  const [audioUnavailable, setAudioUnavailable] = useState(false)
  const [loopAudioUrl, setLoopAudioUrl] = useState<string | null>(null)
  const [historyRows, setHistoryRows] = useState<Arrangement[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all')
  const [historyLoopIdFilter, setHistoryLoopIdFilter] = useState<string>('')
  const [stylePresets, setStylePresets] = useState<StylePresetResponse[]>([])
  const [stylePreset, setStylePreset] = useState<string>('')
  const [seed, setSeed] = useState<string>('')
  const [selectedMoves, setSelectedMoves] = useState<string[]>([])
  const [structurePreview, setStructurePreview] = useState<Array<{ name: string; bars: number; energy: number }>>([])
  const [previewCandidates, setPreviewCandidates] = useState<PreviewCandidateState[]>([])
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | null>(null)
  const [debugReport, setDebugReport] = useState<ProducerDebugSection[] | null>(null)
  const [aiPlanDraft, setAiPlanDraft] = useState<ArrangementPlanSection[] | null>(null)
  const [aiPlanMeta, setAiPlanMeta] = useState<ArrangementPlanResponse['planner_meta'] | null>(null)
  const [aiPlanValidation, setAiPlanValidation] = useState<ArrangementPlanResponse['validation'] | null>(null)
  // Producer Engine V2 state
  const [producerPlanV2, setProducerPlanV2] = useState<ProducerPlanV2 | null>(null)
  const [producerNotes, setProducerNotes] = useState<string[] | null>(null)
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null)
  const [sectionSummary, setSectionSummary] = useState<SectionSummaryItem[] | null>(null)
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[] | null>(null)

  // Reference-guided arrangement state
  const [referenceAnalysisId, setReferenceAnalysisId] = useState<string | null>(null)
  const [referenceSummary, setReferenceSummary] = useState<ReferenceAnalysisSummary | undefined>(undefined)
  const [adaptationStrength, setAdaptationStrength] = useState<AdaptationStrength>('medium')
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>('structure_energy')
  /** Tracks reference params that were active when the last arrangement was generated. */
  const [activeReferenceAnalysisId, setActiveReferenceAnalysisId] = useState<string | null>(null)
  const [activeReferenceSummary, setActiveReferenceSummary] = useState<ReferenceAnalysisSummary | undefined>(undefined)
  const [activeAdaptationStrength, setActiveAdaptationStrength] = useState<AdaptationStrength>('medium')
  const [activeGuidanceMode, setActiveGuidanceMode] = useState<GuidanceMode>('structure_energy')
  const [referenceStructureSummary, setReferenceStructureSummary] = useState<string | null>(null)

  // V2: Natural language style input
  const [styleMode, setStyleMode] = useState<'preset' | 'naturalLanguage'>('preset')
  const [styleTextInput, setStyleTextInput] = useState<string>('')
  const [useAiParsing, setUseAiParsing] = useState<boolean>(true)
  
  // PHASE 3: Style parameters from sliders
  const [styleProfile, setStyleProfile] = useState<Partial<SimpleStyleProfile>>({
    intent: '',
    energy: 0.5,
    darkness: 0.5,
    bounce: 0.5,
    warmth: 0.5,
    texture: 'balanced',
    references: [],
    avoid: [],
    seed: 42,
    confidence: 0.8,
  })

  const [currentJobId, setCurrentJobId] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingErrorCountRef = useRef<number>(0)
  const jobPollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const jobPollingErrorCountRef = useRef<number>(0)
  const audioUrlRef = useRef<string | null>(null)
  const loopAudioUrlRef = useRef<string | null>(null)
  // Tracks current candidates for use in cleanup (avoids stale closure in unmount effect)
  const previewCandidatesRef = useRef<PreviewCandidateState[]>([])
  // Holds the candidates-polling interval handle so we can stop it early once all
  // candidates reach a terminal state (done/failed/completed).
  const candidatesIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Tracks how many times we have attempted to download the preview audio for
  // each candidate.  Keyed by arrangement_id.  Reset when candidates are cleared.
  const candidateDownloadAttemptsRef = useRef<Map<number, number>>(new Map())
  // Tracks how many times we have attempted to download the main arrangement audio
  // (standalone flow, no candidates).  Reset when arrangementId changes.
  const audioDownloadAttemptsRef = useRef<number>(0)

  const clearPreviewCandidates = () => {
    setPreviewCandidates((current) => {
      current.forEach((candidate) => {
        if (candidate.audioUrl) {
          URL.revokeObjectURL(candidate.audioUrl)
        }
      })
      return []
    })
    setSelectedPreviewId(null)
    // Reset per-candidate download attempt counters so a fresh generation starts
    // with a clean slate.
    candidateDownloadAttemptsRef.current.clear()
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const queryLoopId = urlParams.get('loopId')
    if (queryLoopId) {
      setLoopId(queryLoopId)
    }
  }, [])

  const loadHistory = useCallback(async (requestedLoopId?: number, statusFilter?: string) => {
    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const rows = await listArrangements({
        loopId: requestedLoopId,
        status: statusFilter || historyStatusFilter,
        limit: 10,
      })
      setHistoryRows(rows)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setHistoryError(err.message)
      } else {
        setHistoryError('Failed to load generation history.')
      }
    } finally {
      setIsHistoryLoading(false)
    }
  }, [historyStatusFilter])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const loadStyles = async () => {
      try {
        const presets = await listStylePresets()
        setStylePresets(presets)
        if (presets.length > 0) {
          setStylePreset(presets[0].id)
        }
      } catch {
        setStylePresets([])
      }
    }
    loadStyles()
  }, [])

  // Poll arrangement status (used only when there are no preview candidates)
  useEffect(() => {
    if (!arrangementId) return
    if (previewCandidates.length > 0) return

    // Reset download attempt counter for each new arrangement being tracked.
    audioDownloadAttemptsRef.current = 0

    const pollStatus = async () => {
      try {
        const status = await getArrangementStatus(arrangementId)
        pollingErrorCountRef.current = 0
        setArrangementStatus(status)
        console.log('[LoopArchitect] Polling status:', arrangementId, status.status,
          '| output_file_url:', status.output_file_url,
          '| output_url:', status.output_url,
          '| preview_url:', status.preview_url)

        const isFinished =
          status.status === 'done' || status.status === 'completed' || status.status === 'failed'

        if (isFinished) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }

          await loadHistory()

          if (status.status === 'done' || status.status === 'completed') {
            // Only attempt the download if we haven't already succeeded or exhausted retries.
            if (!audioUrlRef.current && !audioUnavailable) {
              // PRIMARY PATH: use preview_url, output_file_url, or output_url directly
              // when the backend provides a servable URL.  resolveArrangementAudioUrl
              // centralises field-name normalisation across both polling paths.
              const resolvedAudioUrl = resolveArrangementAudioUrl(status)
              console.log('[LoopArchitect] Resolved audio URL for', arrangementId, ':', resolvedAudioUrl)
              if (resolvedAudioUrl) {
                console.log('[LoopArchitect] Calling setAudioUrl (direct) for', arrangementId, ':', resolvedAudioUrl)
                audioDownloadAttemptsRef.current = 0
                setAudioUrl(resolvedAudioUrl)
              } else {
                // FALLBACK PATH: blob download via /download endpoint.
                const attempts = audioDownloadAttemptsRef.current
                if (attempts >= MAX_PREVIEW_DOWNLOAD_ATTEMPTS) {
                  console.warn('[LoopArchitect] max-attempts-reached – marking main preview as unavailable')
                  setAudioUnavailable(true)
                } else {
                  audioDownloadAttemptsRef.current = attempts + 1
                  console.log('[LoopArchitect] Arrangement done – downloading audio for', arrangementId, `(attempt ${attempts + 1}/${MAX_PREVIEW_DOWNLOAD_ATTEMPTS})`)
                  try {
                    const blob = await downloadArrangement(arrangementId)
                    const url = URL.createObjectURL(blob)
                    console.log('[LoopArchitect] Audio blob URL created:', url)
                    // Reset counter on success so we don't wrongly skip future arrangements.
                    audioDownloadAttemptsRef.current = 0
                    setAudioUrl(url)
                  } catch (err) {
                    console.error('[LoopArchitect] Failed to load audio preview (attempt', audioDownloadAttemptsRef.current, '):', err)
                    if (audioDownloadAttemptsRef.current >= MAX_PREVIEW_DOWNLOAD_ATTEMPTS) {
                      console.warn('[LoopArchitect] max-attempts-reached – marking main preview as unavailable')
                      setAudioUnavailable(true)
                    }
                  }
                }
              }

              // Load the original loop audio for before/after comparison once we
              // have (or are about to have) a preview URL – regardless of path taken.
              if (loopId) {
                try {
                  const loopUrl = await downloadLoop(parseInt(loopId))
                  setLoopAudioUrl(loopUrl)
                } catch (loopErr) {
                  console.error('Failed to load loop audio:', loopErr)
                }
              }
            }

            // Load producer debug report and V2 producer insights
            let metaHasProducerPlan = false
            let metaHasProducerNotes = false
            let metaHasQualityScore = false
            let metaHasSectionSummary = false
            let metaHasDecisionLog = false
            try {
              const meta = await getArrangementMetadata(arrangementId)
              setDebugReport(meta.producer_debug_report ?? null)
              // V2 fields from metadata (preferred source)
              if (meta.producer_plan != null) { setProducerPlanV2(meta.producer_plan); metaHasProducerPlan = true }
              if (meta.producer_notes != null) { setProducerNotes(meta.producer_notes); metaHasProducerNotes = true }
              if (meta.quality_score != null) { setQualityScore(meta.quality_score); metaHasQualityScore = true }
              if (meta.section_summary != null) { setSectionSummary(meta.section_summary); metaHasSectionSummary = true }
              if (meta.decision_log != null) { setDecisionLog(meta.decision_log); metaHasDecisionLog = true }
              if (meta.reference_structure_summary != null) { setReferenceStructureSummary(meta.reference_structure_summary) }
            } catch (metaErr) {
              console.error('Failed to load arrangement metadata:', metaErr)
            }

            // V2 fields may also arrive inline on the status response; only use
            // as fallback when metadata did not supply the field.
            if (status.producer_plan != null && !metaHasProducerPlan) setProducerPlanV2(status.producer_plan)
            if (status.producer_notes != null && !metaHasProducerNotes) setProducerNotes(status.producer_notes)
            if (status.quality_score != null && !metaHasQualityScore) setQualityScore(status.quality_score)
            if (status.section_summary != null && !metaHasSectionSummary) setSectionSummary(status.section_summary)
            if (status.decision_log != null && !metaHasDecisionLog) setDecisionLog(status.decision_log)
          }
        }
      } catch (err) {
        console.error('Error polling status:', err)
        pollingErrorCountRef.current += 1
        if (pollingErrorCountRef.current >= 5) {
          setError('Temporary connection issue while checking status. Retrying...')
        }
      }
    }

    // Initial poll
    pollStatus()

    // Poll every 3 seconds
    pollingIntervalRef.current = setInterval(pollStatus, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [arrangementId, loadHistory, loopId, previewCandidates.length, audioUnavailable])


  // Poll preview candidates.
  //
  // ROOT CAUSE FIX: The dependency array uses `previewCandidates.length` (not the
  // full `previewCandidates` array).  Previously using the full array caused this
  // effect to re-run every time `setPreviewCandidates` was called from *inside*
  // the interval callback, creating an infinite re-run loop.  Each re-run cleared
  // the interval and immediately fired a new poll with a stale closure where
  // `candidate.audioUrl` was still null.  When those stale polls completed they
  // called `setPreviewCandidates` again with `audioUrl: null`, which caused
  // effect #6 (selectedPreviewId sync) to write `null` into the main `audioUrl`
  // state, clearing the player.
  //
  // The interval callback now reads candidates from `previewCandidatesRef` so it
  // always operates on the freshest state without needing the state value in deps.
  useEffect(() => {
    if (previewCandidates.length === 0) return

    const pollCandidates = async () => {
      const current = previewCandidatesRef.current

      // A candidate still needs work if it is in a pending state OR if it has
      // reached done/completed but we have not yet successfully obtained a
      // playable audio URL (and haven't exhausted download retries).
      const hasPending = current.some(
        (c) =>
          c.status === 'queued' ||
          c.status === 'processing' ||
          c.status === 'pending' ||
          ((c.status === 'done' || c.status === 'completed') && !c.audioUrl && !c.audioUnavailable)
      )
      if (!hasPending) {
        // All candidates are in a terminal state – stop the interval now rather
        // than letting it run no-op checks every 3 seconds.
        if (candidatesIntervalRef.current) {
          clearInterval(candidatesIntervalRef.current)
          candidatesIntervalRef.current = null
        }
        return
      }

      console.log('[variation-preview] Polling', current.length, 'candidate(s)')
      const nextCandidates = await Promise.all(
        current.map(async (candidate) => {
          const isStillPending =
            candidate.status === 'queued' ||
            candidate.status === 'processing' ||
            candidate.status === 'pending'
          const needsAudio =
            (candidate.status === 'done' || candidate.status === 'completed') &&
            !candidate.audioUrl &&
            !candidate.audioUnavailable

          if (!isStillPending && !needsAudio) {
            // Already in a terminal state with audio (or failed/unavailable) – skip.
            return candidate
          }

          // ── Retry audio download for done-without-audio candidates ──────────
          // The candidate status is already done/completed; we only need to
          // (re)attempt downloading the audio blob.
          if (needsAudio) {
            // ROOT CAUSE FIX: Re-poll the backend before every blob-download attempt
            // so that a preview_url set asynchronously by the preview worker is
            // discovered.  Previously, only the stale cached arrangementStatus was
            // checked, meaning a freshly-available preview_url was never picked up
            // and all retries were wasted, ending in audioUnavailable prematurely.
            let freshStatus: ArrangementStatusResponse | null | undefined = candidate.arrangementStatus
            try {
              freshStatus = await getArrangementStatus(candidate.arrangement_id)
              console.log(
                `[variation-preview] needs-audio-repoll – candidate ${candidate.arrangement_id}`,
                'preview_url:', freshStatus.preview_url,
                'output_file_url:', freshStatus.output_file_url,
                'output_url:', freshStatus.output_url,
              )
            } catch (repollError) {
              console.warn(
                `[variation-preview] needs-audio-repoll-failed – candidate ${candidate.arrangement_id}:`,
                repollError
              )
            }

            const freshDirectUrl = resolveArrangementAudioUrl(freshStatus ?? {})
            if (freshDirectUrl) {
              console.log(
                `[variation-preview] direct-url-hit (fresh repoll) – candidate ${candidate.arrangement_id}`,
                freshDirectUrl
              )
              candidateDownloadAttemptsRef.current.delete(candidate.arrangement_id)
              return {
                ...candidate,
                audioUrl: freshDirectUrl,
                arrangementStatus: freshStatus ?? candidate.arrangementStatus,
              }
            }

            const attempts = candidateDownloadAttemptsRef.current.get(candidate.arrangement_id) ?? 0
            console.log(
              `[variation-preview] audio-retry – candidate ${candidate.arrangement_id} attempt ${attempts + 1}/${MAX_PREVIEW_DOWNLOAD_ATTEMPTS}`
            )
            if (attempts >= MAX_PREVIEW_DOWNLOAD_ATTEMPTS) {
              console.warn(
                `[variation-preview] max-attempts-reached – candidate ${candidate.arrangement_id} – marking as unavailable`
              )
              return {
                ...candidate,
                audioUnavailable: true,
                arrangementStatus: freshStatus ?? candidate.arrangementStatus,
              }
            }
            candidateDownloadAttemptsRef.current.set(candidate.arrangement_id, attempts + 1)
            try {
              console.log(`[variation-preview] fetch-start – candidate ${candidate.arrangement_id}`)
              const blob = await downloadArrangement(candidate.arrangement_id)
              const url = URL.createObjectURL(blob)
              console.log(
                `[variation-preview] fetch-success – candidate ${candidate.arrangement_id}`,
                url
              )
              // Download succeeded – remove the attempt counter.
              candidateDownloadAttemptsRef.current.delete(candidate.arrangement_id)
              return {
                ...candidate,
                audioUrl: url,
                arrangementStatus: freshStatus ?? candidate.arrangementStatus,
              }
            } catch (audioError) {
              console.error(
                `[variation-preview] fetch-failed – candidate ${candidate.arrangement_id}:`,
                audioError
              )
              // Will be retried on the next tick until MAX_PREVIEW_DOWNLOAD_ATTEMPTS.
              return { ...candidate, arrangementStatus: freshStatus ?? candidate.arrangementStatus }
            }
          }

          // ── Normal pending status poll ────────────────────────────────────────
          try {
            console.log(`[variation-preview] status-poll – candidate ${candidate.arrangement_id} current=${candidate.status}`)
            const status = await getArrangementStatus(candidate.arrangement_id)
            console.log(`[variation-preview] status-transition – candidate ${candidate.arrangement_id} ${candidate.status} → ${status.status}`)
            // Preserve existing audioUrl – never overwrite a valid URL with null
            let nextAudioUrl = candidate.audioUrl ?? null

            if (!nextAudioUrl && (status.status === 'done' || status.status === 'completed')) {
              // PRIMARY: use a directly-servable URL from the status response.
              const directUrl = resolveArrangementAudioUrl(status)
              if (directUrl) {
                console.log(
                  `[variation-preview] direct-url-hit – candidate ${candidate.arrangement_id}`,
                  directUrl
                )
                nextAudioUrl = directUrl
              } else {
                // FALLBACK: blob download.
                try {
                  console.log(`[variation-preview] fetch-start – candidate ${candidate.arrangement_id} (first attempt on READY)`)
                  const blob = await downloadArrangement(candidate.arrangement_id)
                  nextAudioUrl = URL.createObjectURL(blob)
                  console.log(
                    `[variation-preview] fetch-success – candidate ${candidate.arrangement_id}`,
                    nextAudioUrl
                  )
                } catch (audioError) {
                  console.error(
                    `[variation-preview] fetch-failed – candidate ${candidate.arrangement_id}:`,
                    audioError
                  )
                  // nextAudioUrl stays null; the needsAudio retry path will handle
                  // subsequent attempts on the next tick.
                }
              }
            }

            return {
              ...candidate,
              status: status.status,
              arrangementStatus: status,
              audioUrl: nextAudioUrl,
            }
          } catch (statusError) {
            console.error(
              `[variation-preview] status-poll-failed – candidate ${candidate.arrangement_id}:`,
              statusError
            )
            return candidate
          }
        })
      )

      setPreviewCandidates((current) =>
        // Functional update: merge nextCandidates into the LATEST state so that
        // a stale concurrent poll cannot overwrite terminal states that were set
        // by a faster concurrent poll tick.
        nextCandidates.map((next) => {
          const existing = current.find((c) => c.arrangement_id === next.arrangement_id)
          // Guard 1: never overwrite terminal unavailable state (sticky until new identity)
          if (existing?.audioUnavailable && !next.audioUnavailable) {
            console.log(
              `[variation-preview] guard-terminal – candidate ${next.arrangement_id} already unavailable; discarding stale update`
            )
            return existing
          }
          // Guard 2: never clear a valid audio URL because a stale poll omitted it
          if (existing?.audioUrl && !next.audioUrl) {
            return { ...next, audioUrl: existing.audioUrl }
          }
          return next
        })
      )
      await loadHistory()
    }

    pollCandidates()
    const interval = setInterval(pollCandidates, 3000)
    candidatesIntervalRef.current = interval
    return () => {
      clearInterval(interval)
      candidatesIntervalRef.current = null
    }
    // IMPORTANT: only `previewCandidates.length` (not the full array) is listed
    // as a dependency so that status changes inside the array do NOT restart this
    // effect.  The ref (`previewCandidatesRef`) is kept in sync separately and
    // gives the interval callback access to fresh state without closing over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadHistory, previewCandidates.length])

  // Poll async render job status.
  // Starts when currentJobId is set (by handleGenerate). Runs until the job
  // reaches a terminal state ('finished' or 'failed'), then clears itself and
  // sets isGenerating = false so the Generate button re-enables.
  useEffect(() => {
    if (!currentJobId) return

    jobPollingErrorCountRef.current = 0

    const pollJob = async () => {
      try {
        const job = await getJobStatus(currentJobId)
        console.log('job_status_update', { job_id: currentJobId, status: job.status })

        if (job.status === 'finished') {
          if (jobPollingIntervalRef.current) {
            clearInterval(jobPollingIntervalRef.current)
            jobPollingIntervalRef.current = null
          }
          setCurrentJobId(null)

          // Resolve a playable audio URL from the finished job
          const jobAudioUrl = job.audio_url || job.preview_url || null
          if (jobAudioUrl) {
            setAudioUrl(jobAudioUrl)
          }

          // Build candidate list from job response, falling back to a single
          // entry constructed from arrangement_id when no candidates array is
          // returned.
          const rawCandidates = (job.candidates && job.candidates.length > 0)
            ? job.candidates
            : (job.arrangement_id
              ? [{
                  arrangement_id: job.arrangement_id,
                  status: 'done' as const,
                  created_at: job.updated_at || new Date().toISOString(),
                  render_job_id: job.job_id,
                  seed_used: job.seed_used,
                }]
              : [])

          if (rawCandidates.length > 0) {
            const enriched = rawCandidates.map((c) => ({
              ...c,
              audioUrl: jobAudioUrl ?? null,
            }))
            setPreviewCandidates(enriched)
            setSelectedPreviewId(rawCandidates[0].arrangement_id)
            setArrangementId(rawCandidates[0].arrangement_id)
          }

          if (job.structure_preview) {
            setStructurePreview(job.structure_preview)
          }

          const loopIdNum = loopId ? parseInt(loopId, 10) : undefined
          await loadHistory(loopIdNum && !Number.isNaN(loopIdNum) ? loopIdNum : undefined)
          setIsGenerating(false)
        } else if (job.status === 'failed') {
          if (jobPollingIntervalRef.current) {
            clearInterval(jobPollingIntervalRef.current)
            jobPollingIntervalRef.current = null
          }
          setCurrentJobId(null)
          setError(job.error_message || 'Render job failed. Please try again.')
          setIsGenerating(false)
        }
      } catch (err) {
        jobPollingErrorCountRef.current += 1
        console.error('Error polling job status:', err)
        if (jobPollingErrorCountRef.current >= 5) {
          if (jobPollingIntervalRef.current) {
            clearInterval(jobPollingIntervalRef.current)
            jobPollingIntervalRef.current = null
          }
          setCurrentJobId(null)
          setError('Connection issue while checking render status. Please try again.')
          setIsGenerating(false)
        }
      }
    }

    pollJob()
    jobPollingIntervalRef.current = setInterval(pollJob, 3000)

    return () => {
      if (jobPollingIntervalRef.current) {
        clearInterval(jobPollingIntervalRef.current)
        jobPollingIntervalRef.current = null
      }
    }
  }, [currentJobId, loadHistory, loopId])

  // Sync selectedPreviewId → main arrangement state.
  //
  // DEFENSIVE FIX: When `previewCandidates` updates (e.g. after a poll tick) but
  // `selected.audioUrl` is still null/undefined (audio not yet downloaded), we
  // must NOT overwrite an already-valid `audioUrl` with null.  Previously the
  // unconditional `setAudioUrl(selected.audioUrl ?? null)` would clear the player
  // every time polling updated the candidate before the audio was ready.
  //
  // TERMINAL STATE FIX: Propagate `selected.audioUnavailable` to the main
  // `audioUnavailable` state so the arrangement preview area shows a stable
  // fallback instead of an infinite spinner when the selected candidate has
  // exhausted its download retries.
  useEffect(() => {
    if (!selectedPreviewId) return
    const selected = previewCandidates.find((candidate) => candidate.arrangement_id === selectedPreviewId)
    if (!selected) return

    if (selected.arrangementStatus) {
      setArrangementId(selected.arrangement_id)
      setArrangementStatus(selected.arrangementStatus)

      if (selected.audioUrl != null) {
        // A valid URL is available – use it and clear any stale unavailable flag.
        console.log('[LoopArchitect] Setting audioUrl from selected candidate:', selected.audioUrl)
        setAudioUrl(selected.audioUrl)
        setAudioUnavailable(false)
      } else if (selected.audioUnavailable) {
        // Candidate has exhausted retries – propagate the terminal state.
        console.log('[LoopArchitect] Selected candidate is audioUnavailable – showing fallback for', selected.arrangement_id)
        setAudioUnavailable(true)
      }
      // If selected.audioUrl is null but not yet unavailable (still in progress),
      // leave both audioUrl and audioUnavailable unchanged so the current player /
      // loading state is preserved without flicker.

      const isDone = selected.arrangementStatus.status === 'done' || selected.arrangementStatus.status === 'completed'
      if (isDone && loopId && !loopAudioUrl) {
        downloadLoop(parseInt(loopId, 10))
          .then((loopUrl) => setLoopAudioUrl(loopUrl))
          .catch((loopErr) => console.error('Failed to load loop audio:', loopErr))
      }
    }
  }, [selectedPreviewId, previewCandidates, loopId, loopAudioUrl])

  useEffect(() => {
    audioUrlRef.current = audioUrl
    console.log('[LoopArchitect] audioUrl state changed:', audioUrl)
  }, [audioUrl])

  useEffect(() => {
    loopAudioUrlRef.current = loopAudioUrl
  }, [loopAudioUrl])

  // Keep previewCandidatesRef in sync so the polling interval and unmount
  // cleanup always have access to the latest candidates without closing over
  // stale state.
  useEffect(() => {
    previewCandidatesRef.current = previewCandidates
  }, [previewCandidates])

  // Cleanup audio blob URLs on component unmount ONLY.
  //
  // ROOT CAUSE FIX: The dependency array is `[]` (empty), not `[previewCandidates]`.
  //
  // Previously `[previewCandidates]` was listed as a dependency.  React runs the
  // *cleanup* of a useEffect whenever its dependencies change, not only on
  // unmount.  So every call to `setPreviewCandidates` (which happens on every
  // 3-second poll tick) was triggering `URL.revokeObjectURL(audioUrlRef.current)`,
  // invalidating the blob URL that the AudioPlayer had just been given.  The
  // player then received a revoked URL → reset to 0:00 / 0:00.
  //
  // Candidate URLs are now accessed via `previewCandidatesRef` (kept in sync
  // above) so they are still correctly revoked on unmount.
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
      if (loopAudioUrlRef.current) {
        URL.revokeObjectURL(loopAudioUrlRef.current)
      }
      previewCandidatesRef.current.forEach((candidate) => {
        if (candidate.audioUrl) {
          URL.revokeObjectURL(candidate.audioUrl)
        }
      })
    }
  }, []) // empty deps – runs cleanup ONLY on component unmount

  const handleHistoryRefresh = async () => {
    const loopIdNum = parseInt(historyLoopIdFilter || loopId, 10)
    const validLoopId = !Number.isNaN(loopIdNum) && loopIdNum > 0 ? loopIdNum : undefined
    await loadHistory(validLoopId, historyStatusFilter)
  }

  const handleHistoryDownload = async (selectedArrangementId: number) => {
    try {
      const blob = await downloadArrangement(selectedArrangementId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `arrangement_${selectedArrangementId}.wav`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to download arrangement.')
      }
    }
  }

  const handleFilterChange = (status: string, loopId: string) => {
    setHistoryStatusFilter(status)
    setHistoryLoopIdFilter(loopId)
    
    const loopIdNum = loopId ? parseInt(loopId, 10) : undefined
    const validLoopId = loopIdNum && !Number.isNaN(loopIdNum) && loopIdNum > 0 ? loopIdNum : undefined
    
    loadHistory(validLoopId, status)
  }

  const handleRetry = (retryLoopId: number, targetSeconds: number) => {
    setLoopId(String(retryLoopId))
    setArrangementType('duration')
    setDuration(String(targetSeconds))
    setArrangementId(null)
    setArrangementStatus(null)
    clearPreviewCandidates()
    setDebugReport(null)
    setAiPlanDraft(null)
    setAiPlanMeta(null)
    setAiPlanValidation(null)
    setProducerPlanV2(null)
    setProducerNotes(null)
    setQualityScore(null)
    setSectionSummary(null)
    setDecisionLog(null)
    setError(null)
    setAudioUnavailable(false)
    audioDownloadAttemptsRef.current = 0
    setActiveReferenceAnalysisId(null)
    setActiveReferenceSummary(undefined)
    setReferenceStructureSummary(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    if (loopAudioUrl) {
      URL.revokeObjectURL(loopAudioUrl)
      setLoopAudioUrl(null)
    }
  }

  const previewArrangementPlan = async (
    loopDetails: Awaited<ReturnType<typeof getLoop>>,
    loopBpm: number,
  ) => {
    const detectedRoles = loopDetails.stem_metadata?.roles_detected || []
    const inferredSourceType: 'loop' | 'stem_pack' | 'unknown' =
      detectedRoles.length >= 2 ? 'stem_pack' : 'loop'

    const targetBars = arrangementType === 'bars'
      ? parseInt(bars, 10)
      : null

    const plannerUserRequest = [
      styleMode === 'naturalLanguage' ? styleTextInput.trim() : stylePreset,
      selectedMoves.length ? `producer moves: ${selectedMoves.join(', ')}` : null,
    ].filter(Boolean).join('; ')

    const planResponse = await getArrangementPlan({
      input: {
        bpm: loopBpm,
        key: loopDetails.key || loopDetails.musical_key || null,
        time_signature: null,
        bars_available: loopDetails.bars || null,
        genre_hint: loopDetails.genre || null,
        mood_hint: null,
        detected_roles: detectedRoles,
        preferred_structure: null,
        target_total_bars: targetBars,
        source_type: inferredSourceType,
      },
      user_request: plannerUserRequest || undefined,
      planner_config: {
        strict: true,
        max_sections: 10,
        allow_full_mix: true,
      },
    })

    setAiPlanDraft(planResponse.plan.sections || null)
    setAiPlanMeta(planResponse.planner_meta)
    setAiPlanValidation(planResponse.validation)
  }

  const handlePreviewPlan = async () => {
    if (!loopId) {
      setError('Please enter a Loop ID')
      return
    }

    const loopIdNum = parseInt(loopId, 10)
    if (isNaN(loopIdNum) || loopIdNum <= 0) {
      setError('Loop ID must be a positive number')
      return
    }

    setIsPlanning(true)
    setError(null)

    try {
      await validateLoopSource(loopIdNum)
      const loopDetails = await getLoop(loopIdNum)
      const loopBpm = Number(loopDetails.bpm || loopDetails.tempo || 120)
      await previewArrangementPlan(loopDetails, loopBpm)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to preview AI arrangement plan. Please try again.')
      }
    } finally {
      setIsPlanning(false)
    }
  }

  const handleGenerate = async () => {
    if (!loopId) {
      setError('Please enter a Loop ID')
      return
    }

    const loopIdNum = parseInt(loopId, 10)
    if (isNaN(loopIdNum) || loopIdNum <= 0) {
      setError('Loop ID must be a positive number')
      return
    }

    setIsGenerating(true)
    setError(null)
    setArrangementId(null)
    setArrangementStatus(null)
    clearPreviewCandidates()
    setStructurePreview([])
    setDebugReport(null)
    setAiPlanDraft(null)
    setAiPlanMeta(null)
    setAiPlanValidation(null)
    setProducerPlanV2(null)
    setProducerNotes(null)
    setQualityScore(null)
    setSectionSummary(null)
    setDecisionLog(null)
    setAudioUnavailable(false)
    audioDownloadAttemptsRef.current = 0
    setActiveReferenceAnalysisId(referenceAnalysisId)
    setActiveReferenceSummary(referenceSummary)
    setActiveAdaptationStrength(adaptationStrength)
    setActiveGuidanceMode(guidanceMode)
    setReferenceStructureSummary(null)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    if (loopAudioUrl) {
      URL.revokeObjectURL(loopAudioUrl)
      setLoopAudioUrl(null)
    }

    // Tracks whether a job_id was successfully dispatched so the finally block
    // knows not to clear isGenerating (the job-polling useEffect does that).
    let jobDispatched = false

    try {
      // Pre-check loop source availability so users don't queue doomed jobs
      await validateLoopSource(loopIdNum)
      const loopDetails = await getLoop(loopIdNum)
      const loopBpm = Number(loopDetails.bpm || loopDetails.tempo || 120)

      const options: { 
        bars?: number
        duration?: number
        loopBpm?: number
        stylePreset?: string
        styleParams?: Record<string, number | string>
        seed?: number | string
        variationCount?: number
        autoSave?: boolean
        styleTextInput?: string
        useAiParsing?: boolean
        producerMoves?: string[]
        arrangementPlan?: ArrangementPlanResponse['plan']
        referenceAnalysisId?: string
        adaptationStrength?: AdaptationStrength
        guidanceMode?: GuidanceMode
      } = {}
      
      if (arrangementType === 'bars') {
        const barsNum = parseInt(bars, 10)
        if (isNaN(barsNum) || barsNum <= 0) {
          setError('Bars must be a positive number')
          setIsGenerating(false)
          return
        }
        options.bars = barsNum
        options.loopBpm = loopBpm
      } else {
        const durationNum = parseInt(duration, 10)
        if (isNaN(durationNum) || durationNum <= 0) {
          setError('Duration must be a positive number')
          setIsGenerating(false)
          return
        }
        options.duration = durationNum
      }

      // V2: Include natural language style input if in that mode
      if (styleMode === 'naturalLanguage') {
        if (!styleTextInput.trim()) {
          setError('Please enter a style description or switch to Preset mode')
          setIsGenerating(false)
          return
        }
        options.styleTextInput = styleTextInput.trim()
        options.useAiParsing = useAiParsing
        
        // PHASE 4: Include style slider values if any are set
        if (styleProfile && Object.keys(styleProfile).length > 0) {
          options.styleParams = styleProfile as Record<string, number | string>
        }
      } else {
        // V1: Include preset-based style
        if (stylePreset) {
          options.stylePreset = stylePreset
        }
      }
      
      if (seed.trim()) {
        const numericSeed = Number(seed)
        options.seed = Number.isNaN(numericSeed) ? seed.trim() : numericSeed
      }

      // Include producer moves
      if (selectedMoves.length > 0) {
        options.producerMoves = selectedMoves
      }

      options.variationCount = 3
      options.autoSave = false

      // Include reference guidance parameters when a reference has been analyzed
      if (referenceAnalysisId) {
        options.referenceAnalysisId = referenceAnalysisId
        options.adaptationStrength = adaptationStrength
        options.guidanceMode = guidanceMode
      }

      // AI plan preview (best-effort). Do not block render enqueue if planning fails.
      try {
        await previewArrangementPlan(loopDetails, loopBpm)
      } catch (planErr) {
        console.warn('AI plan preview unavailable, continuing generation:', planErr)
        setAiPlanDraft(null)
        setAiPlanMeta(null)
        setAiPlanValidation(null)
      }

      // Use edited AI plan as deterministic arrangement input when available
      if (aiPlanDraft && aiPlanDraft.length > 0) {
        const cleanedSections = aiPlanDraft.map((section, index) => {
          const cleanedRoles = Array.from(
            new Set(
              (section.active_roles || [])
                .map((role) => role.trim().toLowerCase())
                .filter((role) => role.length > 0)
            )
          )

          return {
            ...section,
            index,
            bars: Math.max(1, Number(section.bars) || 1),
            energy: Math.min(5, Math.max(1, Number(section.energy) || 1)),
            active_roles: cleanedRoles,
          }
        })

        const totalBars = cleanedSections.reduce((sum, section) => sum + section.bars, 0)

        options.arrangementPlan = {
          structure: cleanedSections.map((section) => section.type),
          total_bars: totalBars,
          sections: cleanedSections,
          planner_notes: {
            strategy: 'User-edited AI plan preview',
            fallback_used: Boolean(aiPlanMeta?.fallback_used),
          },
        }
      }

      // Dispatch async render job – the job-polling useEffect takes over from here.
      console.log('render_async_called')
      const renderResponse = await renderLoopAsync(loopIdNum, options)
      console.log('job_id_received', renderResponse.job_id)
      setCurrentJobId(renderResponse.job_id)
      jobDispatched = true

      // Optimistic history refresh so the row appears immediately.
      await loadHistory(loopIdNum)
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        // Check for missing file error (400 status with "missing" in message)
        if ((err.status === 400 || err.status === 404) && err.message.toLowerCase().includes('missing')) {
          setError(`file_missing:${err.message}`)
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to generate arrangement. Please try again.')
      }
    } finally {
      // Only stop the generating spinner when no job has been dispatched.
      // When a job_id has been received, the job-polling useEffect clears
      // isGenerating once the job reaches a terminal state ('finished'/'failed').
      if (!jobDispatched) {
        setIsGenerating(false)
      }
    }
  }

  const handleSavePreview = async (candidateId: number) => {
    try {
      await saveArrangement(candidateId)
      setPreviewCandidates((current) =>
        current.map((candidate) =>
          candidate.arrangement_id === candidateId
            ? { ...candidate, isSaved: true }
            : candidate
        )
      )
      await loadHistory()
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to save arrangement preview.')
      }
    }
  }

  // Requeue a preview render that failed or was never completed.
  // Resets the audioUnavailable / attempt-counter state for the affected
  // arrangement so the polling loop can pick up the result once the worker
  // finishes the new job.
  const handleRetryPreview = async (retryArrangementId: number) => {
    try {
      await retryPreviewRender(retryArrangementId)
      console.log('[LoopArchitect] Preview render re-queued for', retryArrangementId)
    } catch (err) {
      // Surface the error but don't block the reset below – even if the
      // backend doesn't support the endpoint yet, resetting the local state
      // gives the existing poll loop another chance to download the audio.
      if (err instanceof LoopArchitectApiError) {
        console.warn('[LoopArchitect] retryPreviewRender API error:', err.message)
      } else {
        console.warn('[LoopArchitect] retryPreviewRender unexpected error:', err)
      }
    }

    // Always reset local state so the polling loop retries the download.
    setPreviewCandidates((current) =>
      current.map((candidate) =>
        candidate.arrangement_id === retryArrangementId
          ? { ...candidate, audioUnavailable: false, audioUrl: null }
          : candidate
      )
    )
    candidateDownloadAttemptsRef.current.delete(retryArrangementId)

    // If this was the selected / main candidate, also reset the main state.
    if (retryArrangementId === arrangementId || retryArrangementId === selectedPreviewId) {
      setAudioUnavailable(false)
      audioDownloadAttemptsRef.current = 0
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
        setAudioUrl(null)
      }
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg
                className="h-8 w-8 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <h1 className="text-2xl font-bold text-white">LoopArchitect</h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Upload
              </Link>
              <Link
                href="/generate"
                className="text-white font-medium hover:text-blue-400 transition-colors"
              >
                Generate
              </Link>
              <HelpButton contentKey="generate" variant="icon" />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="max-w-3xl w-full space-y-10">
          {/* Page Title */}
          <div className="text-center space-y-3">
            <h2 className="text-4xl md:text-5xl font-bold text-white">
              Generate Arrangement
            </h2>
            <p className="text-lg text-gray-400">
              Create a professional arrangement from your uploaded loop
            </p>
          </div>

          {/* Generation Form */}
          {!arrangementId && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 space-y-6">
              {/* Loop ID Input */}
              <div>
                <label
                  htmlFor="loop-id"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Loop ID *
                </label>
                <input
                  id="loop-id"
                  type="number"
                  value={loopId}
                  onChange={(e) => setLoopId(e.target.value)}
                  placeholder="Enter loop ID"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                  min="1"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter the ID of the loop you uploaded
                </p>
              </div>

              {/* Arrangement Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Arrangement Type *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setArrangementType('bars')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      arrangementType === 'bars'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                        />
                      </svg>
                      <span>By Bars</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setArrangementType('duration')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      arrangementType === 'duration'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>By Duration</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Bars/Duration Input */}
              {arrangementType === 'bars' ? (
                <div>
                  <label
                    htmlFor="bars"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Number of Bars *
                  </label>
                  <input
                    id="bars"
                    type="number"
                    value={bars}
                    onChange={(e) => setBars(e.target.value)}
                    placeholder="e.g., 8, 16, 32"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating}
                    min="1"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Typical values: 4, 8, 16, 32
                  </p>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="duration"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Duration (seconds) *
                  </label>
                  <input
                    id="duration"
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 30, 60, 120"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating}
                    min="1"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Recommended: 30-180 seconds
                  </p>
                </div>
              )}

              {/* V2: Style Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Style Mode
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setStyleMode('preset')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      styleMode === 'preset'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                        />
                      </svg>
                      <span>Preset</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setStyleMode('naturalLanguage')}
                    disabled={isGenerating}
                    className={`px-6 py-4 rounded-lg font-medium transition-all ${
                      styleMode === 'naturalLanguage'
                        ? 'bg-blue-600 text-white border-2 border-blue-500'
                        : 'bg-gray-800 text-gray-300 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <svg
                        className="h-6 w-6 mb-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <span>Natural Language</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* V1: Style Preset (shown when preset mode) */}
              {styleMode === 'preset' && (
                <div>
                  <label
                    htmlFor="style-preset"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Style Preset
                  </label>
                  <select
                    id="style-preset"
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGenerating || stylePresets.length === 0}
                  >
                    {stylePresets.length === 0 ? (
                      <option value="">Default (style engine unavailable)</option>
                    ) : (
                      stylePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.display_name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* V2: Natural Language Input (shown when natural language mode) */}
              {styleMode === 'naturalLanguage' && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="style-text"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Describe Your Style *
                    </label>
                    <textarea
                      id="style-text"
                      value={styleTextInput}
                      onChange={(e) => setStyleTextInput(e.target.value.slice(0, 500))}
                      placeholder="e.g., 'Southside type, aggressive, beat switch after hook' or 'Dark cinematic, Metro vibe, minimal bounce'"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={3}
                      disabled={isGenerating}
                      maxLength={500}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      {styleTextInput.length}/500 characters
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      id="use-ai"
                      type="checkbox"
                      checked={useAiParsing}
                      onChange={(e) => setUseAiParsing(e.target.checked)}
                      className="w-4 h-4 bg-gray-700 border border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                      disabled={isGenerating}
                    />
                    <label htmlFor="use-ai" className="text-sm text-gray-300 cursor-pointer">
                      Use AI to parse natural language (recommended)
                    </label>
                  </div>

                  {/* PHASE 3: Style Sliders for fine-tuning */}
                  <StyleSliders
                    initialValues={styleProfile}
                    onChange={(updatedStyle) => {
                      setStyleProfile({ ...styleProfile, ...updatedStyle })
                    }}
                    disabled={isGenerating}
                  />
                </div>
              )}

              {/* Style Preset (kept for preset mode) */}

              {/* Producer Moves */}
              <ProducerMoves
                selectedMoves={selectedMoves}
                onChange={setSelectedMoves}
                disabled={isGenerating}
              />

              {/* Reference Track (optional) */}
              <ReferenceTrackPanel
                adaptationStrength={adaptationStrength}
                guidanceMode={guidanceMode}
                onAdaptationStrengthChange={setAdaptationStrength}
                onGuidanceModeChange={setGuidanceMode}
                onAnalysisComplete={(id, refSummary) => {
                  setReferenceAnalysisId(id)
                  setReferenceSummary(refSummary)
                }}
                onAnalysisCleared={() => {
                  setReferenceAnalysisId(null)
                  setReferenceSummary(undefined)
                }}
                disabled={isGenerating}
              />

              {/* Seed */}
              <div>
                <label
                  htmlFor="seed"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Seed (optional)
                </label>
                <input
                  id="seed"
                  type="text"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="e.g., 42 or atl-demo"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isGenerating}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg
                      className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="ml-3 flex-1">
                      {error.startsWith('file_missing:') ? (
                        <>
                          <p className="text-sm font-medium text-red-200">
                            Loop source file not found
                          </p>
                          <p className="text-sm text-red-300 mt-1">
                            The loop file associated with this ID is no longer available. Please upload a new loop to generate an arrangement.
                          </p>
                          <Link
                            href="/"
                            className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <svg
                              className="h-4 w-4 mr-2"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                            Upload New Loop
                          </Link>
                        </>
                      ) : (
                        <p className="text-sm text-red-200">{error}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handlePreviewPlan}
                disabled={isGenerating || isPlanning || !loopId}
                className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3"
              >
                {isPlanning ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>Planning...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                      />
                    </svg>
                    <span>Preview AI Plan</span>
                  </>
                )}
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !loopId}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-3"
              >
                {isGenerating ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span>Generate Arrangement</span>
                  </>
                )}
              </button>

              {aiPlanDraft && aiPlanDraft.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">AI Plan Preview (Editable)</h3>
                    {aiPlanMeta && (
                      <span className="text-xs text-gray-400">
                        {aiPlanMeta.model || 'fallback'} · {aiPlanMeta.latency_ms}ms
                      </span>
                    )}
                  </div>

                  {aiPlanValidation && !aiPlanValidation.valid && aiPlanValidation.errors.length > 0 && (
                    <div className="bg-yellow-900/40 border border-yellow-700 rounded-md p-3">
                      <p className="text-xs text-yellow-200">Planner validation warnings: {aiPlanValidation.errors.join('; ')}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {aiPlanDraft.map((section, idx) => (
                      <div key={`${section.index}-${section.type}`} className="bg-gray-900/50 rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm text-white font-medium capitalize">
                            {section.index + 1}. {section.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {section.density} · {section.transition_into}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="text-xs text-gray-400">
                            Bars
                            <input
                              type="number"
                              min={1}
                              value={section.bars}
                              onChange={(e) => {
                                const next = [...aiPlanDraft]
                                next[idx] = { ...next[idx], bars: Math.max(1, Number(e.target.value) || 1) }
                                setAiPlanDraft(next)
                              }}
                              className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white"
                            />
                          </label>

                          <label className="text-xs text-gray-400">
                            Energy (1-5)
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={section.energy}
                              onChange={(e) => {
                                const next = [...aiPlanDraft]
                                next[idx] = {
                                  ...next[idx],
                                  energy: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                                }
                                setAiPlanDraft(next)
                              }}
                              className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white"
                            />
                          </label>

                          <label className="text-xs text-gray-400">
                            Roles (comma-separated)
                            <input
                              type="text"
                              value={section.active_roles.join(', ')}
                              onChange={(e) => {
                                const parsedRoles = e.target.value
                                  .split(',')
                                  .map((role) => role.trim().toLowerCase())
                                  .filter((role) => role.length > 0)
                                const next = [...aiPlanDraft]
                                next[idx] = { ...next[idx], active_roles: parsedRoles }
                                setAiPlanDraft(next)
                              }}
                              className="mt-1 w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white"
                            />
                          </label>
                        </div>

                        <p className="text-xs text-gray-500">{section.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {structurePreview.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Structure Preview
                    </h3>
                    <span className="text-xs text-gray-400">
                      {structurePreview.reduce((sum, s) => sum + s.bars, 0)} total bars
                    </span>
                  </div>
                  <ArrangementTimeline
                    sections={structurePreview.map((section, index) => ({
                      name: section.name,
                      bar_start: structurePreview.slice(0, index).reduce((sum, s) => sum + s.bars, 0),
                      bars: section.bars,
                      energy: section.energy,
                    }))}
                    totalBars={structurePreview.reduce((sum, s) => sum + s.bars, 0)}
                  />
                </div>
              )}
            </div>
          )}

          <GenerationHistory
            rows={historyRows}
            loading={isHistoryLoading}
            error={historyError}
            activeArrangementId={arrangementId}
            onRefresh={handleHistoryRefresh}
            onTrack={(selectedArrangementId) => {
              setSelectedPreviewId(null)
              setArrangementId(selectedArrangementId)
              setAudioUnavailable(false)
              audioDownloadAttemptsRef.current = 0
              setError(null)
            }}
            onDownload={handleHistoryDownload}
            onRetry={handleRetry}
            onFilterChange={handleFilterChange}
          />

          {previewCandidates.length > 0 && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Preview Variations</h3>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !loopId}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isGenerating ? 'Generating...' : 'Generate 3 New Variations'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {previewCandidates.map((candidate) => {
                  const isSelected = selectedPreviewId === candidate.arrangement_id
                  const isDone = candidate.status === 'done' || candidate.status === 'completed'
                  const isFailed = candidate.status === 'failed'
                  const isPending =
                    candidate.status === 'queued' ||
                    candidate.status === 'pending' ||
                    candidate.status === 'processing'

                  const badgeState = deriveSectionState(candidate)

                  return (
                    <div
                      key={candidate.arrangement_id}
                      className={`rounded-lg border p-4 space-y-3 ${isSelected ? 'border-blue-500 bg-blue-950/30' : 'border-gray-700 bg-gray-800/40'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white font-medium">Variation #{candidate.arrangement_id}</p>
                        <SectionStateBadge state={badgeState} />
                      </div>

                      {isDone && candidate.audioUrl ? (
                        <audio controls src={candidate.audioUrl} className="w-full" />
                      ) : isDone && candidate.audioUnavailable ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            <p className="text-xs text-amber-400">
                              Preview unavailable. You can still download the arrangement.
                            </p>
                          </div>
                          <button
                            onClick={() => handleRetryPreview(candidate.arrangement_id)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline"
                            aria-label={`Retry preview for arrangement ${candidate.arrangement_id}`}
                          >
                            Retry preview
                          </button>
                        </div>
                      ) : isDone && !candidate.audioUrl ? (
                        (() => {
                          const previewStatus = candidate.arrangementStatus?.preview_status
                          const previewRendering =
                            previewStatus === 'queued' || previewStatus === 'processing'
                          const previewFailed = previewStatus === 'failed'
                          if (previewFailed) {
                            return (
                              <div className="space-y-2">
                                <p className="text-xs text-red-300">
                                  Preview render failed.{' '}
                                  {candidate.arrangementStatus?.preview_error ?? ''}
                                </p>
                                <button
                                  onClick={() => handleRetryPreview(candidate.arrangement_id)}
                                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                                  aria-label={`Retry preview for arrangement ${candidate.arrangement_id}`}
                                >
                                  Retry preview
                                </button>
                              </div>
                            )
                          }
                          return (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <svg className="animate-spin h-3 w-3 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              {previewRendering ? 'Rendering preview…' : 'Loading preview...'}
                            </div>
                          )
                        })()
                      ) : isFailed ? (
                        <p className="text-xs text-red-300">Generation failed. Try generating a new variation.</p>
                      ) : (
                        <p className="text-xs text-gray-400">
                          {isPending ? 'Rendering — preview will appear when ready.' : 'Preview will appear when render finishes.'}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedPreviewId(candidate.arrangement_id)
                            setError(null)
                          }}
                          className="flex-1 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                          Track
                        </button>
                        <button
                          onClick={() => handleSavePreview(candidate.arrangement_id)}
                          disabled={!isDone || candidate.isSaved}
                          className="flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                          {candidate.isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Arrangement Status */}
          {arrangementId && arrangementStatus && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ArrangementStatus arrangement={arrangementStatus} />

              {/* Audio Waveform Preview */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  {audioUrl ? (
                    loopAudioUrl ? (
                      <BeforeAfterComparison
                        beforeUrl={loopAudioUrl}
                        afterUrl={audioUrl}
                        beforeTitle="Original Loop"
                        afterTitle="Generated Arrangement"
                      />
                    ) : (
                      <WaveformViewer audioUrl={audioUrl} title="Preview Your Arrangement" />
                    )
                  ) : audioUnavailable ? (
                    /* Stable fallback – audio download failed after max retries */
                    <div className="space-y-4" aria-label="Preview unavailable">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <h3 className="text-lg font-semibold text-white">Preview Your Arrangement</h3>
                        <button
                          onClick={() => arrangementId !== null && arrangementId !== undefined && handleRetryPreview(arrangementId)}
                          className="text-sm text-blue-400 hover:text-blue-300 underline"
                          aria-label="Retry preview for this arrangement"
                        >
                          Retry preview
                        </button>
                      </div>
                      <div className="bg-gray-900/80 border border-gray-700 rounded-lg h-[100px] flex items-center justify-center gap-3">
                        <svg
                          className="h-5 w-5 text-amber-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        <span className="text-sm text-amber-400">Preview unavailable. You can still download the arrangement.</span>
                      </div>
                      {arrangementStatus.preview_error && (
                        <p className="text-xs text-red-400">{arrangementStatus.preview_error}</p>
                      )}
                    </div>
                  ) : (
                    /* Skeleton player while audio is loading or preview is still rendering */
                    (() => {
                      const previewStatus = arrangementStatus.preview_status
                      const isPreviewRendering =
                        previewStatus === 'queued' || previewStatus === 'processing'
                      const loadingLabel = isPreviewRendering
                        ? 'Rendering preview…'
                        : 'Loading audio…'
                      return (
                        <div className="space-y-4" aria-label="Preparing audio preview">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Preview Your Arrangement</h3>
                            <span className="text-sm text-gray-400">{loadingLabel}</span>
                          </div>
                          <div className="bg-gray-900/80 border border-gray-700 rounded-lg h-[100px] flex items-center justify-center gap-3">
                            <svg
                              className="animate-spin h-5 w-5 text-blue-500"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-sm text-gray-400">{loadingLabel}</span>
                          </div>
                        </div>
                      )
                    })()
                  )}
                </div>
              )}

              {/* Download Button */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <DownloadButton arrangementId={arrangementId} downloadUrl={arrangementStatus.output_url} />
                  <DawExportButton arrangementId={arrangementId} />
                </div>
              )}

              {/* Producer Debug Report */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && debugReport && debugReport.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Producer Logic
                  </h3>
                  <div className="space-y-3">
                    {debugReport.map((section, i) => (
                      <div key={i} className="bg-gray-800/60 rounded-md p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white capitalize">{section.section_type}</span>
                          {section.active_stem_roles && section.active_stem_roles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {section.active_stem_roles.map((role) => (
                                <span key={role} className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">{role}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {section.difference_from_previous?.reasons && section.difference_from_previous.reasons.length > 0 && (
                          <ul className="space-y-0.5 pt-0.5">
                            {section.difference_from_previous.reasons.map((reason, j) => (
                              <li key={j} className="text-xs text-gray-400 flex items-start gap-1.5">
                                <span className="text-purple-500 mt-0.5 flex-shrink-0">›</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reference Guidance Panel – only shown when reference was used */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && activeReferenceAnalysisId && (
                <ReferenceGuidancePanel
                  summary={activeReferenceSummary ?? null}
                  adaptationStrength={activeAdaptationStrength}
                  guidanceMode={activeGuidanceMode}
                  referenceStructureSummary={referenceStructureSummary}
                  producerNotes={producerNotes}
                />
              )}

              {/* Producer Engine V2 Insights */}
              {(arrangementStatus.status === 'done' || arrangementStatus.status === 'completed') && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <ProducerInsightsPanel
                    producerPlan={producerPlanV2}
                    producerNotes={producerNotes}
                    qualityScore={qualityScore}
                    sectionSummary={sectionSummary}
                    decisionLog={decisionLog}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setArrangementId(null)
                    setArrangementStatus(null)
                    clearPreviewCandidates()
                    setDebugReport(null)
                    setAiPlanDraft(null)
                    setAiPlanMeta(null)
                    setAiPlanValidation(null)
                    setProducerPlanV2(null)
                    setProducerNotes(null)
                    setQualityScore(null)
                    setSectionSummary(null)
                    setDecisionLog(null)
                    setError(null)
                    setAudioUnavailable(false)
                    audioDownloadAttemptsRef.current = 0
                    setActiveReferenceAnalysisId(null)
                    setActiveReferenceSummary(undefined)
                    setReferenceStructureSummary(null)
                    if (audioUrl) {
                      URL.revokeObjectURL(audioUrl)
                      setAudioUrl(null)
                    }
                    if (loopAudioUrl) {
                      URL.revokeObjectURL(loopAudioUrl)
                      setLoopAudioUrl(null)
                    }
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  Generate Another
                </button>
                <Link
                  href="/"
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                >
                  Upload New Loop
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
