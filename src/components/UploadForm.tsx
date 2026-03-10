'use client'

import { useEffect, useRef, useState } from 'react'
import { uploadLoop, LoopArchitectApiError } from '@/../../api/client'

interface UploadFormProps {
  onUploadSuccess: (loopId: number) => void
}

export default function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedRoles, setDetectedRoles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!folderInputRef.current) {
      return
    }

    folderInputRef.current.setAttribute('webkitdirectory', '')
    folderInputRef.current.setAttribute('directory', '')
  }, [])

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateAndSetFiles = (filesLike: FileList | File[]) => {
    const files = Array.from(filesLike)
    if (files.length === 0) {
      setSelectedFiles([])
      return
    }

    const zipFiles = files.filter((file) => file.name.toLowerCase().endsWith('.zip'))
    const audioFiles = files.filter((file) => !file.name.toLowerCase().endsWith('.zip'))
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac']

    if (zipFiles.length > 1 || (zipFiles.length > 0 && audioFiles.length > 0)) {
      setError('Upload either one ZIP stem pack or one/many audio stems.')
      setSelectedFiles([])
      return
    }

    if (zipFiles.length === 1) {
      setSelectedFiles(zipFiles)
      setDetectedRoles([])
      setError(null)
      return
    }

    const invalidAudio = audioFiles.find(
      (file) => !validTypes.some((type) => file.type.includes(type.split('/')[1])) && !/\.(wav|mp3|ogg|flac)$/i.test(file.name)
    )
    if (invalidAudio) {
      setError('Please select valid audio files (MP3, WAV, OGG, FLAC) or a ZIP stem pack.')
      setSelectedFiles([])
      return
    }

    const maxSize = 50 * 1024 * 1024
    const oversized = files.find((file) => file.size > maxSize)
    if (oversized) {
      setError(`File size must be less than 50MB: ${oversized.name}`)
      setSelectedFiles([])
      return
    }

    setSelectedFiles(audioFiles)
    setDetectedRoles([])
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFiles(e.target.files || [])
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSetFiles(e.target.files || [])
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select upload files first')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const response = await uploadLoop(selectedFiles.length === 1 ? selectedFiles[0] : selectedFiles)
      onUploadSuccess(response.id)
      setDetectedRoles(response.stem_metadata?.roles_detected || response.stem_metadata?.stems_generated || [])
      
      // Reset form
      setSelectedFiles([])
      resetInput()
    } catch (err) {
      if (err instanceof LoopArchitectApiError) {
        setError(err.message)
      } else {
        setError('Failed to upload file. Please try again.')
      }
    } finally {
      setIsUploading(false)
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
    if (files && files.length > 0 && fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      Array.from(files).forEach((file) => dataTransfer.items.add(file))
      fileInputRef.current.files = dataTransfer.files
      validateAndSetFiles(dataTransfer.files)
    }
  }

  const uploadModeLabel = selectedFiles.length === 1 && selectedFiles[0]?.name.toLowerCase().endsWith('.zip')
    ? 'Stem Pack ZIP'
    : selectedFiles.length > 1
      ? 'Multi-Stem Pack'
      : 'Single Loop'

  const hasRole = (role: string) => detectedRoles.includes(role)
  const hasPadsOrHarmony = hasRole('pads') || hasRole('harmony')

  const arrangementPreview = [
    { name: 'Intro', stems: [hasRole('melody') ? 'melody' : '', hasPadsOrHarmony ? 'pads/harmony' : ''].filter(Boolean) },
    { name: 'Verse', stems: [hasRole('drums') ? 'drums' : '', hasRole('bass') ? 'bass' : ''].filter(Boolean) },
    { name: 'Hook', stems: detectedRoles.filter((role) => ['drums', 'bass', 'melody', 'pads', 'harmony', 'fx', 'full_mix'].includes(role)) },
  ]

  return (
    <div className="w-full max-w-2xl space-y-6">
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
            Choose files/stems
          </label>
          <input
            ref={fileInputRef}
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept="audio/*,.zip"
            multiple
            onChange={handleFileChange}
            disabled={isUploading}
          />
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
            disabled={isUploading}
          />
          <p className="mt-1 text-sm text-gray-400">or drag and drop</p>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Single loop, stem folder, multi-stem files, or one ZIP stem pack · MP3/WAV/OGG/FLAC/ZIP up to 50MB each
        </p>
      </div>

      {/* Selected File Display */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <svg
              className="h-8 w-8 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-white font-medium">{uploadModeLabel}</p>
              <p className="text-sm text-gray-400 mb-2">
                {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'} selected
              </p>
              <ul className="space-y-1 text-sm text-gray-300">
                {selectedFiles.slice(0, 6).map((file) => (
                  <li key={`${file.name}-${file.size}`}>• {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</li>
                ))}
                {selectedFiles.length > 6 && <li>• +{selectedFiles.length - 6} more</li>}
              </ul>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedFiles([])
              setDetectedRoles([])
              resetInput()
            }}
            className="text-gray-400 hover:text-white"
            disabled={isUploading}
            aria-label="Clear selected file"
            title="Clear selected file"
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

      {detectedRoles.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
          <p className="text-sm text-blue-200 mb-3 font-medium">Detected stem roles</p>
          <div className="flex flex-wrap gap-2">
            {detectedRoles.map((role) => (
              <span key={role} className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs uppercase tracking-wide">
                {role}
              </span>
            ))}
          </div>
          <div className="mt-4 border-t border-blue-700/60 pt-3">
            <p className="text-xs text-blue-200/90 mb-2 font-medium">Arrangement preview</p>
            <div className="space-y-1 text-xs text-blue-100">
              {arrangementPreview.map((section) => (
                <p key={section.name}>
                  <span className="font-semibold">{section.name}</span>
                  {' → '}
                  {section.stems.length > 0 ? section.stems.join('/') : 'auto'}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
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
            <p className="ml-3 text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={selectedFiles.length === 0 || isUploading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
      >
        {isUploading ? (
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
            <span>Uploading...</span>
          </>
        ) : (
          <span>{selectedFiles.length > 1 ? 'Upload Stem Pack' : selectedFiles[0]?.name.toLowerCase().endsWith('.zip') ? 'Upload ZIP Stem Pack' : 'Upload Loop'}</span>
        )}
      </button>
    </div>
  )
}
