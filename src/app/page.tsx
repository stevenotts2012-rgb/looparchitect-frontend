'use client'

import { useState } from 'react'
import Link from 'next/link'
import UploadForm from '@/components/UploadForm'
import { HelpButton } from '@/components/HelpButton'

export default function Home() {
  const [uploadedLoopId, setUploadedLoopId] = useState<number | null>(null)

  const handleUploadSuccess = (loopId: number) => {
    setUploadedLoopId(loopId)
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
                className="text-white font-medium hover:text-blue-400 transition-colors"
              >
                Upload
              </Link>
              <Link
                href="/generate"
                className="text-gray-400 hover:text-white transition-colors"
              >
                Generate
              </Link>
              <HelpButton contentKey="upload" variant="icon" />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full space-y-10 text-center">
          {/* Hero Section */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              LoopArchitect
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto">
              Upload a stereo loop, a full stem pack, or a ZIP of stems and generate producer-style arrangements with AI
            </p>
          </div>

          {/* Upload Section */}
          <div className="flex flex-col items-center space-y-8">
            <UploadForm onUploadSuccess={handleUploadSuccess} />

            {/* Success Message */}
            {uploadedLoopId !== null && (
              <div className="w-full max-w-2xl bg-green-900/30 border border-green-700 rounded-lg p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-200 mb-2">
                      Loop uploaded successfully!
                    </h3>
                    <p className="text-sm text-green-300 mb-4">
                      Loop ID: <span className="font-mono font-bold">{uploadedLoopId}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        href={`/generate?loopId=${uploadedLoopId}`}
                        className="inline-flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors space-x-2"
                      >
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
                      </Link>
                      <button
                        onClick={() => setUploadedLoopId(null)}
                        className="inline-flex items-center justify-center px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                      >
                        Upload Another
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-lg mb-4">
                <svg
                  className="h-6 w-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">1. Upload</h3>
              <p className="text-sm text-gray-400">
                Upload a loop, multi-stem pack, or ZIP stem pack (MP3, WAV, OGG, FLAC, ZIP)
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-lg mb-4">
                <svg
                  className="h-6 w-6 text-purple-400"
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
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">2. Generate</h3>
              <p className="text-sm text-gray-400">
                AI generates a professional arrangement from your loop
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-lg mb-4">
                <svg
                  className="h-6 w-6 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">3. Download</h3>
              <p className="text-sm text-gray-400">
                Download your finished arrangement and preview it instantly
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
