'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadLoop, LoopArchitectApiError } from '@/../../api/client'

type UploadMode = 'single-loop' | 'stem-files' | 'stem-pack'

interface UploadState {
  mode: UploadMode
  selectedFiles: File[]
  isUploading: boolean
  error: string | null
  detectedRoles: string[]
  uploadedLoopId: number | null
  renderPath: string | null
  uploadWarnings: string[]
  autoAligned: boolean
  correctedTiming: boolean
  requiredTrimPad: boolean
  stemMisalignmentWarning: string | null
}

interface UploadFormProps {
  onUploadSuccess: (loopId: number) => void
}

export default function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [state, setState] = useState<UploadState>({
    mode: 'single-loop',
    selectedFiles: [],
    isUploading: false,
    error: null,
    detectedRoles: [],
    uploadedLoopId: null,
    renderPath: null,
    uploadWarnings: [],
    autoAligned: false,
    correctedTiming: false,
    requiredTrimPad: false,
    stemMisalignmentWarning: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!folderInputRef.current) {
      return
    }
    folderInputRef.current.setAttribute('webkitdirectory', '')
    folderInputRef.current.setAttribute('directory', '')
  }, [])

  // Mode selector handler
  const handleModeChange = (newMode: UploadMode) => {
    setState((prev) => ({
      ...prev,
      mode: newMode,
      selectedFiles: [],
      error: null,
      detectedRoles: [],
      uploadedLoopId: null,
      renderPath: null,
      uploadWarnings: [],
      autoAligned: false,
      correctedTiming: false,
      requiredTrimPad: false,
      stemMisalignmentWarning: null,
    }))
    resetInputs()
  }

  const resetInputs = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = ''
    }
  }

  // Validation logic based on mode
  const validateAndSetFiles = (filesLike: FileList | File[]) => {
    const files = Array.from(filesLike)
    if (files.length === 0) {
      setState((prev) => ({ ...prev, selectedFiles: [] }))
      return
    }

    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith('.zip'))
    const audioFiles = files.filter((file) => !file.name.toLowerCase().endsWith('.zip'))
    const validAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac']

    // Validate based on current mode
    if (state.mode === 'single-loop') {
      if (files.length > 1) {
        setState((prev) => ({ ...prev, error: 'Please select exactly one file for single loop mode.', selectedFiles: [] }))
        return
      }
      if (zipFiles.length > 0) {
        setState((prev) => ({ ...prev, error: 'Single loop mode requires an audio file, not a ZIP archive.', selectedFiles: [] }))
        return
      }
    } else if (state.mode === 'stem-files') {
      if (zipFiles.length > 0) {
        setState((prev) => ({ ...prev, error: 'Stem files mode requires individual audio files, not ZIP archives.', selectedFiles: [] }))
        return
      }
      if (files.length < 2) {
        setState((prev) => ({ ...prev, error: 'Please select at least 2 stem files.', selectedFiles: [] }))
        return
      }
    } else if (state.mode === 'stem-pack') {
      if (zipFiles.length === 0) {
        setState((prev) => ({ ...prev, error: 'Stem pack mode requires a ZIP file.', selectedFiles: [] }))
        return
      }
      if (zipFiles.length > 1 || audioFiles.length > 0) {
        setState((prev) => ({ ...prev, error: 'Please select exactly one ZIP file for stem pack mode.', selectedFiles: [] }))
        return
      }
    }

    // Validate audio files
    const invalidAudio = audioFiles.find(
      (file) => !validAudioTypes.some((type) => file.type.includes(type.split('/')[1])) && !/\.(wav|mp3|ogg|flac)$/i.test(file.name)
    )
    if (invalidAudio) {
      setState((prev) => ({ ...prev, error: `Invalid audio format: ${invalidAudio.name}`, selectedFiles: [] }))
      return
    }

    // Validate ZIP files
    const invalidZip = zipFiles.find((file) => !file.name.toLowerCase().endsWith('.zip'))
    if (invalidZip) {
      setState((prev) => ({ ...prev, error: `Invalid file type: ${invalidZip.name}. ZIP files must have .zip extension.`, selectedFiles: [] }))
      return
    }

    // Validate file sizes
    const maxSize = 50 * 1024 * 1024
    const oversized = files.find((file) => file.size > maxSize)
    if (oversized) {
      setState((prev) => ({ ...prev, error: `File too large: ${oversized.name} (${(oversized.size / (1024 * 1024)).toFixed(1)} MB). Max 50MB per file.`, selectedFiles: [] }))
      return
    }

    // Success - use appropriate files based on mode
    const filesToUse = state.mode === 'stem-pack' ? zipFiles : audioFiles
    setState((prev) => ({
      ...prev,
      selectedFiles: filesToUse,
      error: null,
      detectedRoles: [],
      uploadedLoopId: null,
      renderPath: null,
      uploadWarnings: [],
      autoAligned: false,
      correctedTiming: false,
      requiredTrimPad: false,
      stemMisalignmentWarning: null,
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFiles(e.target.files || [])
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFiles(e.target.files || [])
  }

  const handleUpload = async () => {
    if (state.selectedFiles.length === 0) {
      setState((prev) => ({ ...prev, error: 'Please select files first' }))
      return
    }

    setState((prev) => ({ ...prev, isUploading: true, error: null }))

    try {
      const filesToUpload = state.selectedFiles.length === 1 ? state.selectedFiles[0] : state.selectedFiles
      const response = await uploadLoop(filesToUpload)
      const stemMetadata = response.stem_metadata
      const alignment = stemMetadata?.alignment
      const warnings = stemMetadata?.warnings || alignment?.warnings || []
      const hasTimingOffsetCorrection = Boolean(
        alignment?.original_offsets_ms &&
        Object.values(alignment.original_offsets_ms).some((offset) => Math.abs(offset || 0) > 0)
      )
      const hasTrimPadAdjustments = Boolean(
        alignment?.adjustments_ms &&
        Object.values(alignment.adjustments_ms).some(
          (adjustment) => ((adjustment?.trim_ms || 0) > 0 || (adjustment?.pad_ms || 0) > 0)
        )
      )
      const stemUploadMode = stemMetadata?.upload_mode === 'stem_pack'
      const stemSucceeded = Boolean(stemMetadata?.succeeded) && !Boolean(stemMetadata?.fallback_to_loop)
      
      const misalignmentWarning =
        hasTimingOffsetCorrection || hasTrimPadAdjustments
          ? 'Detected timing offsets between stems. They will be auto-aligned during processing.'
          : null

      setState((prev) => ({
        ...prev,
        uploadedLoopId: response.id,
        detectedRoles: stemMetadata?.roles_detected || stemMetadata?.stems_generated || [],
        renderPath: stemUploadMode && stemSucceeded ? 'stem' : 'loop',
        uploadWarnings: warnings,
        autoAligned: Boolean(alignment?.auto_aligned),
        correctedTiming: hasTimingOffsetCorrection,
        requiredTrimPad: hasTrimPadAdjustments,
        stemMisalignmentWarning: misalignmentWarning,
      }))
      
      onUploadSuccess(response.id)
      
      // Reset form
      setState((prev) => ({ ...prev, selectedFiles: [] }))
      resetInputs()
    } catch (err) {
      const errorMessage = err instanceof LoopArchitectApiError ? err.message : 'Upload failed. Please try again.'
      setState((prev) => ({ ...prev, error: errorMessage }))
    } finally {
      setState((prev) => ({ ...prev, isUploading: false }))
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      validateAndSetFiles(files)
    }
  }

  const getModeDescription = () => {
    switch (state.mode) {
      case 'single-loop':
        return 'Upload a single stereo loop file. The app will generate arrangements using fallback DSP processing.'
      case 'stem-files':
        return 'Upload multiple individual stem files (drums, bass, melody, etc.). The app will arrange them intelligently.'
      case 'stem-pack':
        return 'Upload a ZIP archive containing stem files. The app will extract and arrange them.'
      default:
        return ''
    }
  }

  const getUploadHint = () => {
    switch (state.mode) {
      case 'single-loop':
        return 'Select one MP3, WAV, OGG, or FLAC file'
      case 'stem-files':
        return 'Select 2+ audio files (e.g., drums.wav, bass.wav, melody.wav)'
      case 'stem-pack':
        return 'Select one ZIP file containing stems'
      default:
        return 'Select files'
    }
  }

  const getUploadButtonLabel = () => {
    if (state.isUploading) {
      return 'Uploading...'
    }
    switch (state.mode) {
      case 'single-loop':
        return 'Upload Loop'
      case 'stem-files':
        return 'Upload Stems'
      case 'stem-pack':
        return 'Upload ZIP Stem Pack'
      default:
        return 'Upload'
    }
  }

  const hasRole = (role: string) => state.detectedRoles.includes(role)
  const hasPadsOrHarmony = hasRole('pads') || hasRole('harmony')

  const arrangementPreview = [
    { name: 'Intro', stems: [hasRole('melody') ? 'melody' : '', hasPadsOrHarmony ? 'pads/harmony' : ''].filter(Boolean) },
    { name: 'Verse', stems: [hasRole('drums') ? 'drums' : '', hasRole('bass') ? 'bass' : ''].filter(Boolean) },
    { name: 'Hook', stems: state.detectedRoles.filter((role) => ['drums', 'bass', 'melody', 'pads', 'harmony', 'fx', 'full_mix'].includes(role)) },
  ]

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Success Message */}
      {state.uploadedLoopId && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-green-400 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-200">Upload successful!</p>
              <p className="mt-1 text-sm text-green-100">
                Loop ID: <span className="font-mono font-semibold">{state.uploadedLoopId}</span>
              </p>
              <p className="mt-0.5 text-sm text-green-100">
                Mode: <span className="font-semibold">{state.renderPath === 'stem' ? '🎵 Stem Arrangement Mode' : '🔄 Stereo Loop Fallback Mode'}</span>
              </p>
              {state.detectedRoles.length > 0 && (
                <p className="mt-0.5 text-sm text-green-100">
                  Stems detected: <span className="font-semibold">{state.detectedRoles.join(', ')}</span>
                </p>
              )}
              {state.autoAligned && (
                <p className="mt-0.5 text-sm text-green-100">Stems were auto-aligned.</p>
              )}
              {state.correctedTiming && (
                <p className="mt-0.5 text-sm text-green-100">Detected timing offsets and corrected them.</p>
              )}
              {state.requiredTrimPad && (
                <p className="mt-0.5 text-sm text-green-100">Some stems required trimming/padding.</p>
              )}
              {state.uploadWarnings.length > 0 && (
                <p className="mt-0.5 text-sm text-green-100">
                  Alignment notes: <span className="font-semibold">{state.uploadWarnings.join(' | ')}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode Selector */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">Upload Mode</label>
        <div className="grid grid-cols-3 gap-3">
          {(['single-loop', 'stem-files', 'stem-pack'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`relative px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                state.mode === mode
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                {mode === 'single-loop' && (
                  <>
                    <span>🎵</span>
                    <span>Single Loop</span>
                  </>
                )}
                {mode === 'stem-files' && (
                  <>
                    <span>🎸</span>
                    <span>Stem Files</span>
                  </>
                )}
                {mode === 'stem-pack' && (
                  <>
                    <span>📦</span>
                    <span>Stem ZIP</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">{getModeDescription()}</p>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors"
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="mt-4">
          <label
            htmlFor="file-upload"
            className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium"
          >
            Choose files
          </label>
          <input
            ref={fileInputRef}
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept={state.mode === 'stem-pack' ? '.zip' : 'audio/*'}
            multiple={state.mode !== 'single-loop' && state.mode !== 'stem-pack'}
            onChange={handleFileChange}
            disabled={state.isUploading}
          />
          {state.mode === 'stem-files' && (
            <>
              <span className="mx-2 text-sm text-gray-500">or</span>
              <label
                htmlFor="folder-upload"
                className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium"
              >
                Choose folder
              </label>
              <input
                ref={folderInputRef}
                id="folder-upload"
                name="folder-upload"
                type="file"
                className="sr-only"
                accept="audio/*"
                multiple
                onChange={handleFolderChange}
                disabled={state.isUploading}
              />
            </>
          )}
          <p className="mt-1 text-sm text-gray-400">or drag and drop</p>
        </div>
        <p className="mt-2 text-xs text-gray-500">{getUploadHint()} · up to 50MB each</p>
      </div>

      {/* Selected Files Display */}
      {state.selectedFiles.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <svg
              className="h-8 w-8 text-blue-400 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-white font-medium">
                {state.selectedFiles.length} file{state.selectedFiles.length === 1 ? '' : 's'} selected
              </p>
              <ul className="space-y-1 text-sm text-gray-300 mt-2">
                {state.selectedFiles.slice(0, 6).map((file) => (
                  <li key={`${file.name}-${file.size}`}>
                    • {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                  </li>
                ))}
                {state.selectedFiles.length > 6 && <li>• +{state.selectedFiles.length - 6} more</li>}
              </ul>
            </div>
          </div>
          <button
            onClick={() => {
              setState((prev) => ({ ...prev, selectedFiles: [], error: null }))
              resetInputs()
            }}
            className="text-gray-400 hover:text-white flex-shrink-0"
            disabled={state.isUploading}
            aria-label="Clear selected files"
            title="Clear selected files"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Stem Misalignment Warning */}
      {state.stemMisalignmentWarning && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 flex items-start space-x-2">
          <svg className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-yellow-200">{state.stemMisalignmentWarning}</p>
        </div>
      )}

      {/* Detected Stems & Arrangement Preview */}
      {state.detectedRoles.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm text-blue-200 mb-3 font-medium">🎸 Detected stem roles</p>
            <div className="flex flex-wrap gap-2">
              {state.detectedRoles.map((role) => (
                <span key={role} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs uppercase tracking-wide">
                  {role}
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-blue-700/60 pt-3">
            <p className="text-xs text-blue-200/90 mb-2 font-medium">🎼 Predicted arrangement</p>
            <div className="space-y-1 text-xs text-blue-100">
              {arrangementPreview
                .filter((section) => section.stems.length > 0)
                .map((section) => (
                  <p key={section.name}>
                    <span className="font-semibold">{section.name}</span>
                    {' → '}
                    {section.stems.join(' + ')}
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-400 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="ml-3 text-sm text-red-200">{state.error}</p>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={state.selectedFiles.length === 0 || state.isUploading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
      >
        {state.isUploading ? (
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
            <span>{getUploadButtonLabel()}</span>
          </>
        ) : (
          <span>{getUploadButtonLabel()}</span>
        )}
      </button>
    </div>
  )
}
