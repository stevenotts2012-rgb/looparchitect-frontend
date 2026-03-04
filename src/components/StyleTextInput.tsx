'use client';

import { useState, useCallback } from 'react';
import { SimpleStyleProfile } from '@/lib/styleSchema';

interface StyleTextInputProps {
  initialValue?: string;
  onChange: (text: string) => void;
  onValidate?: (profile: Partial<SimpleStyleProfile>) => Promise<boolean>;
  disabled?: boolean;
}

/**
 * Natural Language Style Input Component (PHASE 3)
 * 
 * Allows users to describe their desired style in natural language.
 * Example: "cinematic dark atmospheric synthwave with beat switch"
 */
export function StyleTextInput({
  initialValue = '',
  onChange,
  onValidate,
  disabled = false,
}: StyleTextInputProps) {
  const [text, setText] = useState(initialValue);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value.slice(0, 500);
      setText(value);
      onChange(value);
      setError(null);
    },
    [onChange]
  );

  const handleValidate = useCallback(async () => {
    if (!text.trim()) {
      setError('Style description cannot be empty');
      setIsValid(false);
      return;
    }

    if (onValidate) {
      setIsValidating(true);
      setError(null);
      try {
        const profile: Partial<SimpleStyleProfile> = {
          intent: text,
          energy: 0.5,
          darkness: 0.5,
          bounce: 0.5,
          warmth: 0.5,
          texture: 'balanced',
        };
        const valid = await onValidate(profile);
        setIsValid(valid);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Validation failed'
        );
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    }
  }, [text, onValidate]);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="style-intent" className="text-sm font-medium text-gray-300">
        Describe Your Style
      </label>

      <div className="relative">
        <textarea
          id="style-intent"
          value={text}
          onChange={handleChange}
          disabled={disabled || isValidating}
          placeholder="e.g., cinematic dark atmospheric synthwave with beat switch at bar 32"
          maxLength={500}
          rows={3}
          className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white 
            placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:border-transparent resize-none transition
            ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : isValid === true
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-slate-700'
            }
            ${disabled || isValidating ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Style description"
          aria-describedby={error ? 'style-error' : undefined}
        />

        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {text.length}/500
        </div>
      </div>

      {/* Validation feedback */}
      {error && (
        <div id="style-error" className="flex items-center gap-2 text-sm text-red-400">
          <span>❌</span>
          {error}
        </div>
      )}

      {isValid === true && !error && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <span>✅</span>
          Style validated successfully
        </div>
      )}

      {/* Validation button */}
      {onValidate && (
        <button
          onClick={handleValidate}
          disabled={disabled || isValidating || !text.trim()}
          className={`px-3 py-2 rounded font-medium text-sm transition
            ${
              isValidating
                ? 'bg-slate-600 text-gray-400 cursor-not-allowed'
                : disabled
                  ? 'bg-slate-700 text-gray-500 cursor-not-allowed'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
        >
          {isValidating ? 'Validating...' : 'Validate Style'}
        </button>
      )}

      {/* Helpful examples */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400 font-medium">
          💡 Example styles
        </summary>
        <ul className="mt-2 ml-4 text-xs text-gray-600 space-y-1">
          <li>• "Dark trap with aggressive 808s"</li>
          <li>• "Cinematic orchestral with electronic elements"</li>
          <li>• "Chill synthwave vibe"</li>
          <li>• "Drill beat, Southside type, beat switch"</li>
        </ul>
      </details>
    </div>
  );
}
