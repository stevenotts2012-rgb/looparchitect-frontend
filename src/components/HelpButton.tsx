'use client'

import React, { useState } from 'react'
import { helpContent, HelpContent } from '@/lib/help'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
  contentKey: string
}

export function HelpModal({ isOpen, onClose, contentKey }: HelpModalProps) {
  const content = helpContent[contentKey]

  if (!isOpen || !content) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-gray-900 rounded-xl shadow-2xl border border-gray-700 w-full max-w-3xl max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-b from-gray-900 to-gray-900/95 backdrop-blur-sm border-b border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white">{content.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center transition-colors text-gray-400 hover:text-white"
                aria-label="Close help"
                title="Close"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(85vh-80px)] space-y-6">
              {content.sections.map((section, index) => (
                <div key={index} className="space-y-3">
                  <h3 className="text-lg font-semibold text-blue-400">
                    {section.heading}
                  </h3>
                  {section.content && (
                    <p className="text-gray-300 leading-relaxed">{section.content}</p>
                  )}
                  {section.bullets && (
                    <ul className="space-y-2">
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li
                          key={bulletIndex}
                          className="flex items-start gap-2 text-gray-300"
                        >
                          <svg
                            className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.examples && (
                    <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-blue-400 font-medium text-sm">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Examples
                      </div>
                      <ul className="space-y-1">
                        {section.examples.map((example, exampleIndex) => (
                          <li
                            key={exampleIndex}
                            className="text-sm text-blue-200 pl-6"
                          >
                            • {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gradient-to-t from-gray-900 to-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
              <button
                onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

interface HelpButtonProps {
  contentKey: string
  className?: string
  variant?: 'icon' | 'text' | 'inline'
}

export function HelpButton({
  contentKey,
  className = '',
  variant = 'icon',
}: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (variant === 'inline') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors underline decoration-dotted ${className}`}
          title="Show help"
        >
          Need help?
        </button>
        <HelpModal isOpen={isOpen} onClose={() => setIsOpen(false)} contentKey={contentKey} />
      </>
    )
  }

  if (variant === 'text') {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded-lg transition-colors ${className}`}
          title="Show help"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          Help
        </button>
        <HelpModal isOpen={isOpen} onClose={() => setIsOpen(false)} contentKey={contentKey} />
      </>
    )
  }

  // variant === 'icon' (default)
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors border border-gray-700 ${className}`}
        title="Show help"
      >
        <svg
          className="w-5 h-5 text-blue-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <HelpModal isOpen={isOpen} onClose={() => setIsOpen(false)} contentKey={contentKey} />
    </>
  )
}

export default HelpButton
