'use client';

import { useState, useCallback } from 'react';
import { SimpleStyleProfile } from '@/lib/styleSchema';

interface StyleSlidersProps {
  initialValues?: Partial<SimpleStyleProfile>;
  onChange: (style: Partial<SimpleStyleProfile>) => void;
  disabled?: boolean;
}

/**
 * Style Sliders Component (PHASE 3)
 * 
 * Provides granular slider controls for:
 * - Energy (quiet ↔ loud)
 * - Darkness (bright ↔ dark/moody)
 * - Bounce (laid-back ↔ driving)
 * - Warmth (cold/clinical ↔ warm/organic)
 * - Texture (smooth | balanced | gritty)
 */
export function StyleSliders({
  initialValues,
  onChange,
  disabled = false,
}: StyleSlidersProps) {
  const [style, setStyle] = useState<Partial<SimpleStyleProfile>>(
    initialValues || {
      energy: 0.5,
      darkness: 0.5,
      bounce: 0.5,
      warmth: 0.5,
      texture: 'balanced',
    }
  );

  const handleSliderChange = useCallback(
    (key: string, value: number) => {
      const updated = { ...style, [key]: value };
      setStyle(updated);
      onChange(updated);
    },
    [style, onChange]
  );

  const handleTextureChange = useCallback(
    (texture: 'smooth' | 'balanced' | 'gritty') => {
      const updated = { ...style, texture };
      setStyle(updated);
      onChange(updated);
    },
    [style, onChange]
  );

  const sliders = [
    {
      key: 'energy',
      label: 'Energy',
      tooltip: 'Quiet ↔ Loud',
      leftLabel: 'Quiet',
      rightLabel: 'Loud',
    },
    {
      key: 'darkness',
      label: 'Darkness',
      tooltip: 'Bright ↔ Dark',
      leftLabel: 'Bright',
      rightLabel: 'Dark',
    },
    {
      key: 'bounce',
      label: 'Bounce',
      tooltip: 'Laid-back ↔ Driving',
      leftLabel: 'Laid-back',
      rightLabel: 'Driving',
    },
    {
      key: 'warmth',
      label: 'Warmth',
      tooltip: 'Cold ↔ Warm',
      leftLabel: 'Cold',
      rightLabel: 'Warm',
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 bg-slate-900 rounded-lg border border-slate-700">
      <div>
        <h3 className="text-lg font-semibold text-white mb-6">Style Parameters</h3>

        {/* Sliders */}
        <div className="space-y-5">
          {sliders.map(({ key, label, tooltip, leftLabel, rightLabel }) => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <label
                  className="text-sm font-medium text-gray-300"
                  title={tooltip}
                >
                  {label}
                </label>
                <span className="text-xs font-mono text-gray-500 bg-slate-800 px-2 py-1 rounded">
                  {((style[key as keyof SimpleStyleProfile] as number) * 100).toFixed(0)}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={style[key as keyof SimpleStyleProfile] as number}
                onChange={(e) => handleSliderChange(key, parseFloat(e.target.value))}
                disabled={disabled}
                className={`w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer 
                  accent-blue-500 hover:accent-blue-400 transition
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-label={label}
              />

              <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Texture Selector */}
      <div className="border-t border-slate-700 pt-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">
          Texture Type
        </label>
        <div className="flex gap-2">
          {(['smooth', 'balanced', 'gritty'] as const).map((tex) => (
            <button
              key={tex}
              onClick={() => handleTextureChange(tex)}
              disabled={disabled}
              className={`px-4 py-2 rounded font-medium text-sm transition-all ${
                style.texture === tex
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tex.charAt(0).toUpperCase() + tex.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Helpful text */}
      <div className="bg-slate-800 border border-slate-700 rounded p-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          💡 <strong>Tip:</strong> Adjust sliders to fine-tune the style. 
          Energy controls intensity, darkness affects mood, 
          bounce impacts groove, warmth sets the timbre tone.
        </p>
      </div>
    </div>
  );
}
